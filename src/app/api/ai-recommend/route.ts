import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/session';
import { generateJson, hasGemini } from '@/lib/gemini';
import { regionNamesAround, searchBlogText, searchLocal, type NaverPlace } from '@/lib/naver';
import { hasTourApi, searchFestivals } from '@/lib/tourApi';
import { describeSchedule, toTourDate } from '@/lib/scheduleText';
import { katechToWgs84, getStraightLineDistance } from '@/lib/utils';
import type { DateSchedule, RegionEvent } from '@/lib/types';

interface InputPlace {
  title?: string;
  address?: string;
  roadAddress?: string;
  mapx?: number | string;
  mapy?: number | string;
}

// 더 불러오기를 위한 키워드 확장 (네이버 지역 API는 질의당 5개까지만 주므로 키워드로 우회)
const EXPANDED_TERMS: Record<string, string[]> = {
  restaurant: ['맛집', '데이트 맛집', '분위기 좋은 맛집', '점심 맛집', '저녁 맛집', '인스타 맛집', '가성비 맛집', '핫플 맛집', '고기집', '파스타'],
  cafe: ['카페', '디저트 카페', '예쁜 카페', '감성 카페', '대형 카페', '오션뷰 카페', '인스타 카페', '핫플 카페', '베이커리', '브런치'],
  activity: ['가볼만한곳', '데이트코스', '전시회', '체험', '소품샵', '공원', '명소', '볼거리', '공방', '산책'],
  accommodation: ['숙소', '호텔', '펜션', '감성숙소', '게스트하우스', '오션뷰 숙소', '풀빌라', '리조트', '글램핑', '캠핑'],
};

interface Candidate extends NaverPlace {
  mentionCount: number;
  reason?: string;
  keywords?: string[];
  sourceType?: string;
}

function toWgs(place: InputPlace) {
  return katechToWgs84(place.mapx, place.mapy);
}

function regionsAround(points: InputPlace[], radiusKm: number): Promise<string[]> {
  return regionNamesAround(points.map(toWgs), radiusKm);
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const encoder = new TextEncoder();
  const body = await request.json().catch(() => ({}));

  const places: InputPlace[] = Array.isArray(body.places) ? body.places.slice(0, 50) : [];
  const centerPlace: InputPlace | null = body.centerPlace && body.centerPlace.mapx ? body.centerPlace : null;
  const radiusKm = Math.min(50, Math.max(0.3, Number(body.radiusKm) || 5));
  const categories: string[] = Array.isArray(body.categories) && body.categories.length > 0
    ? body.categories.filter((c: string) => c in EXPANDED_TERMS)
    : ['restaurant', 'cafe', 'activity'];
  const excludePlaces: string[] = Array.isArray(body.excludePlaces) ? body.excludePlaces.slice(0, 200) : [];
  const searchKeyword = typeof body.searchKeyword === 'string' ? body.searchKeyword.trim().slice(0, 50) : '';
  const regionText = typeof body.region === 'string' ? body.region.trim().slice(0, 30) : '';
  const schedule: DateSchedule | null = body.schedule && body.schedule.startDate ? body.schedule : null;
  const isLoadMore = excludePlaces.length > 0;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      const sendProgress = (step: number, total: number, message: string) => send({ type: 'progress', step, total, message });

      try {
        // ── Step 1: 기준 지역 ──
        sendProgress(1, 5, '🔍 기준 지역을 확인하는 중...');

        let center: { lat: number; lng: number } | null = null;
        let regions: string[] = [];
        if (centerPlace) {
          center = toWgs(centerPlace);
          regions = await regionsAround([centerPlace], radiusKm);
        } else if (regionText) {
          regions = [regionText];
          const [first] = await searchLocal(regionText);
          if (first) center = katechToWgs84(first.mapx, first.mapy);
        } else if (places.length > 0) {
          center = toWgs(places[0]);
          regions = await regionsAround(places, radiusKm);
        }
        if (regions.length === 0) regions = ['서울'];

        // 축제·행사 (TourAPI): 일정이 있으면 그 기간, 없으면 오늘부터 2주
        let events: RegionEvent[] = [];
        if (!isLoadMore && hasTourApi()) {
          const today = new Date();
          const start = schedule ? toTourDate(schedule.startDate) : toTourDate(today.toISOString().slice(0, 10));
          const end = schedule
            ? toTourDate(schedule.endDate || schedule.startDate)
            : toTourDate(new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10));
          events = await searchFestivals({ startDate: start, endDate: end, center, radiusKm: Math.max(15, radiusKm * 3) })
            .catch(() => []);
        }

        // ── Step 2: 장소 후보 수집 (Naver Local) ──
        sendProgress(2, 5, '🗺️ 주변 장소 후보를 모으는 중...');

        const offset = Math.floor(excludePlaces.length / 5);
        const terms = categories.flatMap((c) => {
          const list = EXPANDED_TERMS[c];
          const startIndex = (offset * 3) % list.length;
          return [0, 1, 2].map((k) => list[(startIndex + k) % list.length]);
        });
        const queries = regions.slice(0, 2).flatMap((r) =>
          terms.map((term) => (searchKeyword ? `${r} ${searchKeyword} ${term}` : `${r} ${term}`))
        );

        const existing = new Set([
          ...places.map((p) => (p.title || '').replace(/<[^>]+>/g, '')),
          ...excludePlaces,
        ]);
        const found = (await Promise.all(queries.map((q) => searchLocal(q)))).flat();
        let candidates: Candidate[] = [];
        for (const item of found) {
          if (!item.name || existing.has(item.name) || candidates.some((c) => c.name === item.name)) continue;
          candidates.push({ ...item, mentionCount: 0 });
        }

        const filterCenters = centerPlace ? [toWgs(centerPlace)] : places.length > 0 ? places.map(toWgs) : center ? [center] : [];
        if (filterCenters.length > 0) {
          const radiusMeters = radiusKm * 1000;
          candidates = candidates.filter((c) => {
            const { lat, lng } = katechToWgs84(c.mapx, c.mapy);
            return filterCenters.some((fc) => getStraightLineDistance(lat, lng, fc.lat, fc.lng) <= radiusMeters);
          });
        }
        candidates = candidates.slice(0, 30);

        // ── Step 3: 블로그/유튜브 언급량 ──
        sendProgress(3, 5, '📱 블로그·유튜브 언급량을 세는 중...');

        const youtubeKey = process.env.YOUTUBE_API_KEY;
        const ytTexts = youtubeKey && youtubeKey !== 'your_youtube_api_key'
          ? await Promise.all(regions.slice(0, 2).map(async (r) => {
              try {
                const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(`${r} 데이트 핫플`)}&type=video&key=${youtubeKey}&relevanceLanguage=ko`;
                const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
                if (!res.ok) return '';
                const data = await res.json();
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return (data.items || []).map((v: any) => `${v.snippet?.title} ${v.snippet?.description}`).join(' ');
              } catch {
                return '';
              }
            }))
          : [];
        const blogTexts = await Promise.all(queries.slice(0, 12).map((q) => searchBlogText(q)));
        const corpus = `${blogTexts.join(' ')} ${ytTexts.join(' ')}`;

        for (const c of candidates) {
          const pattern = new RegExp(c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          c.mentionCount = (corpus.match(pattern) || []).length;
        }
        candidates.sort((a, b) => b.mentionCount - a.mentionCount);
        candidates = candidates.slice(0, 25);

        // ── Step 4: Gemini 코멘트 ──
        sendProgress(4, 5, '✨ AI가 장소별 매력 포인트를 정리하는 중...');

        let summary = candidates.length > 0 ? '추천 장소를 찾았어요.' : '조건에 맞는 장소를 찾지 못했어요. 반경을 넓히거나 키워드를 바꿔보세요.';
        if (hasGemini() && candidates.length > 0) {
          const list = candidates.map((c, i) => `${i}. ${c.name} (${c.category})`).join('\n');
          const parsed = await generateJson<{ summary?: string; places?: { index: number; reason?: string; keywords?: string[] }[] }>(
            `당신은 한국 데이트 코스 전문가입니다.
네이버 지도에서 찾은 장소 후보 ${candidates.length}곳이 있습니다.

후보 목록 (번호. 상호명 (카테고리)):
${list}

데이트 정보:
- 일정: ${describeSchedule(schedule)}
- 사용자 요청 키워드: ${searchKeyword || '없음'}

작업 지시:
1. 위 목록의 장소에 대해서만 작성하세요. 목록에 없는 장소를 지어내지 마세요. 각 항목은 번호(index)로 가리킵니다.
2. reason: 시그니처 메뉴, 볼거리, 독특한 체험 같은 핵심 특징을 1~2문장 개조식으로 짧게. 일정(계절·요일·시간대)과 키워드에 맞는 점이 있으면 반영하세요.
3. keywords: 장소를 표현하는 해시태그 2~3개.
4. summary: 전체 후보에 대한 데이트 한 줄 요약.

JSON으로만 응답:
{"summary":"...","places":[{"index":0,"reason":"...","keywords":["..."]}]}`
          );
          if (parsed) {
            summary = parsed.summary || summary;
            for (const p of parsed.places || []) {
              const c = candidates[p.index];
              if (!c) continue;
              c.reason = p.reason || '';
              c.keywords = Array.isArray(p.keywords) ? p.keywords.slice(0, 3) : [];
              c.sourceType = 'blog';
            }
          }
        }

        sendProgress(5, 5, '🎉 결과를 정리하는 중...');
        send({
          type: 'result',
          recommendations: candidates.map((c) => ({
            name: c.name,
            category: c.category,
            reason: c.reason || '',
            keywords: c.keywords || [],
            sourceType: c.sourceType || 'blog',
            address: c.address,
            roadAddress: c.roadAddress,
            mapx: c.mapx,
            mapy: c.mapy,
            link: c.link,
            mentionCount: c.mentionCount,
          })),
          events,
          summary,
        });
      } catch (err) {
        console.error('AI recommend error:', err);
        send({ type: 'error', message: '추천 생성 중 오류가 발생했습니다.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

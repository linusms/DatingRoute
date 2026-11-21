import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireUser } from '@/lib/session';
import { generateJson, hasGemini } from '@/lib/gemini';
import { regionNamesAround, searchLocal, type NaverPlace } from '@/lib/naver';
import { describeSchedule } from '@/lib/scheduleText';
import { getStraightLineDistance, katechToWgs84, parseCategoryToFacility } from '@/lib/utils';
import { DEFAULT_STAY_MINUTES, type AICourseDraft, type DateSchedule, type FacilityType } from '@/lib/types';

/*
 * POST /api/ai-course - drafts an ordered date course.
 * Real places come from Naver local search; Gemini only picks and orders them by index,
 * so it cannot invent places. Without Gemini a simple time-of-day heuristic is used.
 */

interface Candidate extends NaverPlace {
  facility: FacilityType;
  lat: number;
  lng: number;
}

function slotPlan(startTime: string, endTime: string): FacilityType[][] {
  const start = parseInt(startTime.slice(0, 2), 10) || 12;
  const end = parseInt(endTime.slice(0, 2), 10) || 21;
  const plan: FacilityType[][] = [];
  if (start <= 13) plan.push(['restaurant']);
  plan.push(['culture', 'park', 'entertainment', 'shopping']);
  plan.push(['cafe']);
  if (end - start >= 6) plan.push(['park', 'culture', 'shopping', 'entertainment']);
  if (end >= 18) plan.push(['restaurant']);
  if (end >= 21) plan.push(['bar']);
  return plan.slice(0, 6);
}

/** Fallback when Gemini is unavailable: follow the slot plan, picking the nearest unused candidate. */
function heuristicPick(candidates: Candidate[], startTime: string, endTime: string): { index: number; reason: string }[] {
  const picks: { index: number; reason: string }[] = [];
  const used = new Set<number>();
  let prev: Candidate | null = null;
  for (const slot of slotPlan(startTime, endTime)) {
    let best = -1;
    let bestDist = Infinity;
    candidates.forEach((c, i) => {
      if (used.has(i) || !slot.includes(c.facility)) return;
      const d = prev ? getStraightLineDistance(prev.lat, prev.lng, c.lat, c.lng) : 0;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (best >= 0) {
      used.add(best);
      prev = candidates[best];
      picks.push({ index: best, reason: '' });
    }
  }
  return picks;
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const theme = typeof body.theme === 'string' ? body.theme.trim().slice(0, 40) : '';
    const regionText = typeof body.region === 'string' ? body.region.trim().slice(0, 30) : '';
    const schedule: DateSchedule | null = body.schedule?.startDate ? body.schedule : null;
    const startTime = schedule?.startTime || (typeof body.startTime === 'string' ? body.startTime : '12:00');
    const endTime = schedule?.endTime || (typeof body.endTime === 'string' ? body.endTime : '21:00');
    const exclude = new Set<string>(Array.isArray(body.excludeTitles) ? body.excludeTitles.slice(0, 100) : []);

    // 지역: 입력한 지역 > 기준 좌표(코스 장소 또는 현재 위치) 주변
    const points: { lat: number; lng: number }[] = Array.isArray(body.points)
      ? body.points.slice(0, 5).map((p: { mapx: number; mapy: number }) => katechToWgs84(p.mapx, p.mapy))
      : [];
    let regions = regionText ? [regionText] : await regionNamesAround(points, 2);
    if (regions.length === 0) regions = ['서울'];
    const region = regions[0];

    const themed = theme ? `${theme} ` : '';
    const queries = [
      `${region} ${themed}맛집`, `${region} 데이트 맛집`, `${region} ${themed}카페`, `${region} 감성 카페`,
      `${region} 가볼만한곳`, `${region} 전시`, `${region} 산책`, `${region} ${themed}데이트`,
      `${region} 소품샵`, `${region} 와인바`,
    ];
    const found = (await Promise.all(queries.map((q) => searchLocal(q)))).flat();

    const candidates: Candidate[] = [];
    for (const item of found) {
      if (!item.name || exclude.has(item.name) || candidates.some((c) => c.name === item.name)) continue;
      const { lat, lng } = katechToWgs84(item.mapx, item.mapy);
      candidates.push({ ...item, facility: parseCategoryToFacility(item.category), lat, lng });
    }
    if (candidates.length < 3) {
      return NextResponse.json({ error: `'${region}' 주변에서 장소를 충분히 찾지 못했어요. 지역 이름을 바꿔보세요.` }, { status: 404 });
    }

    let title = `${region} ${theme || '데이트'} 코스`;
    let summary = '';
    let picks: { index: number; stayMinutes?: number; reason: string }[] = [];

    if (hasGemini()) {
      const list = candidates
        .map((c, i) => `${i}. ${c.name} | ${c.category} | ${c.roadAddress || c.address} | (${c.lat.toFixed(4)}, ${c.lng.toFixed(4)})`)
        .join('\n');
      const parsed = await generateJson<{ title?: string; summary?: string; items?: { index: number; stayMinutes?: number; reason?: string }[] }>(
        `당신은 한국 데이트 코스 플래너입니다. 아래 후보 장소 중에서 골라 하루 데이트 코스를 짜주세요.

조건:
- 지역: ${region}
- 테마/요청: ${theme || '없음'}
- 일정: ${describeSchedule(schedule)} (시간대 ${startTime}~${endTime})
- 4~6곳, 방문 순서대로. 점심(11~13시)·저녁(18~20시)엔 식당, 식사 뒤엔 카페나 산책처럼 자연스러운 흐름으로.
- 좌표를 보고 서로 가까운 곳끼리 이어서 이동 거리를 줄이세요.
- 반드시 아래 목록의 번호(index)만 쓰고, 목록에 없는 장소를 만들지 마세요.
- stayMinutes: 그곳에서 머무를 시간(분). reason: 이 순서에 넣은 이유 한 문장.

후보 (번호. 이름 | 카테고리 | 주소 | (위도, 경도)):
${list}

JSON으로만 응답:
{"title":"코스 이름","summary":"코스 한 줄 소개","items":[{"index":0,"stayMinutes":90,"reason":"..."}]}`
      );
      if (parsed?.items?.length) {
        const seen = new Set<number>();
        picks = parsed.items
          .filter((it) => Number.isInteger(it.index) && candidates[it.index] && !seen.has(it.index) && (seen.add(it.index), true))
          .slice(0, 6)
          .map((it) => ({ index: it.index, stayMinutes: it.stayMinutes, reason: it.reason || '' }));
        title = parsed.title?.slice(0, 60) || title;
        summary = parsed.summary?.slice(0, 200) || '';
      }
    }
    if (picks.length < 2) picks = heuristicPick(candidates, startTime, endTime);

    const draft: AICourseDraft = {
      title,
      summary,
      items: picks.map((p) => {
        const c = candidates[p.index];
        const stay = Number(p.stayMinutes);
        return {
          place: {
            id: randomUUID(),
            title: c.name,
            category: c.category,
            address: c.address,
            roadAddress: c.roadAddress,
            mapx: c.mapx,
            mapy: c.mapy,
            link: c.link,
            description: p.reason,
          },
          stayMinutes: Number.isFinite(stay) && stay > 0 && stay <= 600 ? Math.round(stay) : DEFAULT_STAY_MINUTES[c.facility] || 60,
          reason: p.reason,
        };
      }),
    };
    return NextResponse.json({ draft, usedAI: hasGemini() && picks.some((p) => p.reason) });
  } catch (err) {
    console.error('AI course error:', err);
    return NextResponse.json({ error: '코스 초안을 만들지 못했습니다.' }, { status: 500 });
  }
}

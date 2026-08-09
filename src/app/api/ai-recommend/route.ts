import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { katechToWgs84, getStraightLineDistance } from '@/lib/utils';

// 카테고리 ID → 한국어 라벨 매핑
const CATEGORY_LABELS: Record<string, string> = {
  restaurant: '맛집',
  cafe: '카페',
  activity: '핫플',
  accommodation: '펜션',
};

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const {
    places = [],
    centerPlace = null,
    radiusKm = 5,
    categories = ['restaurant', 'cafe', 'activity', 'accommodation'],
    excludePlaces = [],
    schedule,
  } = body;

  const radiusMeters = (radiusKm || 5) * 1000;

  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (step: number, total: number, message: string) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'progress', step, total, message })}\n\n`)
        );
      };

      try {
        const naverClientId = process.env.NAVER_CLIENT_ID;
        const naverClientSecret = process.env.NAVER_CLIENT_SECRET;
        const ncpClientId = process.env.NEXT_PUBLIC_NCP_CLIENT_ID;
        const ncpClientSecret = process.env.NCP_CLIENT_SECRET;
        const youtubeKey = process.env.YOUTUBE_API_KEY;
        const tourApiKey = process.env.TOUR_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;

        // ── Step 1: 지역(Region) 추출 및 한국관광공사 행사 ──
        sendProgress(1, 5, '🔍 기준 지역 탐색 및 축제 정보 조회 중...');

        const regions = new Set<string>();
        const geocodeTargets = centerPlace ? [centerPlace] : places.slice(0, 5);

        if (geocodeTargets.length > 0 && ncpClientId && ncpClientSecret) {
          const rgPromises = geocodeTargets.map(async (place: any) => {
            try {
              const mapx = typeof place.mapx === 'string' ? parseFloat(place.mapx) : place.mapx;
              const mapy = typeof place.mapy === 'string' ? parseFloat(place.mapy) : place.mapy;
              const lng = mapx > 1000 ? mapx / 10_000_000 : mapx;
              const lat = mapy > 1000 ? mapy / 10_000_000 : mapy;

              const rgUrl = `https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&output=json&orders=admcode`;
              const rgRes = await fetch(rgUrl, {
                headers: {
                  'x-ncp-apigw-api-key-id': ncpClientId,
                  'x-ncp-apigw-api-key': ncpClientSecret,
                },
              });
              if (rgRes.ok) {
                const rgData = await rgRes.json();
                const result = rgData?.results?.[0];
                if (result?.region) {
                  const area1 = result.region.area1?.name || '';
                  const area2 = result.region.area2?.name || '';
                  return { area1, area2: `${area1} ${area2}` };
                }
              }
            } catch {}
            return null;
          });

          const rgResults = await Promise.all(rgPromises);
          rgResults.forEach(r => {
            if (r?.area1) regions.add(r.area1);
            if (r?.area2) regions.add(r.area2);
          });
        }

        const tourEvents: any[] = [];
        if (tourApiKey && tourApiKey !== 'your_tour_api_key' && schedule?.startDate) {
          const startDate = schedule.startDate.replace(/-/g, '');
          const endDate = (schedule.endDate || schedule.startDate).replace(/-/g, '');
          try {
            const url = new URL('http://apis.data.go.kr/B551011/KorService2/searchFestival2');
            url.searchParams.set('serviceKey', tourApiKey);
            url.searchParams.set('MobileOS', 'AND');
            url.searchParams.set('MobileApp', 'DatingRoute');
            url.searchParams.set('_type', 'json');
            url.searchParams.set('eventStartDate', startDate);
            url.searchParams.set('eventEndDate', endDate);
            url.searchParams.set('numOfRows', '15');
            url.searchParams.set('pageNo', '1');
            url.searchParams.set('arrange', 'C');

            const abortCtrl = new AbortController();
            const timer = setTimeout(() => abortCtrl.abort(), 3500);
            const res = await fetch(url.toString(), { signal: abortCtrl.signal });
            clearTimeout(timer);

            if (res.ok) {
              const data = await res.json();
              let items = data?.response?.body?.items?.item;
              if (items && !Array.isArray(items)) items = [items];
              if (items && Array.isArray(items)) {
                const regionArr = Array.from(regions);
                for (const item of items) {
                  const addr = item.addr1 || '';
                  const matchesRegion = regionArr.length === 0 || regionArr.some(r => addr.includes(r.split(' ')[0]));
                  if (matchesRegion) {
                    tourEvents.push({
                      contentId: String(item.contentid || ''),
                      title: item.title || '',
                      address: item.addr1 || '',
                      imageUrl: item.firstimage || item.firstimage2 || '',
                      startDate: item.eventstartdate || startDate,
                      endDate: item.eventenddate || endDate,
                      tel: item.tel || '',
                      mapx: parseFloat(item.mapx) || 0,
                      mapy: parseFloat(item.mapy) || 0,
                      category: item.cat2 || item.cat1 || '행사',
                    });
                  }
                }
              }
            }
          } catch {}
        }

        const regionNames = Array.from(regions).filter(r => r.includes(' ')).map(r => r.split(' ')[1]) || [];
        if (regionNames.length === 0 && regions.size > 0) {
          regionNames.push(...Array.from(regions));
        }
        const uniqueRegions = Array.from(new Set(regionNames));
        if (uniqueRegions.length === 0) uniqueRegions.push('서울');

        // ── Step 2: Naver Local API를 통한 장소 대량 확보 (DB First) ──
        sendProgress(2, 5, '🗺️ 해당 지역의 관련 장소 대량 검색 중...');

        const categorySearchTerms = categories.map((c: string) => CATEGORY_LABELS[c] || c);
        const searchTargets = uniqueRegions.slice(0, 2).flatMap((r) =>
          categorySearchTerms.map((term: string) => `${r} ${term}`)
        );

        let basePlaces: any[] = [];
        if (naverClientId && naverClientSecret) {
          const localPromises = searchTargets.map(async (target: string) => {
            try {
              // 각 검색어 당 15개 요청
              const searchUrl = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(target)}&display=15&sort=random`;
              const searchRes = await fetch(searchUrl, {
                headers: {
                  'X-Naver-Client-Id': naverClientId,
                  'X-Naver-Client-Secret': naverClientSecret,
                },
              });
              if (searchRes.ok) {
                const sData = await searchRes.json();
                return sData.items || [];
              }
            } catch {}
            return [];
          });
          const results = await Promise.all(localPromises);
          
          results.flat().forEach((item: any) => {
            const cleanTitle = (item.title || '').replace(/<[^>]+>/g, '');
            // 중복 제거 및 기존 코스에 있는 장소(excludePlaces 포함) 제거
            const existingCoursePlaces = places.map((p: any) => p.title.replace(/<[^>]+>/g, ''));
            const isExcluded = [...existingCoursePlaces, ...excludePlaces].includes(cleanTitle);
            
            if (!isExcluded && !basePlaces.some(p => p.name === cleanTitle)) {
              basePlaces.push({
                name: cleanTitle,
                category: item.category || '',
                address: item.address || '',
                roadAddress: item.roadAddress || '',
                mapx: parseInt(item.mapx, 10) || 0,
                mapy: parseInt(item.mapy, 10) || 0,
                link: item.link || '',
                mentionCount: 0,
              });
            }
          });
        }

        // 반경 필터링 적용 (basePlaces 추리기)
        const filterCenter = centerPlace ? [centerPlace] : places;
        if (filterCenter.length > 0) {
          basePlaces = basePlaces.filter((recPlace: any) => {
            const { lng: recLng, lat: recLat } = katechToWgs84(recPlace.mapx, recPlace.mapy);
            return filterCenter.some((coursePlace: any) => {
              const { lng: courseLng, lat: courseLat } = katechToWgs84(coursePlace.mapx, coursePlace.mapy);
              const distance = getStraightLineDistance(recLat, recLng, courseLat, courseLng);
              return distance <= radiusMeters;
            });
          });
        }

        // 최대 30개까지만 추림 (AI API 부하 및 토큰 초과 방지)
        basePlaces = basePlaces.slice(0, 30);

        // ── Step 3: Blog & YouTube 검색으로 SNS 언급량 산출 ──
        sendProgress(3, 5, '📱 장소별 SNS 및 YouTube 언급량 분석 중...');

        let blogTextBlob = '';
        let ytTextBlob = '';

        const blogPromises = (naverClientId && naverClientSecret) ? searchTargets.map(async (target: string) => {
          try {
            const blogUrl = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(target)}&display=10&sort=sim`;
            const res = await fetch(blogUrl, { headers: { 'X-Naver-Client-Id': naverClientId, 'X-Naver-Client-Secret': naverClientSecret } });
            if (res.ok) {
              const bd = await res.json();
              return bd.items.map((b: any) => b.title + ' ' + b.description).join(' ');
            }
          } catch {}
          return '';
        }) : [];

        const ytTargets = uniqueRegions.slice(0, 2).map((r) => `${r} 데이트 핫플`);
        const ytPromises = (youtubeKey && youtubeKey !== 'your_youtube_api_key') ? ytTargets.map(async (target: string) => {
          try {
            const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(target)}&type=video&key=${youtubeKey}&relevanceLanguage=ko`;
            const res = await fetch(ytUrl);
            if (res.ok) {
              const yd = await res.json();
              return yd.items.map((v: any) => v.snippet?.title + ' ' + v.snippet?.description).join(' ');
            }
          } catch {}
          return '';
        }) : [];

        const [blogContents, ytContents] = await Promise.all([Promise.all(blogPromises), Promise.all(ytPromises)]);
        blogTextBlob = blogContents.join(' ').replace(/<[^>]+>/g, '');
        ytTextBlob = ytContents.join(' ').replace(/<[^>]+>/g, '');

        // 언급 횟수 계산 (단순 문자열 포함 횟수)
        basePlaces.forEach(place => {
          const nameMatch = new RegExp(place.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          const blogHits = (blogTextBlob.match(nameMatch) || []).length;
          const ytHits = (ytTextBlob.match(nameMatch) || []).length;
          place.mentionCount = blogHits + ytHits;
          // 약간의 랜덤 가중치를 주어 동일 카운트일 때 순서 믹스
          place.mentionCount += Math.floor(Math.random() * 2);
        });

        // 언급량 기준으로 상위 25개로 제한
        basePlaces.sort((a, b) => b.mentionCount - a.mentionCount);
        basePlaces = basePlaces.slice(0, 25);

        // ── Step 4: Gemini AI에게 리스트 검토 및 코멘트 달기 요청 ──
        sendProgress(4, 5, '✨ AI가 선정된 장소들의 매력 포인트를 작성 중...');

        let recommendations = basePlaces;
        let summary = '추천 장소 검색이 완료되었습니다!';

        if (geminiKey && geminiKey !== 'your_gemini_api_key' && basePlaces.length > 0) {
          try {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({
              model: 'gemini-2.5-flash',
              generationConfig: { responseMimeType: 'application/json' },
            });

            const placeListText = basePlaces.map(p => `- ${p.name} (카테고리: ${p.category})`).join('\n');

            const prompt = `당신은 한국 데이트 코스 전문가입니다.
내가 시스템(네이버 지도 API)을 통해 현재 데이트 조건에 맞는 핫플레이스 ${basePlaces.length}곳을 찾았습니다.

찾은 장소 목록:
${placeListText}

작업 지시:
1. 위 목록에 있는 장소들에 대해서만 응답을 생성하세요. 새로운 장소를 임의로 지어내지 마세요.
2. 각 장소마다 이 시기에 데이트하기 좋은 '매력적인 이유(1문장)'를 작성해주세요.
3. 각 장소를 표현하는 트렌디한 '해시태그 키워드(2~3개)'를 생성해주세요.
4. 모든 장소들에 대한 전반적인 데이트 코스 요약 멘트(summary)를 1문장 작성해주세요.

반드시 아래 JSON 스키마로만 응답하세요:
{
  "summary": "전체 요약 멘트",
  "places": [
    {
      "name": "목록에 있는 정확한 상호명",
      "reason": "추천 이유 1문장",
      "keywords": ["키워드1", "키워드2"],
      "sourceType": "blog"
    }
  ]
}`;
            let text = '';
            try {
              const result = await model.generateContent(prompt);
              text = result.response.text();
            } catch (error: any) {
              if (error?.message?.includes('503') || error?.status === 503) {
                const fallbackModel = genAI.getGenerativeModel({
                  model: 'gemini-1.5-flash',
                  generationConfig: { responseMimeType: 'application/json' },
                });
                const fallbackResult = await fallbackModel.generateContent(prompt);
                text = fallbackResult.response.text();
              } else {
                throw error;
              }
            }

            let parsed: any = {};
            try {
              parsed = JSON.parse(text);
            } catch {
              parsed = { summary: '', places: [] };
            }

            summary = parsed.summary || summary;

            // AI가 응답한 이유와 키워드를 기존 basePlaces에 병합
            if (parsed.places && Array.isArray(parsed.places)) {
              recommendations = basePlaces.map(bp => {
                const aiData = parsed.places.find((ap: any) => ap.name === bp.name);
                if (aiData) {
                  return {
                    ...bp,
                    reason: aiData.reason || '',
                    keywords: aiData.keywords || [],
                    sourceType: aiData.sourceType || 'blog',
                  };
                }
                return bp;
              });
            }
          } catch (err) {
            console.error('Gemini error:', err);
          }
        }

        sendProgress(5, 5, '🎉 추천 결과 정리 중...');

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'result',
            recommendations,
            events: tourEvents,
            summary,
          })}\n\n`)
        );
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: '추천 생성 중 오류가 발생했습니다.' })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}

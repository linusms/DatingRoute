import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { places = [], excludePlaces = [], schedule } = body;

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

        // ── Step 1: Parallel Reverse-Geocoding & TourAPI ──
        sendProgress(1, 4, '🔍 한국관광공사 주변 축제 및 행사 정보 조회 중...');

        const regions = new Set<string>();

        // Run all reverse-geocodes in parallel
        if (places.length > 0 && ncpClientId && ncpClientSecret) {
          const rgPromises = places.slice(0, 5).map(async (place: any) => {
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
            } catch {
              // ignore
            }
            return null;
          });

          const rgResults = await Promise.all(rgPromises);
          rgResults.forEach(r => {
            if (r?.area1) regions.add(r.area1);
            if (r?.area2) regions.add(r.area2);
          });
        }

        // TourAPI fetch with 3.5s timeout abort controller & optimized payload (numOfRows=15)
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
          } catch (err) {
            console.error('TourAPI error / timeout:', err);
          }
        }

        // ── Step 2 & Step 3: Parallel Naver Blog & YouTube Searches ──
        sendProgress(2, 4, '📝 네이버 블로그 데이트 핫플 & 팝업 추천 수집 중...');

        const blogData: Record<string, any[]> = {};
        const ytData: Record<string, any[]> = {};

        const searchTargets = places.length > 0
          ? places.slice(0, 4).map((p: any) => (p.title || '').replace(/<[^>]+>/g, ''))
          : ['서울 데이트 팝업스토어', '성수 데이트 핫플', '홍대 데이트 코스'];

        const ytTargets = places.length > 0
          ? places.slice(0, 3).map((p: any) => (p.title || '').replace(/<[^>]+>/g, ''))
          : ['서울 데이트 코스 추천', '핫플레이스 팝업스토어'];

        // Blog Promises
        const blogPromises = (naverClientId && naverClientSecret) ? searchTargets.map(async (target: string) => {
          try {
            const blogUrl = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(target + ' 팝업 핫플 데이트')}&display=5&sort=sim`;
            const blogRes = await fetch(blogUrl, {
              headers: {
                'X-Naver-Client-Id': naverClientId,
                'X-Naver-Client-Secret': naverClientSecret,
              },
            });
            if (blogRes.ok) {
              const bd = await blogRes.json();
              return {
                target,
                items: (bd.items || []).map((b: any) => ({
                  title: (b.title || '').replace(/<[^>]+>/g, ''),
                  description: (b.description || '').replace(/<[^>]+>/g, ''),
                  link: b.link || '',
                })),
              };
            }
          } catch {}
          return { target, items: [] };
        }) : [];

        // YouTube Promises
        const ytPromises = (youtubeKey && youtubeKey !== 'your_youtube_api_key') ? ytTargets.map(async (target: string) => {
          try {
            const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${encodeURIComponent(target + ' 데이트 핫플')}&type=video&key=${youtubeKey}&relevanceLanguage=ko`;
            const ytRes = await fetch(ytUrl);
            if (ytRes.ok) {
              const yd = await ytRes.json();
              return {
                target,
                items: (yd.items || []).map((v: any) => ({
                  title: v.snippet?.title || '',
                  channelTitle: v.snippet?.channelTitle || '',
                  url: `https://www.youtube.com/watch?v=${v.id?.videoId}`,
                })),
              };
            }
          } catch {}
          return { target, items: [] };
        }) : [];

        // Execute all Blog & YouTube searches in parallel
        const [blogResults, ytResults] = await Promise.all([
          Promise.all(blogPromises),
          Promise.all(ytPromises),
        ]);

        sendProgress(3, 4, '▶️ YouTube 데이트 영상 & 팝업 추천 수집 완료!');

        blogResults.forEach(b => {
          if (b?.target && b.items.length > 0) blogData[b.target] = b.items;
        });
        ytResults.forEach(y => {
          if (y?.target && y.items.length > 0) ytData[y.target] = y.items;
        });

        // ── Step 4: Gemini AI Synthesis & Parallel Place Mapping ──
        sendProgress(4, 4, '✨ Gemini AI로 종합 분석 및 핵심 요약 생성 중...');

        let recommendations: any[] = [];
        let summary = '';

        if (geminiKey && geminiKey !== 'your_gemini_api_key') {
          try {
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({
              model: 'gemini-2.5-flash',
              generationConfig: { responseMimeType: 'application/json' },
            });

            const placeNames = places.map((p: any) => (p.title || '').replace(/<[^>]+>/g, ''));
            const regionList = Array.from(regions).join(', ') || '서울/수도권';
            
            let blogContext = '';
            for (const [name, blogs] of Object.entries(blogData)) {
              if (blogs.length > 0) {
                blogContext += `\n[${name} 관련 블로그 검색 결과]\n`;
                blogs.forEach((b: any) => {
                  blogContext += `- ${b.title}: ${b.description.slice(0, 100)}\n`;
                });
              }
            }

            let ytContext = '';
            for (const [name, vids] of Object.entries(ytData)) {
              if (vids.length > 0) {
                ytContext += `\n[${name} 관련 YouTube 검색 결과]\n`;
                vids.forEach((v: any) => {
                  ytContext += `- ${v.title} (${v.channelTitle})\n`;
                });
              }
            }

            let eventContext = '';
            if (tourEvents.length > 0) {
              eventContext = '\n[한국관광공사 등록 행사/축제]\n';
              tourEvents.slice(0, 8).forEach(e => {
                eventContext += `- ${e.title} (${e.address})\n`;
              });
            }

            const dateRange = schedule?.startDate
              ? `${schedule.startDate} ~ ${schedule.endDate || schedule.startDate}`
              : '미정';

            const prompt = `당신은 한국 데이트 장소 및 핫플레이스 전문가입니다.

선택된 데이트 지역/장소: ${placeNames.length > 0 ? placeNames.join(', ') : regionList}
데이트 예정 기간: ${dateRange}

수집된 데이터:
${blogContext}
${ytContext}
${eventContext}

위 정보를 종합하여:
1. 유튜브, 블로그, 주변 축제 정보를 바탕으로 이 시기에 데이트하기 좋은 핫플레이스, 팝업스토어, 추천 장소를 최대 10곳 제안해주세요. (맛집, 문화장소, 카페 카테고리별로 골고루 추천해주세요.)
2. 사용자가 이미 코스에 추가한 다음 장소들은 추천 목록에서 반드시 제외해주세요: [${[...placeNames, ...excludePlaces].join(', ')}]
3. 각 장소마다 출처(유튜브 인기/블로그 핫플/팝업 행사/축제 등) 및 핵심 추천 이유를 작성해주세요.
4. 각 장소의 'category'는 반드시 "맛집", "문화장소", "카페" 중 하나로 분류해주세요.
5. 각 추천 이유를 표현하는 2~3개의 간략한 키워드 태그를 생성해주세요.
6. 전체 데이트 코스에 대한 매력적인 한 줄 요약 멘트를 작성해주세요.

반드시 아래 JSON 스키마로만 응답하세요:
{
  "summary": "전체 코스 한 줄 요약",
  "places": [
    {
      "name": "정확한 실제 장소명 또는 상호명",
      "category": "맛집 / 문화장소 / 카페 중 택1",
      "reason": "추천 이유 1문장 (유튜브/블로그/팝업 출처 언급)",
      "keywords": ["키워드1", "키워드2", "키워드3"],
      "sourceType": "youtube / blog / event / popup 중 택1"
    }
  ]
}`;

            let text = '';
            try {
              const result = await model.generateContent(prompt);
              text = result.response.text();
            } catch (error: any) {
              if (error?.message?.includes('503') || error?.status === 503) {
                console.warn('Gemini 3.6-flash is overloaded (503). Falling back to gemini-1.5-flash.');
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

            summary = parsed.summary || 'Gemini AI 추천이 완성되었습니다!';

            // Parallel Naver Local Searches for all recommended places
            if (parsed.places && naverClientId && naverClientSecret) {
              const placeSearchPromises = parsed.places.map(async (p: any) => {
                try {
                  const searchUrl = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(p.name)}&display=1`;
                  const searchRes = await fetch(searchUrl, {
                    headers: {
                      'X-Naver-Client-Id': naverClientId,
                      'X-Naver-Client-Secret': naverClientSecret,
                    },
                  });
                  if (searchRes.ok) {
                    const sData = await searchRes.json();
                    if (sData.items && sData.items.length > 0) {
                      const item = sData.items[0];
                      return {
                        name: (item.title || '').replace(/<[^>]+>/g, ''),
                        reason: p.reason || '',
                        keywords: p.keywords || [],
                        sourceType: p.sourceType || 'blog',
                        category: p.category || item.category || '',
                        address: item.address || '',
                        roadAddress: item.roadAddress || '',
                        mapx: parseInt(item.mapx, 10) || 0,
                        mapy: parseInt(item.mapy, 10) || 0,
                        link: item.link || '',
                      };
                    }
                  }
                } catch {
                  // skip
                }
                return null;
              });

              const resolvedPlaces = await Promise.all(placeSearchPromises);
              recommendations = resolvedPlaces.filter(Boolean);
            }
          } catch (err) {
            console.error('Gemini error:', err);
            summary = 'AI 추천을 분석하는 중 일부 오류가 있었지만 수집된 정보를 정리했습니다.';
          }
        }

        // Send final result
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

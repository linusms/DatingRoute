import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { places, schedule } = body;
    // places: Array<{ title, address, roadAddress, mapx, mapy }>
    // schedule: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD', startTime, endTime }

    if (!places || places.length === 0) {
      return Response.json({ error: '장소를 1개 이상 추가해주세요.' }, { status: 400 });
    }

    const naverClientId = process.env.NAVER_CLIENT_ID;
    const naverClientSecret = process.env.NAVER_CLIENT_SECRET;
    const ncpClientId = process.env.NEXT_PUBLIC_NCP_CLIENT_ID;
    const ncpClientSecret = process.env.NCP_CLIENT_SECRET;
    const youtubeKey = process.env.YOUTUBE_API_KEY;
    const tourApiKey = process.env.TOUR_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    // ── 1. Reverse-geocode to extract region names ──
    const regions = new Set<string>();
    if (ncpClientId && ncpClientSecret) {
      for (const place of places.slice(0, 5)) {
        try {
          // Convert Naver katech coords to WGS84
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
              const r = result.region;
              // Extract 시/도 + 시/군/구
              const area1 = r.area1?.name || '';
              const area2 = r.area2?.name || '';
              if (area1) regions.add(area1);
              if (area2) regions.add(`${area1} ${area2}`);
            }
          }
        } catch {
          // skip
        }
      }
    }

    // ── 2. TourAPI: Search festivals/events in the region ──
    const tourEvents: any[] = [];
    if (tourApiKey && tourApiKey !== 'your_tour_api_key' && schedule) {
      const startDate = schedule.startDate.replace(/-/g, '');
      const endDate = schedule.endDate.replace(/-/g, '');
      
      try {
        const url = new URL('http://apis.data.go.kr/B551011/KorService2/searchFestival2');
        url.searchParams.set('serviceKey', tourApiKey);
        url.searchParams.set('MobileOS', 'AND');
        url.searchParams.set('MobileApp', 'DatingRoute');
        url.searchParams.set('_type', 'json');
        url.searchParams.set('eventStartDate', startDate);
        url.searchParams.set('eventEndDate', endDate);
        url.searchParams.set('numOfRows', '30');
        url.searchParams.set('pageNo', '1');
        url.searchParams.set('arrange', 'C');

        const res = await fetch(url.toString());
        if (res.ok) {
          const data = await res.json();
          let items = data?.response?.body?.items?.item;
          if (items && !Array.isArray(items)) items = [items];
          if (items && Array.isArray(items)) {
            // Filter by region
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
        console.error('TourAPI error:', err);
      }
    }

    // ── 3. Naver Blog search for each place ──
    const blogData: Record<string, any[]> = {};
    if (naverClientId && naverClientSecret) {
      for (const place of places.slice(0, 5)) {
        const name = (place.title || '').replace(/<[^>]+>/g, '');
        try {
          const blogUrl = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(name + ' 데이트')}&display=3&sort=sim`;
          const blogRes = await fetch(blogUrl, {
            headers: {
              'X-Naver-Client-Id': naverClientId,
              'X-Naver-Client-Secret': naverClientSecret,
            },
          });
          if (blogRes.ok) {
            const bd = await blogRes.json();
            blogData[name] = (bd.items || []).map((b: any) => ({
              title: (b.title || '').replace(/<[^>]+>/g, ''),
              description: (b.description || '').replace(/<[^>]+>/g, ''),
            }));
          }
        } catch {
          // skip
        }
      }
    }

    // ── 4. YouTube search for each place ──
    const ytData: Record<string, any[]> = {};
    if (youtubeKey && youtubeKey !== 'your_youtube_api_key') {
      for (const place of places.slice(0, 3)) {
        const name = (place.title || '').replace(/<[^>]+>/g, '');
        try {
          const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=3&q=${encodeURIComponent(name + ' 데이트 코스')}&type=video&key=${youtubeKey}&relevanceLanguage=ko`;
          const ytRes = await fetch(ytUrl);
          if (ytRes.ok) {
            const yd = await ytRes.json();
            ytData[name] = (yd.items || []).map((v: any) => ({
              title: v.snippet?.title || '',
              channelTitle: v.snippet?.channelTitle || '',
            }));
          }
        } catch {
          // skip
        }
      }
    }

    // ── 5. Gemini AI: synthesize all data into recommendations ──
    const recommendations: any[] = [];
    let summary = '';

    if (geminiKey && geminiKey !== 'your_gemini_api_key') {
      try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: { responseMimeType: 'application/json' },
        });

        const placeNames = places.map((p: any) => (p.title || '').replace(/<[^>]+>/g, ''));
        const regionList = Array.from(regions).join(', ') || '서울';
        
        // Build context about each place
        let blogContext = '';
        for (const [name, blogs] of Object.entries(blogData)) {
          if (blogs.length > 0) {
            blogContext += `\n[${name} 블로그 리뷰]\n`;
            blogs.forEach((b: any) => {
              blogContext += `- ${b.title}: ${b.description.slice(0, 100)}\n`;
            });
          }
        }

        let ytContext = '';
        for (const [name, vids] of Object.entries(ytData)) {
          if (vids.length > 0) {
            ytContext += `\n[${name} YouTube]\n`;
            vids.forEach((v: any) => {
              ytContext += `- ${v.title} (${v.channelTitle})\n`;
            });
          }
        }

        let eventContext = '';
        if (tourEvents.length > 0) {
          eventContext = '\n[해당 지역 행사/축제]\n';
          tourEvents.slice(0, 10).forEach(e => {
            eventContext += `- ${e.title} (${e.address})\n`;
          });
        }

        const dateRange = schedule
          ? `${schedule.startDate} ~ ${schedule.endDate} (${schedule.startTime} ~ ${schedule.endTime})`
          : '미정';

        const prompt = `당신은 한국 데이트 코스 전문가입니다. 
사용자가 다음 장소들을 데이트 코스로 선택했습니다:
${placeNames.map((n: string, i: number) => `${i + 1}. ${n}`).join('\n')}

지역: ${regionList}
데이트 일정: ${dateRange}

아래는 각 장소에 대한 블로그 리뷰, YouTube 영상, 그리고 해당 지역 행사 정보입니다:
${blogContext}
${ytContext}
${eventContext}

위 정보를 종합하여:
1. 사용자가 선택한 장소들 근처에서 추가로 가볼 만한 데이트 장소 3~5곳을 추천해주세요
2. 각 장소마다 추천 이유를 2~3개의 핵심 키워드로 정리해주세요
3. 해당 기간에 열리는 이벤트나 축제가 있다면 반드시 포함해주세요
4. 전체 코스에 대한 한 줄 요약 멘트를 작성해주세요

반드시 아래 JSON 형식으로만 응답해주세요:
{
  "summary": "전체 코스에 대한 한 줄 요약 (특수문자/마크다운 없이)",
  "places": [
    {
      "name": "정확한 상호명 또는 장소명",
      "reason": "추천 이유 1문장",
      "keywords": ["키워드1", "키워드2", "키워드3"],
      "type": "맛집/카페/핫플/행사/축제/전시/관광 중 택1"
    }
  ]
}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { summary: '', places: [] };
        }

        summary = parsed.summary || '';

        // Resolve each recommended place via Naver local search
        if (parsed.places && naverClientId && naverClientSecret) {
          for (const p of parsed.places) {
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
                  recommendations.push({
                    name: (item.title || '').replace(/<[^>]+>/g, ''),
                    reason: p.reason || '',
                    keywords: p.keywords || [],
                    category: item.category || p.type || '',
                    address: item.address || '',
                    roadAddress: item.roadAddress || '',
                    mapx: parseInt(item.mapx, 10) || 0,
                    mapy: parseInt(item.mapy, 10) || 0,
                    link: item.link || '',
                  });
                }
              }
            } catch {
              // skip
            }
          }
        }
      } catch (err) {
        console.error('Gemini error:', err);
        summary = '추천을 생성하는 중 오류가 발생했습니다.';
      }
    } else {
      summary = 'Gemini API 키를 설정하면 AI 추천 기능을 사용할 수 있습니다.';
    }

    return Response.json({
      recommendations,
      events: tourEvents,
      summary,
      regions: Array.from(regions),
    });
  } catch (err) {
    console.error('AI Recommend error:', err);
    return Response.json(
      { error: 'AI 추천을 생성하는 중 오류가 발생했습니다.', detail: String(err) },
      { status: 500 }
    );
  }
}

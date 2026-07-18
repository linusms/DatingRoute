import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET(request: NextRequest) {
  const startDate = request.nextUrl.searchParams.get('startDate'); // YYYYMMDD
  const endDate = request.nextUrl.searchParams.get('endDate');     // YYYYMMDD

  if (!startDate || !endDate) {
    return Response.json(
      { error: 'startDate and endDate (YYYYMMDD) are required' },
      { status: 400 }
    );
  }

  const tourApiKey = process.env.TOUR_API_KEY;
  const events: any[] = [];
  let tourApiUsed = false;

  // 1. Try TourAPI (한국관광공사) if key is available
  if (tourApiKey && tourApiKey !== 'your_tour_api_key') {
    try {
      const url = new URL('https://apis.data.go.kr/B551011/KorService1/searchFestival1');
      url.searchParams.set('serviceKey', tourApiKey);
      url.searchParams.set('MobileOS', 'ETC');
      url.searchParams.set('MobileApp', 'DatingRoute');
      url.searchParams.set('_type', 'json');
      url.searchParams.set('eventStartDate', startDate);
      url.searchParams.set('eventEndDate', endDate);
      url.searchParams.set('numOfRows', '20');
      url.searchParams.set('pageNo', '1');
      url.searchParams.set('listYN', 'Y');
      url.searchParams.set('arrange', 'A'); // Sort by title

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        const items = data?.response?.body?.items?.item;
        if (items && Array.isArray(items)) {
          tourApiUsed = true;
          for (const item of items) {
            events.push({
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
        } else if (items && typeof items === 'object') {
          // Single item returned as object instead of array
          tourApiUsed = true;
          events.push({
            contentId: String(items.contentid || ''),
            title: items.title || '',
            address: items.addr1 || '',
            imageUrl: items.firstimage || items.firstimage2 || '',
            startDate: items.eventstartdate || startDate,
            endDate: items.eventenddate || endDate,
            tel: items.tel || '',
            mapx: parseFloat(items.mapx) || 0,
            mapy: parseFloat(items.mapy) || 0,
            category: items.cat2 || items.cat1 || '행사',
          });
        }
      }
    } catch (err) {
      console.error('TourAPI error:', err);
    }
  }

  // 2. Gemini AI fallback/supplement for trend recommendations
  let trendPlaces: any[] = [];
  const geminiKey = process.env.GEMINI_API_KEY;

  if (geminiKey && geminiKey !== 'your_gemini_api_key') {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { responseMimeType: 'application/json' },
      });

      // Convert YYYYMMDD to readable date
      const sd = `${startDate.slice(0, 4)}년 ${parseInt(startDate.slice(4, 6))}월 ${parseInt(startDate.slice(6, 8))}일`;
      const ed = `${endDate.slice(0, 4)}년 ${parseInt(endDate.slice(4, 6))}월 ${parseInt(endDate.slice(6, 8))}일`;

      const prompt = `당신은 한국 데이트 장소 전문가입니다. ${sd} ~ ${ed} 기간에 갈 만한 데이트 장소를 추천해주세요.

다음 조건을 반영해주세요:
- 해당 시기에 진행 중인 축제, 전시회, 팝업스토어 등 특별 이벤트가 있는 곳
- 계절감을 반영한 핫플레이스 (예: 여름이면 수영장/워터파크, 겨울이면 스키/눈꽃축제)
- 최근 SNS에서 화제가 되는 인기 장소
- 서울/수도권 위주로 3~5곳

반드시 아래 JSON 형식으로만 응답해주세요:
{
  "places": [
    {
      "name": "정확한 장소 상호명",
      "reason": "이 장소를 추천하는 이유 (1~2문장)",
      "type": "행사/전시/핫플/축제/팝업 중 택1"
    }
  ]
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { places: [] };
      }

      // Search each recommended place via Naver to get real coordinates
      const naverClientId = process.env.NAVER_CLIENT_ID;
      const naverClientSecret = process.env.NAVER_CLIENT_SECRET;

      if (naverClientId && naverClientSecret && parsed.places) {
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
                trendPlaces.push({
                  title: item.title,
                  reason: p.reason,
                  category: item.category || p.type,
                  address: item.address,
                  roadAddress: item.roadAddress,
                  mapx: parseInt(item.mapx, 10),
                  mapy: parseInt(item.mapy, 10),
                  link: item.link || '',
                });
              }
            }
          } catch {
            // Skip this place on error
          }
        }
      }
    } catch (err) {
      console.error('Gemini trends error:', err);
    }
  }

  return Response.json({
    events,
    trendPlaces,
    tourApiUsed,
    dateRange: { startDate, endDate },
  });
}

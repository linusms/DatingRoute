import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET(request: NextRequest) {
  const placeTitle = request.nextUrl.searchParams.get('place');
  const category = request.nextUrl.searchParams.get('category');

  if (!placeTitle) {
    return Response.json({ error: 'place parameter is required' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key') {
    return Response.json({ recommendation: 'Gemini API 키를 설정하면 연관 장소를 추천해드려요!', places: [] });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `사용자가 방금 "${placeTitle}"(${category})라는 장소를 데이트 장소로 검색했습니다. 
이 장소 주변에서 다음 코스로 가기 좋은 '정확한 실제 장소(상호명이나 명소 이름)' 1~2곳을 추천해 주세요. 
가급적 근처에서 현재 진행 중인 이벤트가 있거나 사람들에게 많이 언급되는 핫플레이스 위주로 제안해 주시면 좋습니다.

반드시 아래 JSON 스키마를 엄격히 준수하여 응답해 주세요:
{
  "summary": "추천 장소들과 그 이유를 2~3문장으로 자연스럽고 매력적인 평문(특수문자나 볼드체 없이)으로 작성한 요약 멘트",
  "places": ["정확한 상호명1", "정확한 상호명2"]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    let jsonResp;
    try {
      jsonResp = JSON.parse(text);
    } catch {
      return Response.json({ recommendation: text, places: [] });
    }

    const naverClientId = process.env.NAVER_CLIENT_ID;
    const naverClientSecret = process.env.NAVER_CLIENT_SECRET;
    const finalPlaces: unknown[] = [];

    if (naverClientId && naverClientSecret && jsonResp.places && Array.isArray(jsonResp.places)) {
      for (const pName of jsonResp.places) {
        try {
           const searchUrl = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(pName)}&display=1`;
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
                finalPlaces.push({
                   title: item.title,
                   category: item.category,
                   address: item.address,
                   roadAddress: item.roadAddress,
                   mapx: parseInt(item.mapx, 10),
                   mapy: parseInt(item.mapy, 10),
                   link: item.link
                });
             }
           }
        } catch {
           // ignore error for individual place
        }
      }
    }

    return Response.json({ recommendation: jsonResp.summary || '추천 장소를 찾았습니다.', places: finalPlaces });
  } catch (err) {
    console.error('Gemini error:', err);
    return Response.json({ recommendation: '연관 장소 추천을 가져오지 못했습니다.', places: [] });
  }
}

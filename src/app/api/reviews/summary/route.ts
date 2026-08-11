import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { stripHtml } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { items, type = 'blog', placeName } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json({ summary: '리뷰 데이터가 부족하여 요약할 수 없습니다.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key') {
      return Response.json({ summary: 'Gemini API 키를 설정하면 리뷰 핵심 요약을 볼 수 있습니다!' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash',
      systemInstruction: '너는 데이트 코스를 계획하는 커플들에게 맛집이나 명소의 핵심 정보를 친절하고 직관적으로 요약해 주는 데이트 플래너야.',
    });

    const textContent = items
      .slice(0, 5)
      .map((item) => `제목: ${stripHtml(item.title)}\n내용: ${stripHtml(item.description || item.channelTitle || '')}`)
      .join('\n\n');

    const sourceLabel = type === 'youtube' ? '유튜브 영상' : '블로그 리뷰';
    const prompt = `아래는 '${placeName}'에 대한 최근 ${sourceLabel} 제목과 내용들입니다. 이 내용을 바탕으로 이 장소의 핵심 특징을 요약해 주세요.

[작성 지시사항]
- 뻔하고 정형적인 설명은 피하세요.
- **특이한 시그니처 메뉴, 독특한 인테리어, 또는 중요한 볼거리나 체험 요소** 등 구체적인 특징만 추출하세요.
- 전체 내용은 **개조식(- 기호 사용)으로 3~4문장** 정도로 아주 짧게 작성하세요.
- 마크다운 볼드체(**) 등 불필요한 특수문자는 사용하지 마세요.

데이터:
${textContent}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();

    text = text.replace(/\*\*/g, '').trim();

    return Response.json({ summary: text });
  } catch (err) {
    console.error('Gemini error:', err);
    return Response.json({ summary: '요약을 생성하는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
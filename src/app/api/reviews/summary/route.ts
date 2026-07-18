import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { stripHtml } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { blogs, placeName } = await request.json();

    if (!blogs || !Array.isArray(blogs) || blogs.length === 0) {
      return Response.json({ summary: '블로그 리뷰가 부족하여 요약할 수 없습니다.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key') {
      return Response.json({ summary: 'Gemini API 키를 설정하면 리뷰 핵심 요약을 볼 수 있습니다!' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: '너는 데이트 코스를 계획하는 커플들에게 맛집이나 명소의 핵심 정보를 친절하고 직관적으로 요약해 주는 데이트 플래너야.',
    });

    // 검색 결과 정제 (타이틀과 설명 결합)
    const textContent = blogs
      .slice(0, 5)
      .map((b) => `제목: ${stripHtml(b.title)}\n내용: ${stripHtml(b.description)}`)
      .join('\n\n');

    // 프롬프트 가이드라인 구체화 (마크다운 방지 및 톤앤매너 지정)
    const prompt = `아래는 '${placeName}'에 대한 최근 블로그 리뷰 제목과 요약글들입니다. 이 내용을 바탕으로 이 장소의 핵심적인 분위기, 장점, 꿀팁을 요약해 주세요. 추가로, 이 장소 근처에서 현재 열리고 있는 이벤트나 사람들이 많이 언급하는 구체적인 핫플레이스(상호명/명소) 1~2곳을 함께 추천해 주세요. 전체 내용을 3~4문장으로 간결하고 매력적인 평문(특수문자나 볼드체 없이)으로 작성해 주세요.

${textContent}

[주의사항]
- **이나 * 같은 마크다운 서식을 절대 사용하지 마세요.
- 줄바꿈 없이 하나의 흐르는 문단으로 작성해주세요.
- 정보가 부족하다면 억지로 꾸며내지 말고 확인된 팩트 위주로만 작성해주세요.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();

    // 혹시라도 남아있을 수 있는 줄바꿈 및 불필요한 마크다운 기호 제거 안전장치
    text = text.replace(/\n/g, ' ').replace(/\*\*/g, '').trim();

    return Response.json({ summary: text });
  } catch (err) {
    console.error('Gemini error:', err);
    return Response.json({ summary: '요약을 생성하는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
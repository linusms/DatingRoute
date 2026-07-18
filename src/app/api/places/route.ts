import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query');
  if (!query) {
    return Response.json({ error: 'query parameter is required' }, { status: 400 });
  }

  const display = request.nextUrl.searchParams.get('display') || '5';

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.json(
      { error: 'Naver Developers API keys not configured' },
      { status: 500 }
    );
  }

  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=${display}&sort=random`;

    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json(
        { error: `Naver API error: ${res.status}`, detail: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    if (data.items) {
      data.items = data.items.map((item: any) => ({
        ...item,
        id: Math.random().toString(36).substr(2, 9)
      }));
    }
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: 'Failed to fetch places', detail: String(err) },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Naver API keys are not configured' }, { status: 500 });
  }

  try {
    // Append "업체" to the query to prefer official business photos over random blog posts
    const searchQuery = `${query} 업체`.trim();
    const apiUrl = `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(searchQuery)}&display=1&sort=sim`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      // Next.js fetch cache configuration (cache for 1 hour to reduce API calls)
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Naver API Error:', response.status, errorText);
      return NextResponse.json({ error: 'Failed to fetch image from Naver API' }, { status: response.status });
    }

    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      return NextResponse.json({ imageUrl: data.items[0].link });
    } else {
      return NextResponse.json({ imageUrl: null });
    }
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

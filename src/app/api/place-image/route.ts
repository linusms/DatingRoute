import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  // 1. Try to scrape the official Naver Map thumbnail (ldb-phinf) from Naver Search
  try {
    const scrapeUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
    const scrapeRes = await fetch(scrapeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      next: { revalidate: 3600 }
    });
    
    if (scrapeRes.ok) {
      const html = await scrapeRes.text();
      // Match Naver Local Database (ldb-phinf) thumbnails
      const match = html.match(/https:\/\/search\.pstatic\.net\/common\/\?src=[^"'\\]+ldb-phinf[^"'\\]+/i);
      if (match) {
        // Return the first official place photo found
        return NextResponse.json({ imageUrl: match[0].replace(/&amp;/g, '&') });
      }
    }
  } catch (e) {
    console.error('Naver Search scraping error:', e);
  }

  // 2. Fallback to Naver Image Search API
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Naver API keys are not configured' }, { status: 500 });
  }

  try {
    // Append "업체" to prefer official business photos over random blogs if scraping failed
    const searchQuery = `${query} 업체`.trim();
    const apiUrl = `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(searchQuery)}&display=1&sort=sim`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
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

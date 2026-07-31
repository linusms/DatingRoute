import { NextRequest } from 'next/server';
import { katechToWgs84, getStraightLineDistance } from '@/lib/utils';
import { getCache, setCache } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query');
  if (!query) {
    return Response.json({ error: 'query parameter is required' }, { status: 400 });
  }

  const category = request.nextUrl.searchParams.get('category');
  const finalQuery = category ? `${query} ${category}` : query;

  const latStr = request.nextUrl.searchParams.get('lat');
  const lngStr = request.nextUrl.searchParams.get('lng');
  const radiusStr = request.nextUrl.searchParams.get('radius');

  const isRadiusSearch = latStr && lngStr && radiusStr;
  const display = request.nextUrl.searchParams.get('display') || (isRadiusSearch ? '50' : '10');
  const start = request.nextUrl.searchParams.get('start') || '1';

  // Check cache first for 0ms instant response
  const cacheKey = `places:${finalQuery}:${display}:${start}:${latStr || ''}:${lngStr || ''}:${radiusStr || ''}`;
  const cached = getCache<any>(cacheKey);
  if (cached) {
    return Response.json(cached, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.json(
      { error: 'Naver Developers API keys not configured' },
      { status: 500 }
    );
  }

  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(finalQuery)}&display=${display}&start=${start}`;

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

      // Filter by radius if provided
      if (isRadiusSearch) {
        const centerLat = parseFloat(latStr as string);
        const centerLng = parseFloat(lngStr as string);
        const radiusMeters = parseFloat(radiusStr as string) * 1000;

        data.items = data.items.filter((item: any) => {
          const { lat: itemLat, lng: itemLng } = katechToWgs84(item.mapx, item.mapy);
          const distance = getStraightLineDistance(centerLat, centerLng, itemLat, itemLng);
          return distance <= radiusMeters;
        });
      }
    }

    // Store in cache for 5 mins
    setCache(cacheKey, data, 300_000);

    return Response.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch (err) {
    return Response.json(
      { error: 'Failed to fetch places', detail: String(err) },
      { status: 500 }
    );
  }
}

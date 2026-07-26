import { NextRequest } from 'next/server';
import { katechToWgs84, getStraightLineDistance } from '@/lib/utils';

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

  // If doing radius search, fetch more to filter down. Otherwise just use display parameter.
  const isRadiusSearch = latStr && lngStr && radiusStr;
  const display = request.nextUrl.searchParams.get('display') || (isRadiusSearch ? '50' : '5');
  const start = request.nextUrl.searchParams.get('start') || '1';

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
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: 'Failed to fetch places', detail: String(err) },
      { status: 500 }
    );
  }
}

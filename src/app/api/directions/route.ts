import { NextRequest } from 'next/server';
import { getCache, setCache } from '@/lib/cache';

export async function GET(request: NextRequest) {
  const start = request.nextUrl.searchParams.get('start');
  const goal = request.nextUrl.searchParams.get('goal');
  const waypoints = request.nextUrl.searchParams.get('waypoints');

  if (!start || !goal) {
    return Response.json(
      { error: 'start and goal parameters are required (lng,lat format)' },
      { status: 400 }
    );
  }

  const cacheKey = `directions:${start}:${goal}:${waypoints || ''}`;
  const cached = getCache<any>(cacheKey);
  if (cached) {
    return Response.json(cached, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  }

  const clientId = process.env.NEXT_PUBLIC_NCP_CLIENT_ID;
  const clientSecret = process.env.NCP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.json(
      { error: 'NCP API keys not configured' },
      { status: 500 }
    );
  }

  try {
    let url = `https://maps.apigw.ntruss.com/map-direction-15/v1/driving?start=${start}&goal=${goal}`;
    if (waypoints) {
      url += `&waypoints=${waypoints}`;
    }

    const res = await fetch(url, {
      headers: {
        'x-ncp-apigw-api-key-id': clientId,
        'x-ncp-apigw-api-key': clientSecret,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json(
        { error: `NCP Directions API error: ${res.status}`, detail: text },
        { status: res.status }
      );
    }

    const data = await res.json();

    const routeObj = data.route?.traoptimal?.[0] || data.route?.trafast?.[0] || data.route?.traoption?.[0];

    if (routeObj) {
      const summary = routeObj.summary;
      const waypointsArr = summary.waypoints || [];
      const goalObj = summary.goal;
      
      const legs = [];
      waypointsArr.forEach((wp: any, idx: number) => {
        legs.push({
          index: idx,
          distance: wp.distance || 0,
          duration: wp.duration || 0,
          name: '',
        });
      });
      if (goalObj) {
        legs.push({
          index: legs.length,
          distance: goalObj.distance || 0,
          duration: goalObj.duration || 0,
          name: '',
        });
      }

      data._parsedLegs = legs;
      data._fullPath = routeObj.path || [];
      data._totalDistance = summary.distance || 0;
      data._totalDuration = summary.duration || 0;
    }

    setCache(cacheKey, data, 300_000);

    return Response.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch (err) {
    return Response.json(
      { error: 'Failed to fetch directions', detail: String(err) },
      { status: 500 }
    );
  }
}

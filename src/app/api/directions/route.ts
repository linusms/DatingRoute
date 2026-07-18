import { NextRequest } from 'next/server';

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

    // Parse section-level leg data for per-waypoint distance/duration
    if (data.route?.traoptimal?.[0]) {
      const route = data.route.traoptimal[0];
      const summary = route.summary;
      const waypoints = summary.waypoints || [];
      const goal = summary.goal;
      
      const legs = [];
      waypoints.forEach((wp: any, idx: number) => {
        legs.push({
          index: idx,
          distance: wp.distance || 0,
          duration: wp.duration || 0,
          name: '',
        });
      });
      if (goal) {
        legs.push({
          index: legs.length,
          distance: goal.distance || 0,
          duration: goal.duration || 0,
          name: '',
        });
      }

      // Attach parsed legs to the response for easy frontend consumption
      data._parsedLegs = legs;
    }

    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: 'Failed to fetch directions', detail: String(err) },
      { status: 500 }
    );
  }
}

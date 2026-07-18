import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('query');

  if (!query) {
    return Response.json({ error: 'query parameter is required' }, { status: 400 });
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
    const url = `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`;

    const res = await fetch(url, {
      headers: {
        'x-ncp-apigw-api-key-id': clientId,
        'x-ncp-apigw-api-key': clientSecret,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json(
        { error: `NCP Geocode API error: ${res.status}`, detail: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: 'Failed to geocode', detail: String(err) },
      { status: 500 }
    );
  }
}

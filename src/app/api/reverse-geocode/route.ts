import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const coords = request.nextUrl.searchParams.get('coords');

  if (!coords) {
    return Response.json(
      { error: 'coords parameter is required (lng,lat format)' },
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
    const url = `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${coords}&output=json&orders=roadaddr,addr`;

    const res = await fetch(url, {
      headers: {
        'x-ncp-apigw-api-key-id': clientId,
        'x-ncp-apigw-api-key': clientSecret,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return Response.json(
        { error: `NCP Reverse Geocode API error: ${res.status}`, detail: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: 'Failed to reverse geocode', detail: String(err) },
      { status: 500 }
    );
  }
}

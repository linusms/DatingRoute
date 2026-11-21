import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/session';
import { hasTourApi, searchFestivals } from '@/lib/tourApi';

/** GET /api/events?startDate=YYYYMMDD&endDate=YYYYMMDD[&lat=&lng=&radiusKm=] - festivals from TourAPI */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const startDate = params.get('startDate') || '';
  const endDate = params.get('endDate') || startDate;
  if (!/^\d{8}$/.test(startDate) || !/^\d{8}$/.test(endDate)) {
    return Response.json({ error: 'startDate and endDate (YYYYMMDD) are required' }, { status: 400 });
  }

  const lat = parseFloat(params.get('lat') || '');
  const lng = parseFloat(params.get('lng') || '');
  const center = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  const radiusKm = Math.min(200, Math.max(1, parseFloat(params.get('radiusKm') || '30') || 30));

  try {
    const events = hasTourApi() ? await searchFestivals({ startDate, endDate, center, radiusKm }) : [];
    return Response.json({ events, tourApiUsed: hasTourApi() });
  } catch (err) {
    console.error('Festival search error:', err);
    return Response.json({ events: [], tourApiUsed: false });
  }
}

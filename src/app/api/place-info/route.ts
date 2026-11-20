import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { getPlaceInfo, hasTourApi } from '@/lib/tourApi';
import { katechToWgs84 } from '@/lib/utils';

/** GET /api/place-info?title=&mapx=&mapy= - opening hours and closed days (TourAPI), when known */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const title = (params.get('title') || '').slice(0, 100);
  const { lat, lng } = katechToWgs84(params.get('mapx'), params.get('mapy'));
  if (!title || !params.get('mapx') || !params.get('mapy')) {
    return NextResponse.json({ error: 'title, mapx, mapy가 필요합니다.' }, { status: 400 });
  }
  if (!hasTourApi()) return NextResponse.json({ found: false });

  const info = await getPlaceInfo(title, lat, lng);
  return NextResponse.json(info, { headers: { 'Cache-Control': 'private, max-age=3600' } });
}

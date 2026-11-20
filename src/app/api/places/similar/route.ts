import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { areaFromAddress, reverseGeocode, searchLocal } from '@/lib/naver';
import { getStraightLineDistance, katechToWgs84, parseCategoryToFacility, stripHtml } from '@/lib/utils';
import type { FacilityType } from '@/lib/types';

const FACILITY_WORD: Record<FacilityType, string> = {
  restaurant: '맛집',
  cafe: '카페',
  culture: '전시',
  park: '공원',
  shopping: '소품샵',
  bar: '바',
  entertainment: '데이트 체험',
  accommodation: '숙소',
  other: '가볼만한곳',
};

/** GET /api/places/similar?title=&category=&address=&mapx=&mapy= - nearby places of the same kind */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const title = stripHtml(params.get('title') || '');
  const category = params.get('category') || '';
  const address = params.get('address') || '';
  if (!params.get('mapx') || !params.get('mapy')) {
    return NextResponse.json({ error: 'mapx, mapy가 필요합니다.' }, { status: 400 });
  }
  const { lat, lng } = katechToWgs84(params.get('mapx'), params.get('mapy'));

  let area = areaFromAddress(address);
  if (!area) {
    const r = await reverseGeocode(lat, lng);
    area = r ? `${r.area2} ${r.area3}`.trim() : '';
  }
  const facility = parseCategoryToFacility(category);
  const specific = category.split('>').pop()?.split(',')[0]?.trim() || '';
  const word = FACILITY_WORD[facility];
  const queries = Array.from(new Set([
    specific && `${area} ${specific}`,
    `${area} ${word}`,
    `${area} 데이트 ${word}`,
    `${area} 분위기 좋은 ${word}`,
  ].filter(Boolean) as string[]));

  const found = (await Promise.all(queries.map((q) => searchLocal(q, 'comment')))).flat();
  const seen = new Set<string>([title]);
  const results = found
    .filter((p) => p.name && !seen.has(p.name) && (seen.add(p.name), true))
    .map((p) => {
      const pos = katechToWgs84(p.mapx, p.mapy);
      return { ...p, distance: Math.round(getStraightLineDistance(lat, lng, pos.lat, pos.lng)) };
    })
    .filter((p) => p.distance <= 2000)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 6);

  return NextResponse.json({ places: results });
}

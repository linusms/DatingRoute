import 'server-only';
import { getCache, setCache } from './cache';
import { stripHtml } from './utils';

/** A place from Naver local search, with mapx/mapy as WGS84 × 10^7 integers (Naver's format). */
export interface NaverPlace {
  name: string;
  category: string;
  address: string;
  roadAddress: string;
  mapx: number;
  mapy: number;
  link: string;
}

function naverHeaders(): Record<string, string> | null {
  const id = process.env.NAVER_CLIENT_ID;
  const secret = process.env.NAVER_CLIENT_SECRET;
  if (!id || !secret) return null;
  return { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret };
}

export function hasNaverSearch(): boolean {
  return naverHeaders() !== null;
}

/** Naver local search (max 5 results per query since 2020). Cached for 10 minutes. */
export async function searchLocal(query: string, sort: 'random' | 'comment' = 'random'): Promise<NaverPlace[]> {
  const headers = naverHeaders();
  if (!headers || !query.trim()) return [];
  const cacheKey = `local:${sort}:${query}`;
  const cached = getCache<NaverPlace[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&start=1&sort=${sort}`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const places: NaverPlace[] = (data.items || []).map((item: any) => ({
      name: stripHtml(item.title || ''),
      category: item.category || '',
      address: item.address || '',
      roadAddress: item.roadAddress || '',
      mapx: parseInt(item.mapx, 10) || 0,
      mapy: parseInt(item.mapy, 10) || 0,
      link: item.link || '',
    }));
    setCache(cacheKey, places, 10 * 60 * 1000);
    return places;
  } catch {
    return [];
  }
}

/** Blog search text (titles + descriptions), used to count mentions. */
export async function searchBlogText(query: string): Promise<string> {
  const headers = naverHeaders();
  if (!headers) return '';
  try {
    const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=10&sort=sim`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return '';
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return stripHtml((data.items || []).map((b: any) => `${b.title} ${b.description}`).join(' '));
  } catch {
    return '';
  }
}

/** Region names ("서울특별시", "서울특별시 성동구", "성수동1가") for a WGS84 point, via NCP reverse geocoding. */
export async function reverseGeocode(lat: number, lng: number): Promise<{ area1: string; area2: string; area3: string } | null> {
  const id = process.env.NEXT_PUBLIC_NCP_CLIENT_ID;
  const secret = process.env.NCP_CLIENT_SECRET;
  if (!id || !secret) return null;
  const cacheKey = `rgeo:${lat.toFixed(3)}:${lng.toFixed(3)}`;
  const cached = getCache<{ area1: string; area2: string; area3: string }>(cacheKey);
  if (cached) return cached;
  try {
    const url = `https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&output=json&orders=admcode`;
    const res = await fetch(url, {
      headers: { 'x-ncp-apigw-api-key-id': id, 'x-ncp-apigw-api-key': secret },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const region = data?.results?.[0]?.region;
    if (!region) return null;
    const result = {
      area1: region.area1?.name || '',
      area2: region.area2?.name || '',
      area3: region.area3?.name || '',
    };
    setCache(cacheKey, result, 24 * 60 * 60 * 1000);
    return result;
  } catch {
    return null;
  }
}

/** Search areas around points ("성수동" for small radii, else "성동구"). */
export async function regionNamesAround(points: { lat: number; lng: number }[], radiusKm: number): Promise<string[]> {
  const results = await Promise.all(points.slice(0, 5).map((p) => reverseGeocode(p.lat, p.lng)));
  const names = new Set<string>();
  for (const r of results) {
    if (!r) continue;
    const dong = r.area3.replace(/\d+가$/, '').replace(/\d+동$/, '동');
    if (radiusKm <= 3 && dong) names.add(dong);
    else if (r.area2) names.add(r.area2.split(' ').pop() || r.area2);
    else if (r.area1) names.add(r.area1);
  }
  return Array.from(names);
}

/** A short area keyword for search queries: "성동구 성수동" from a road/jibun address. */
export function areaFromAddress(address: string): string {
  const parts = address.split(/\s+/).filter(Boolean);
  const gu = parts.find((p) => /(구|군|시)$/.test(p) && !/(특별시|광역시|특별자치시)$/.test(p));
  const dong = parts.find((p) => /(동|읍|면|가)$/.test(p) || /\d가$/.test(p));
  return [gu, dong].filter(Boolean).join(' ') || parts.slice(0, 2).join(' ');
}

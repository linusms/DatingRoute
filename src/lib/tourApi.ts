import 'server-only';
import { getCache, setCache } from './cache';
import { getStraightLineDistance, stripHtml } from './utils';
import type { PlaceInfo, RegionEvent } from './types';

/*
 * 한국관광공사 TourAPI (KorService2) helpers.
 * Field names follow the 활용매뉴얼 v4.4 (docs/). Coordinates are WGS84 (mapX = lng, mapY = lat).
 */

const BASE = 'https://apis.data.go.kr/B551011/KorService2';

function getKey(): string | null {
  const key = process.env.TOUR_API_KEY;
  return key && key !== 'your_tour_api_key' ? key : null;
}

export function hasTourApi(): boolean {
  return getKey() !== null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TourItem = Record<string, any>;

async function callTourApi(operation: string, params: Record<string, string | number>): Promise<TourItem[]> {
  const key = getKey();
  if (!key) return [];
  const url = new URL(`${BASE}/${operation}`);
  url.searchParams.set('serviceKey', key);
  url.searchParams.set('MobileOS', 'ETC');
  url.searchParams.set('MobileApp', 'DatingRoute');
  url.searchParams.set('_type', 'json');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`TourAPI ${operation} ${res.status}`);
  const data = await res.json();
  const items = data?.response?.body?.items?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

/* ─────────── Festivals ─────────── */

interface FestivalQuery {
  startDate: string; // YYYYMMDD
  endDate: string;   // YYYYMMDD
  center?: { lat: number; lng: number } | null;
  radiusKm?: number;
  limit?: number;
}

/** Festivals running in the date range, nearest first when a center is given. */
export async function searchFestivals({ startDate, endDate, center, radiusKm = 30, limit = 15 }: FestivalQuery): Promise<RegionEvent[]> {
  const cacheKey = `festival:${startDate}:${endDate}`;
  let items = getCache<TourItem[]>(cacheKey);
  if (!items) {
    items = await callTourApi('searchFestival2', {
      eventStartDate: startDate,
      eventEndDate: endDate,
      numOfRows: 200,
      pageNo: 1,
      arrange: 'C',
    });
    setCache(cacheKey, items, 6 * 60 * 60 * 1000);
  }

  let events: (RegionEvent & { dist?: number })[] = items
    .filter((item) => !item.eventstartdate || item.eventstartdate <= endDate)
    .map((item) => ({
      contentId: String(item.contentid || ''),
      title: stripHtml(item.title || ''),
      address: item.addr1 || '',
      imageUrl: item.firstimage || item.firstimage2 || '',
      startDate: item.eventstartdate || startDate,
      endDate: item.eventenddate || endDate,
      tel: item.tel || '',
      mapx: parseFloat(item.mapx) || 0,
      mapy: parseFloat(item.mapy) || 0,
      category: '축제/행사',
    }));

  if (center) {
    events = events
      .filter((e) => e.mapx && e.mapy)
      .map((e) => ({ ...e, dist: getStraightLineDistance(center.lat, center.lng, e.mapy, e.mapx) }))
      .filter((e) => (e.dist ?? 0) <= radiusKm * 1000)
      .sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0));
  }
  return events.slice(0, limit).map(({ dist: _dist, ...e }) => e);
}

/* ─────────── Opening hours ─────────── */

/** detailIntro2 field names by contentTypeId */
const INTRO_FIELDS: Record<string, { hours: string[]; rest: string[] }> = {
  '12': { hours: ['usetime'], rest: ['restdate'] },
  '14': { hours: ['usetimeculture'], rest: ['restdateculture'] },
  '15': { hours: ['playtime'], rest: [] },
  '28': { hours: ['usetimeleports'], rest: ['restdateleports'] },
  '32': { hours: ['checkintime', 'checkouttime'], rest: [] },
  '38': { hours: ['opentime'], rest: ['restdateshopping'] },
  '39': { hours: ['opentimefood'], rest: ['restdatefood'] },
};

function normalizeName(value: string): string {
  return stripHtml(value).replace(/\s+/g, '').replace(/[()（）\[\]]/g, '').toLowerCase();
}

function namesMatch(a: string, b: string): boolean {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<br\s*\/?>/gi, ' / ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function findTourItem(title: string, lat: number, lng: number): Promise<TourItem | null> {
  const nearby = await callTourApi('locationBasedList2', {
    mapX: lng,
    mapY: lat,
    radius: 300,
    arrange: 'E',
    numOfRows: 30,
    pageNo: 1,
  });
  const near = nearby.find((item) => namesMatch(item.title || '', title));
  if (near) return near;

  const keyword = stripHtml(title).trim();
  if (keyword.length < 2) return null;
  const byName = await callTourApi('searchKeyword2', { keyword, numOfRows: 10, pageNo: 1, arrange: 'C' });
  return (
    byName.find((item) => {
      if (!namesMatch(item.title || '', title)) return false;
      const ilat = parseFloat(item.mapy);
      const ilng = parseFloat(item.mapx);
      return ilat && ilng && getStraightLineDistance(lat, lng, ilat, ilng) < 1000;
    }) ?? null
  );
}

/** Opening hours / closed days for a place, matched by name near its coordinates. Cached for a day. */
export async function getPlaceInfo(title: string, lat: number, lng: number): Promise<PlaceInfo> {
  const cacheKey = `placeinfo:${normalizeName(title)}:${lat.toFixed(4)}:${lng.toFixed(4)}`;
  const cached = getCache<PlaceInfo>(cacheKey);
  if (cached) return cached;

  let info: PlaceInfo = { found: false };
  try {
    const item = await findTourItem(title, lat, lng);
    if (item) {
      const typeId = String(item.contenttypeid || '');
      const fields = INTRO_FIELDS[typeId];
      if (fields) {
        const [intro] = await callTourApi('detailIntro2', { contentId: item.contentid, contentTypeId: typeId });
        if (intro) {
          const hours = fields.hours.map((f) => cleanText(intro[f])).filter(Boolean).join(' · ');
          const restDate = fields.rest.map((f) => cleanText(intro[f])).filter(Boolean).join(' · ');
          info = { found: !!(hours || restDate), hours, restDate, source: '한국관광공사' };
        }
      }
    }
  } catch (err) {
    console.warn('[tourApi] place info failed:', err);
  }
  setCache(cacheKey, info, 24 * 60 * 60 * 1000);
  return info;
}

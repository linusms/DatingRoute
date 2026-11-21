import { katechToWgs84, stripHtml } from './utils';

/*
 * Map deep links. Kakao Map URL formats are from the official guide
 * (apis.map.kakao.com/web/guide/#routeurl): /link/to/이름,위도,경도 and
 * /link/by/{car|traffic|walk}/출발이름,위도,경도/도착이름,위도,경도 (lat before lng).
 */

interface LinkPlace {
  title: string;
  mapx: number;
  mapy: number;
}

export type KakaoRouteMode = 'car' | 'traffic' | 'walk';

function segment(place: LinkPlace): string {
  const { lat, lng } = katechToWgs84(place.mapx, place.mapy);
  // Commas and slashes would break the path segments
  const name = stripHtml(place.title).replace(/[,/]/g, ' ').trim() || '장소';
  return `${encodeURIComponent(name)},${lat},${lng}`;
}

/** Route between two places in Kakao Map (opens the app or mobile/PC web). */
export function kakaoRouteUrl(from: LinkPlace, to: LinkPlace, mode: KakaoRouteMode = 'traffic'): string {
  return `https://map.kakao.com/link/by/${mode}/${segment(from)}/${segment(to)}`;
}

/** Directions from the user's current location to a place. */
export function kakaoDirectionsToUrl(to: LinkPlace): string {
  return `https://map.kakao.com/link/to/${segment(to)}`;
}

export function naverSearchUrl(title: string): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(stripHtml(title))}`;
}

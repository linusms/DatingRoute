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

/**
 * Opens a place search in the Naver Map app on phones (URL scheme nmap://search?query=..&appname=..),
 * falling back to the mobile web when the app isn't installed. On desktop the link's own href
 * (naverSearchUrl) opens in a new tab.
 */
export function openNaverMap(event: { preventDefault: () => void }, title: string) {
  if (typeof navigator === 'undefined') return;
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (!isAndroid && !isIOS) return;

  event.preventDefault();
  const query = encodeURIComponent(stripHtml(title));
  const appname = encodeURIComponent(window.location.hostname || 'datingroute');
  const web = `https://m.map.naver.com/search2/search.naver?query=${query}`;
  if (isAndroid) {
    // Chrome opens the app, or the fallback URL when it isn't installed
    window.location.href = `intent://search?query=${query}&appname=${appname}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;S.browser_fallback_url=${encodeURIComponent(web)};end`;
    return;
  }
  const startedAt = Date.now();
  window.location.href = `nmap://search?query=${query}&appname=${appname}`;
  setTimeout(() => {
    // Still here (the app didn't take over): open the mobile web instead
    if (document.visibilityState === 'visible' && Date.now() - startedAt < 3000) window.location.href = web;
  }, 1500);
}

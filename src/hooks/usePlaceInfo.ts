'use client';

import { useEffect, useState } from 'react';
import type { PlaceInfo } from '@/lib/types';

const cache = new Map<string, PlaceInfo>();
const inflight = new Map<string, Promise<PlaceInfo>>();

function keyOf(title: string, mapx: number, mapy: number) {
  return `${title}|${mapx}|${mapy}`;
}

function loadPlaceInfo(title: string, mapx: number, mapy: number): Promise<PlaceInfo> {
  const key = keyOf(title, mapx, mapy);
  const running = inflight.get(key);
  if (running) return running;
  const params = new URLSearchParams({ title, mapx: String(mapx), mapy: String(mapy) });
  const promise = fetch(`/api/place-info?${params}`)
    .then((res) => (res.ok ? res.json() : { found: false }))
    .catch(() => ({ found: false }))
    .then((info: PlaceInfo) => {
      cache.set(key, info);
      inflight.delete(key);
      return info;
    });
  inflight.set(key, promise);
  return promise;
}

/** Opening hours / closed days from TourAPI, fetched once per place and shared across cards. */
export function usePlaceInfo(title: string, mapx: number, mapy: number, enabled: boolean): PlaceInfo | null {
  const key = keyOf(title, mapx, mapy);
  const [state, setState] = useState<{ key: string; info: PlaceInfo | null }>(() => ({ key, info: cache.get(key) ?? null }));

  useEffect(() => {
    if (!enabled || !title || !mapx || !mapy || cache.has(key)) return;
    let alive = true;
    loadPlaceInfo(title, mapx, mapy).then((info) => {
      if (alive) setState({ key, info });
    });
    return () => { alive = false; };
  }, [enabled, key, title, mapx, mapy]);

  if (cache.has(key)) return cache.get(key) ?? null;
  return state.key === key ? state.info : null;
}

import { useState, useCallback } from 'react';
import { CoursePlace } from '@/lib/types';
import { katechToWgs84, calculateFallbackDirections } from '@/lib/utils';

export interface DirectionsData {
  totalDistance: number;
  totalDuration: number;
  legs: Array<{
    index: number;
    distance: number;
    duration: number;
    name: string;
    fromId: string;
    toId: string;
  }>;
  fullPath: Array<[number, number]>;
}

export function useDirections() {
  const [directions, setDirections] = useState<DirectionsData | null>(null);
  const [routePath, setRoutePath] = useState<Record<number, Array<[number, number]>> | null>(null);

  const fetchDirections = useCallback(async (places: CoursePlace[]) => {
    const validPlaces = places.filter((p) => (p.day ?? 0) !== 0);
    if (validPlaces.length < 2) {
      setDirections(null);
      setRoutePath(null);
      return;
    }

    const byDay: Record<number, CoursePlace[]> = {};
    validPlaces.forEach(p => {
      const d = p.day ?? 1;
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(p);
    });

    let totalDist = 0;
    let totalDur = 0;
    const allLegs: any[] = [];
    const newRoutePath: Record<number, Array<[number, number]>> = {};
    let globalLegIndex = 0;

    for (const d of Object.keys(byDay)) {
      const day = Number(d);
      const dPlaces = byDay[day];
      if (dPlaces.length < 2) continue;

      try {
        const coords = dPlaces.map((p) => {
          const { lng, lat } = katechToWgs84(p.mapx, p.mapy);
          return `${lng},${lat}`;
        });

        const start = coords[0];
        const goal = coords[coords.length - 1];
        const waypoints = coords.length > 2 ? coords.slice(1, -1).join('|') : undefined;

        let url = `/api/directions?start=${start}&goal=${goal}`;
        if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;

        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok || data.error || !data._fullPath) throw new Error(data.error || 'API Error');

        totalDist += data._totalDistance || 0;
        totalDur += data._totalDuration || 0;
        data._parsedLegs?.forEach((leg: any, i: number) => {
          allLegs.push({ ...leg, index: globalLegIndex++, fromId: dPlaces[i].id, toId: dPlaces[i+1].id });
        });
        newRoutePath[day] = data._fullPath;
      } catch {
        const fallback = calculateFallbackDirections(dPlaces, globalLegIndex);
        totalDist += fallback.dayDist;
        totalDur += fallback.dayDur;
        allLegs.push(...fallback.newLegs);
        newRoutePath[day] = fallback.dPath;
        globalLegIndex = fallback.nextLegIndex;
      }
    }

    setDirections({ totalDistance: totalDist, totalDuration: totalDur, legs: allLegs, fullPath: [] });
    setRoutePath(newRoutePath as any);
  }, []);

  const clearDirections = useCallback(() => {
    setDirections(null);
    setRoutePath(null);
  }, []);

  return {
    directions,
    setDirections,
    routePath,
    setRoutePath,
    fetchDirections,
    clearDirections,
  };
}

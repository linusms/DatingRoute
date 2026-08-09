import { CoursePlace } from '@/lib/types';

/**
 * Format meters to a human-readable distance string.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Format milliseconds to a human-readable duration string.
 */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}분`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

/**
 * Get straight line distance in meters between two WGS84 coordinates using Haversine formula
 */
export function getStraightLineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180; // φ, λ in radians
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // in metres
}

/**
 * Calculate walking time in milliseconds based on distance in meters.
 * Assumes average walking speed of 4 km/h (1.11 meters/second).
 * Adds 20% penalty for city routing detours since it's based on straight line.
 */
export function getWalkingTimeMs(distanceMeters: number): number {
  const speedMetersPerSecond = 1.11;
  const penaltyFactor = 1.2;
  const seconds = (distanceMeters * penaltyFactor) / speedMetersPerSecond;
  return Math.round(seconds * 1000);
}

/**
 * Strip HTML tags from a string (for Naver search results).
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Convert Naver KATECH coordinates (mapx/mapy as integers from local search)
 * to WGS84 longitude/latitude.
 *
 * Naver local search API returns mapx/mapy values that are already
 * WGS84 coordinates but multiplied by 10,000,000.
 */
export function katechToWgs84(mapx: any, mapy: any): { lng: number; lat: number } {
  const x = typeof mapx === 'string' ? parseFloat(mapx) : mapx;
  const y = typeof mapy === 'string' ? parseFloat(mapy) : mapy;
  if (!x || !y || isNaN(x) || isNaN(y)) {
    return { lng: 126.978, lat: 37.5665 };
  }
  const lng = x > 1000 ? x / 10_000_000 : x;
  const lat = y > 1000 ? y / 10_000_000 : y;
  return { lng, lat };
}

/**
 * Generate a unique ID for places.
 */
export function generatePlaceId(): string {
  return `place_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Debounce function.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Parse Naver local search category string into a FacilityType.
 * e.g. "한식>갈비" → 'restaurant', "카페,디저트" → 'cafe'
 */
export function parseCategoryToFacility(category: string): import('@/lib/types').FacilityType {
  if (!category) return 'other';
  const c = category.toLowerCase();

  // Cafe
  if (c.includes('카페') || c.includes('커피') || c.includes('디저트') || c.includes('베이커리') || c.includes('제과')) {
    return 'cafe';
  }
  // Bar
  if (c.includes('바') || c.includes('펍') || c.includes('주점') || c.includes('술집') || c.includes('와인') || c.includes('이자카야') || c.includes('호프')) {
    return 'bar';
  }
  // Restaurant
  if (c.includes('음식') || c.includes('식당') || c.includes('한식') || c.includes('중식') || c.includes('일식') || c.includes('양식') ||
      c.includes('분식') || c.includes('치킨') || c.includes('피자') || c.includes('패스트') || c.includes('뷔페') || c.includes('맛집') ||
      c.includes('고기') || c.includes('해물') || c.includes('국밥') || c.includes('라멘') || c.includes('파스타') || c.includes('레스토랑') ||
      c.includes('갈비') || c.includes('삼겹') || c.includes('초밥') || c.includes('스시') || c.includes('브런치')) {
    return 'restaurant';
  }
  // Culture
  if (c.includes('미술') || c.includes('박물관') || c.includes('갤러리') || c.includes('전시') || c.includes('공연') || c.includes('극장') ||
      c.includes('영화') || c.includes('문화') || c.includes('도서관') || c.includes('역사') || c.includes('기념관') || c.includes('시네마') ||
      c.includes('cgv') || c.includes('롯데시네마') || c.includes('메가박스')) {
    return 'culture';
  }
  // Park
  if (c.includes('공원') || c.includes('산책') || c.includes('정원') || c.includes('수목원') || c.includes('산') || c.includes('해변') ||
      c.includes('호수') || c.includes('강') || c.includes('자연') || c.includes('유원지') || c.includes('테마파크') || c.includes('놀이공원')) {
    return 'park';
  }
  // Shopping
  if (c.includes('쇼핑') || c.includes('마트') || c.includes('백화점') || c.includes('시장') || c.includes('아울렛') || c.includes('편의점') ||
      c.includes('의류') || c.includes('잡화') || c.includes('뷰티') || c.includes('화장품')) {
    return 'shopping';
  }
  // Entertainment
  if (c.includes('오락') || c.includes('볼링') || c.includes('노래') || c.includes('방탈출') || c.includes('스포츠') || c.includes('게임') ||
      c.includes('pc방') || c.includes('찜질') || c.includes('사우나') || c.includes('스파') || c.includes('요가') || c.includes('헬스') ||
      c.includes('클라이밍') || c.includes('레저')) {
    return 'entertainment';
  }
  // Accommodation
  if (c.includes('호텔') || c.includes('모텔') || c.includes('숙박') || c.includes('펜션') || c.includes('리조트') || c.includes('게스트')) {
    return 'accommodation';
  }

  return 'other';
}

/**
 * Format a Date to Korean format: YYYY년 M월 D일
 */
export function formatDateKR(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * Convert YYYYMMDD to YYYY-MM-DD
 */
export function tourDateToISO(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

/**
 * Optimize route using Nearest Neighbor TSP heuristic.
 * Keeps the starting point fixed (default index 0).
 */
export function optimizeRouteTSP(places: CoursePlace[], startIdx = 0): CoursePlace[] {
  if (places.length <= 2) return places; // No need to sort

  const unvisited = [...places];
  const sorted: CoursePlace[] = [];

  // Start with the specified starting place
  let current = unvisited.splice(startIdx, 1)[0];
  sorted.push(current);

  while (unvisited.length > 0) {
    let nearestIdx = -1;
    let minDistance = Infinity;

    const { lng: currLng, lat: currLat } = katechToWgs84(current.mapx, current.mapy);

    for (let i = 0; i < unvisited.length; i++) {
      const candidate = unvisited[i];
      const { lng: candLng, lat: candLat } = katechToWgs84(candidate.mapx, candidate.mapy);
      const dist = getStraightLineDistance(currLat, currLng, candLat, candLng);

      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    current = unvisited.splice(nearestIdx, 1)[0];
    sorted.push(current);
  }

  // Update order property
  return sorted.map((p, i) => ({ ...p, order: i }));
}

/**
 * Auto-distribute storage places (day === 0) into days (1..dayCount) using K-Means clustering.
 * Each place is uniquely assigned to exactly one day (no overlaps).
 * After assignment, each day's route is optimized using TSP.
 */
export function autoDistributePlaces(places: CoursePlace[], dayCount: number): CoursePlace[] {
  const assigned = places.filter(p => (p.day ?? 0) > 0);
  const assignedTitles = new Set(assigned.map(p => p.title));
  
  // Exclude storage places that are already assigned to a day or are marked as hold
  const storage = places.filter(p => (p.day ?? 0) === 0 && !assignedTitles.has(p.title) && !p.isHold);
  const ignoredStorage = places.filter(p => (p.day ?? 0) === 0 && (assignedTitles.has(p.title) || p.isHold));

  if (storage.length === 0 || dayCount < 1) return places;

  // Initialize centroids for each day
  const centroids: Record<number, { lat: number, lng: number }> = {};
  
  for (let d = 1; d <= dayCount; d++) {
    const dayPlaces = assigned.filter(p => p.day === d);
    if (dayPlaces.length > 0) {
      let sumLat = 0;
      let sumLng = 0;
      dayPlaces.forEach(p => {
        const { lat, lng } = katechToWgs84(p.mapx, p.mapy);
        sumLat += lat;
        sumLng += lng;
      });
      centroids[d] = { lat: sumLat / dayPlaces.length, lng: sumLng / dayPlaces.length };
    }
  }

  // For days without places, pick random points from storage as centroids
  const storageCoords = storage.map(p => {
    const coords = katechToWgs84(p.mapx, p.mapy);
    return { ...p, coords };
  });

  // K-means++ style initialization for missing centroids
  for (let d = 1; d <= dayCount; d++) {
    if (!centroids[d]) {
      if (storageCoords.length > 0) {
        // Find the point furthest from all existing centroids
        let maxDist = -1;
        let bestIdx = Math.floor(Math.random() * storageCoords.length);
        
        const existingCentroids = Object.values(centroids);
        if (existingCentroids.length > 0) {
          for (let i = 0; i < storageCoords.length; i++) {
            let minDistToCentroid = Infinity;
            for (const c of existingCentroids) {
              const dist = getStraightLineDistance(c.lat, c.lng, storageCoords[i].coords.lat, storageCoords[i].coords.lng);
              if (dist < minDistToCentroid) minDistToCentroid = dist;
            }
            if (minDistToCentroid > maxDist) {
              maxDist = minDistToCentroid;
              bestIdx = i;
            }
          }
        }
        centroids[d] = { lat: storageCoords[bestIdx].coords.lat, lng: storageCoords[bestIdx].coords.lng };
      } else {
        // Fallback
        centroids[d] = { lat: 37.5665, lng: 126.978 };
      }
    }
  }

  // K-Means assignment loop
  let assignments: Record<string, number> = {};
  for (let iter = 0; iter < 10; iter++) {
    assignments = {};
    const newSums: Record<number, { lat: number, lng: number, count: number }> = {};
    for (let d = 1; d <= dayCount; d++) {
      newSums[d] = { lat: 0, lng: 0, count: 0 };
      // Include already assigned places in the new sums
      const dayPlaces = assigned.filter(p => p.day === d);
      dayPlaces.forEach(p => {
        const { lat, lng } = katechToWgs84(p.mapx, p.mapy);
        newSums[d].lat += lat;
        newSums[d].lng += lng;
        newSums[d].count += 1;
      });
    }

    // Assign each storage place to the nearest centroid
    for (const sp of storageCoords) {
      let minDist = Infinity;
      let bestDay = 1;
      for (let d = 1; d <= dayCount; d++) {
        const dist = getStraightLineDistance(centroids[d].lat, centroids[d].lng, sp.coords.lat, sp.coords.lng);
        if (dist < minDist) {
          minDist = dist;
          bestDay = d;
        }
      }
      assignments[sp.id] = bestDay;
      newSums[bestDay].lat += sp.coords.lat;
      newSums[bestDay].lng += sp.coords.lng;
      newSums[bestDay].count += 1;
    }

    // Update centroids
    let changed = false;
    for (let d = 1; d <= dayCount; d++) {
      if (newSums[d].count > 0) {
        const newLat = newSums[d].lat / newSums[d].count;
        const newLng = newSums[d].lng / newSums[d].count;
        if (Math.abs(centroids[d].lat - newLat) > 0.0001 || Math.abs(centroids[d].lng - newLng) > 0.0001) {
          changed = true;
        }
        centroids[d] = { lat: newLat, lng: newLng };
      }
    }
    if (!changed) break;
  }

  // Apply assignments and optimize each day
  const resultPlaces: CoursePlace[] = [];
  for (let d = 1; d <= dayCount; d++) {
    const currentDayAssigned = assigned.filter(p => p.day === d);
    const currentDayDistributed = storage.filter(p => assignments[p.id] === d).map(p => ({ ...p, day: d }));
    
    let combined = [...currentDayAssigned, ...currentDayDistributed];
    if (combined.length > 2) {
      combined = optimizeRouteTSP(combined, 0); // Keep first element as start if possible
    }
    resultPlaces.push(...combined);
  }

  // Add back any unassigned places (should not happen, but just in case) and ignored places
  const allResultIds = new Set(resultPlaces.map(p => p.id));
  const leftovers = storage.filter(p => !allResultIds.has(p.id));
  
  return [...resultPlaces, ...leftovers, ...ignoredStorage].map((p, i) => ({ ...p, order: i }));
}

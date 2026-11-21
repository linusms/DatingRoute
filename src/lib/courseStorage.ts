import type { CoursePlace } from './types';

/**
 * Decodes the legacy `?shared=` links (base64 JSON in the URL) made by older builds.
 * New shares use read-only pages at /s/<shareId>; these links are still honored by
 * importing them as a new course after sign-in.
 */
export function decodeCourseFromUrl(param: string): { name: string; description: string; places: CoursePlace[] } | null {
  try {
    const json = decodeURIComponent(atob(param));
    const data = JSON.parse(json);
    if (!Array.isArray(data?.p)) return null;
    const places: CoursePlace[] = data.p.slice(0, 100).map(
      (p: { t: string; a: string; x: number; y: number; c: string; m: string }, i: number) => ({
        id: `shared_${i}`,
        title: String(p.t || ''),
        category: String(p.c || ''),
        address: String(p.a || ''),
        roadAddress: String(p.a || ''),
        mapx: Number(p.x) || 0,
        mapy: Number(p.y) || 0,
        link: '',
        description: '',
        order: i,
        memo: String(p.m || ''),
        day: 1,
      })
    );
    return { name: String(data.n || ''), description: String(data.d || ''), places };
  } catch {
    return null;
  }
}

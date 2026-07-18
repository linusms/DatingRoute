import { Course, CoursePlace } from './types';

const STORAGE_KEY = 'datingroute_courses';

export function getCourses(): Course[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCourse(course: Course): void {
  const courses = getCourses();
  const idx = courses.findIndex((c) => c.id === course.id);
  if (idx >= 0) {
    courses[idx] = { ...course, updatedAt: new Date().toISOString() };
  } else {
    courses.push(course);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
}

export function deleteCourse(id: string): void {
  const courses = getCourses().filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
}

export function getCourseById(id: string): Course | undefined {
  return getCourses().find((c) => c.id === id);
}

export function generateCourseId(): string {
  return `course_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ---- URL-based sharing ---- */

export function encodeCourseToUrl(course: Course): string {
  const payload = {
    n: course.name,
    d: course.description,
    p: course.places.map((pl) => ({
      t: pl.title,
      a: pl.address,
      x: pl.mapx,
      y: pl.mapy,
      c: pl.category,
      m: pl.memo,
    })),
  };
  const encoded = btoa(
    encodeURIComponent(JSON.stringify(payload))
  );
  return `${window.location.origin}?shared=${encoded}`;
}

export function decodeCourseFromUrl(
  param: string
): Omit<Course, 'id' | 'createdAt' | 'updatedAt'> | null {
  try {
    const json = decodeURIComponent(atob(param));
    const data = JSON.parse(json);
    const places: CoursePlace[] = data.p.map(
      (
        p: { t: string; a: string; x: number; y: number; c: string; m: string },
        i: number
      ) => ({
        id: `shared_${i}`,
        title: p.t,
        category: p.c,
        address: p.a,
        roadAddress: p.a,
        mapx: p.x,
        mapy: p.y,
        link: '',
        description: '',
        order: i,
        memo: p.m,
      })
    );
    return { name: data.n, description: data.d, places };
  } catch {
    return null;
  }
}

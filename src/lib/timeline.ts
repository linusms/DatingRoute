import { DEFAULT_STAY_MINUTES, type CoursePlace, type DateSchedule, type TransitMode } from './types';
import { getStraightLineDistance, getWalkingTimeMs, katechToWgs84, parseCategoryToFacility } from './utils';

export const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

export interface TimelineEntry {
  arrival: number;   // minutes from midnight
  departure: number;
  stay: number;
  /** minutes of travel to the next place on the same day (undefined for the last one) */
  travelNext?: number;
  travelEstimated?: boolean;
  overEnd: boolean;
}

interface LegLike {
  fromId?: string;
  distance: number; // meters
  duration: number; // ms (driving)
}

export function stayMinutesOf(place: CoursePlace): number {
  if (typeof place.stayMinutes === 'number' && place.stayMinutes >= 0) return place.stayMinutes;
  return DEFAULT_STAY_MINUTES[parseCategoryToFacility(place.category)];
}

export function parseClock(hhmm: string | undefined, fallback: number): number {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return fallback;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** 810 -> "13:30"; past midnight -> "다음날 01:10" */
export function formatClock(minutes: number): string {
  const rounded = Math.round(minutes);
  const day = Math.floor(rounded / 1440);
  const m = ((rounded % 1440) + 1440) % 1440;
  const text = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return day > 0 ? `다음날 ${text}` : text;
}

function roundUp5(minutes: number): number {
  return Math.max(5, Math.ceil(minutes / 5) * 5);
}

/** Travel minutes between two places: a computed route leg when available, else a straight-line estimate. */
function travelMinutes(a: CoursePlace, b: CoursePlace, mode: TransitMode, leg?: LegLike): { minutes: number; estimated: boolean } {
  if (leg) {
    const ms = mode === 'walking' ? getWalkingTimeMs(leg.distance) : leg.duration;
    return { minutes: roundUp5(ms / 60000), estimated: false };
  }
  const pa = katechToWgs84(a.mapx, a.mapy);
  const pb = katechToWgs84(b.mapx, b.mapy);
  const meters = getStraightLineDistance(pa.lat, pa.lng, pb.lat, pb.lng);
  const ms = mode === 'walking' ? getWalkingTimeMs(meters) : ((meters * 1.3) / 25000) * 3600000 + 5 * 60000;
  return { minutes: roundUp5(ms / 60000), estimated: true };
}

/**
 * Arrival/departure times for one day's places, in visiting order.
 * Starts at the schedule's start time (default 12:00) and warns past its end time.
 */
export function computeDayTimeline(
  dayPlaces: CoursePlace[],
  schedule: DateSchedule | null,
  mode: TransitMode,
  legs: LegLike[] = []
): Map<string, TimelineEntry> {
  const start = parseClock(schedule?.startTime, 12 * 60);
  const end = schedule?.endTime ? parseClock(schedule.endTime, 24 * 60) : null;
  const legByFrom = new Map(legs.filter((l) => l.fromId).map((l) => [l.fromId as string, l]));

  const result = new Map<string, TimelineEntry>();
  let clock = start;
  dayPlaces.forEach((place, i) => {
    const stay = stayMinutesOf(place);
    const arrival = clock;
    const departure = arrival + stay;
    const next = dayPlaces[i + 1];
    const travel = next ? travelMinutes(place, next, mode, legByFrom.get(place.id)) : null;
    result.set(place.id, {
      arrival,
      departure,
      stay,
      travelNext: travel?.minutes,
      travelEstimated: travel?.estimated,
      overEnd: end !== null && end > start ? departure > end : false,
    });
    clock = departure + (travel?.minutes ?? 0);
  });
  return result;
}

/** ISO date (YYYY-MM-DD) of Day N, or null without a schedule. */
export function dateOfDay(schedule: DateSchedule | null, day: number): string | null {
  if (!schedule?.startDate || day < 1) return null;
  const d = new Date(`${schedule.startDate}T00:00:00`);
  d.setDate(d.getDate() + day - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Which Day N is today, or null when today is outside the schedule. */
export function todayDayNumber(schedule: DateSchedule | null): number | null {
  if (!schedule?.startDate) return null;
  const today = todayISO();
  const end = schedule.endDate || schedule.startDate;
  if (today < schedule.startDate || today > end) return null;
  const diff = Math.round((Date.parse(`${today}T00:00:00`) - Date.parse(`${schedule.startDate}T00:00:00`)) / 86400000);
  return diff + 1;
}

/** True when a TourAPI "쉬는날" text mentions the weekday of the given date (e.g. "매주 월요일"). */
export function isLikelyClosed(restDate: string | undefined, isoDate: string | null): boolean {
  if (!restDate || !isoDate || /연중무휴|없음/.test(restDate)) return false;
  const weekday = WEEKDAYS_KO[new Date(`${isoDate}T00:00:00`).getDay()];
  return restDate.includes(`${weekday}요일`);
}

export function formatWon(value: number): string {
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

import type { DateSchedule } from './types';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** "2026-11-21" -> "20261121" */
export function toTourDate(isoDate: string): string {
  return isoDate.replace(/-/g, '').slice(0, 8);
}

function season(month: number): string {
  if (month >= 3 && month <= 5) return '봄';
  if (month >= 6 && month <= 8) return '여름';
  if (month >= 9 && month <= 11) return '가을';
  return '겨울';
}

/** Human-readable schedule for AI prompts, e.g. "2026-11-21(토) 12:00~22:00, 가을". */
export function describeSchedule(schedule: DateSchedule | null): string {
  if (!schedule?.startDate) return '정해지지 않음';
  const start = new Date(`${schedule.startDate}T00:00:00`);
  const weekday = WEEKDAYS[start.getDay()];
  const range = schedule.endDate && schedule.endDate !== schedule.startDate
    ? `${schedule.startDate}(${weekday}) ~ ${schedule.endDate}`
    : `${schedule.startDate}(${weekday})`;
  return `${range} ${schedule.startTime || ''}~${schedule.endTime || ''}, ${season(start.getMonth() + 1)}`.trim();
}

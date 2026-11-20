'use client';

import type { CoursePlace } from '@/lib/types';

interface DayTabsProps {
  dayCount: number;
  activeDayTab: 'all' | number;
  onChange: (tab: 'all' | number) => void;
  getDayLabel: (day: number) => string;
  places: CoursePlace[];
  todayDay: number | null;
}

export default function DayTabs({ dayCount, activeDayTab, onChange, getDayLabel, places, todayDay }: DayTabsProps) {
  const countOf = (day: number) => places.filter((p) => (p.day ?? 0) === day).length;
  const tab = (key: 'all' | number, label: string, count?: number) => (
    <button
      key={String(key)}
      onClick={() => onChange(key)}
      className={`cb-day-tab ${activeDayTab === key ? 'active' : ''}`}
    >
      {label}
      {typeof key === 'number' && key > 0 && key === todayDay && <span className="cb-today-dot" title="오늘" />}
      {count !== undefined && count > 0 && <span className="cb-day-count">{count}</span>}
    </button>
  );

  return (
    <div className="cb-day-tabs custom-scrollbar">
      {tab('all', '전체')}
      {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) => tab(day, getDayLabel(day), countOf(day)))}
      {tab(0, getDayLabel(0), countOf(0))}
    </div>
  );
}

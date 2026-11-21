'use client';

import type { CoursePlace, PlaceUpdatableFields } from '@/lib/types';
import { stripHtml } from '@/lib/utils';
import { formatClock, type TimelineEntry } from '@/lib/timeline';
import { kakaoDirectionsToUrl } from '@/lib/links';

interface DayOfBannerProps {
  day: number;
  dayPlaces: CoursePlace[];
  timeline: Map<string, TimelineEntry>;
  onUpdatePlace: (id: string, fields: PlaceUpdatableFields) => void;
  onOpenDay: () => void;
}

/** Shown on the date itself: what's next, directions there, and a one-tap "arrived". */
export default function DayOfBanner({ day, dayPlaces, timeline, onUpdatePlace, onOpenDay }: DayOfBannerProps) {
  if (dayPlaces.length === 0) return null;
  const visitedCount = dayPlaces.filter((p) => p.visitedAt).length;
  const next = dayPlaces.find((p) => !p.visitedAt);
  const entry = next ? timeline.get(next.id) : undefined;

  return (
    <div className="cb-dayof">
      <div className="cb-dayof-head">
        <span className="cb-dayof-title">💕 오늘은 Day {day} 데이트 날!</span>
        <button className="cb-text-btn" onClick={onOpenDay}>{visitedCount}/{dayPlaces.length} 방문 · 일정 보기</button>
      </div>
      {next ? (
        <div className="cb-dayof-next">
          <div className="cb-dayof-label">다음 장소{entry ? ` · ${formatClock(entry.arrival)} 도착 예정` : ''}</div>
          <div className="cb-dayof-place">{stripHtml(next.title)}</div>
          <div className="cb-dayof-actions">
            <a className="btn btn-secondary btn-sm" href={kakaoDirectionsToUrl(next)} target="_blank" rel="noreferrer">🧭 길찾기</a>
            <button className="btn btn-primary btn-sm" onClick={() => onUpdatePlace(next.id, { visitedAt: new Date().toISOString() })}>
              ✓ 도착했어요
            </button>
          </div>
        </div>
      ) : (
        <div className="cb-dayof-next">
          <div className="cb-dayof-place">오늘 코스를 모두 다녀왔어요 🎉</div>
          <div className="cb-dayof-label">장소마다 별점과 사진으로 추억을 남겨보세요.</div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useRef, useCallback } from 'react';
import type { CoursePlace, DateSchedule, DirectionResult, TransitMode } from '@/lib/types';
import { formatDuration, stripHtml } from '@/lib/utils';
import { computeDayTimeline, dateOfDay, formatClock, WEEKDAYS_KO } from '@/lib/timeline';

interface ShareCardProps {
  places: CoursePlace[];
  directions: DirectionResult | null;
  schedule?: DateSchedule | null;
  transitMode?: TransitMode;
  courseName?: string;
}

export default function ShareCard({ places, directions, schedule = null, transitMode = 'driving', courseName }: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownloadImage = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#FCFCFC',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `데이트코스_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Image generation failed:', err);
    }
  }, []);

  const dayPlaces = places.filter((p) => (p.day ?? 0) > 0);
  if (dayPlaces.length === 0) return null;

  const grouped = new Map<number, CoursePlace[]>();
  for (const p of dayPlaces) {
    const d = p.day as number;
    (grouped.get(d) ?? grouped.set(d, []).get(d)!).push(p);
  }
  const days = Array.from(grouped.keys()).sort((a, b) => a - b);
  const legs = directions?.legs ?? [];

  return (
    <div className="share-card-wrapper">
      <div ref={cardRef} className="share-card">
        <div className="share-card-header">
          <div className="share-card-logo">💕</div>
          <div>
            <div className="share-card-brand">DatingRoute</div>
            <div className="share-card-name">{courseName || '나의 데이트 코스'}</div>
          </div>
        </div>

        <div className="share-card-places">
          {days.map((day) => {
            const list = grouped.get(day)!;
            const timeline = computeDayTimeline(list, schedule, transitMode, legs);
            const iso = dateOfDay(schedule, day);
            const dateLabel = iso ? (() => {
              const d = new Date(`${iso}T00:00:00`);
              return ` · ${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS_KO[d.getDay()]})`;
            })() : '';
            return (
              <div key={`day-${day}`} className="share-card-day-section">
                {(days.length > 1 || dateLabel) && (
                  <div className="share-card-day-header">Day {day}{dateLabel}</div>
                )}
                {list.map((place, idx) => {
                  const t = timeline.get(place.id);
                  return (
                    <div key={place.id} className="share-card-place">
                      <div className="share-card-number">{idx + 1}</div>
                      <div className="share-card-place-info">
                        <div className="share-card-place-name">
                          {stripHtml(place.title)}
                          {t && <span className="share-card-time">{formatClock(t.arrival)}</span>}
                        </div>
                        <div className="share-card-place-addr">{place.roadAddress || place.address}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {directions && (
          <div className="share-card-stats">
            <div className="share-card-stat">
              <span className="share-card-stat-label">총 이동거리</span>
              <span className="share-card-stat-value">{(directions.totalDistance / 1000).toFixed(1)}km</span>
            </div>
            <div className="share-card-stat">
              <span className="share-card-stat-label">총 이동시간</span>
              <span className="share-card-stat-value">{formatDuration(directions.totalDuration)}</span>
            </div>
          </div>
        )}

        <div className="share-card-footer">DatingRoute로 만든 데이트 코스 💕</div>
      </div>

      <button className="btn btn-primary share-download-btn" onClick={handleDownloadImage}>
        📷 이미지로 저장
      </button>
    </div>
  );
}

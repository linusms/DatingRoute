'use client';

import React, { useRef, useCallback } from 'react';
import { CoursePlace, DirectionResult } from '@/lib/types';
import { formatDuration, formatDistance, stripHtml } from '@/lib/utils';

interface ShareCardProps {
  places: CoursePlace[];
  directions: DirectionResult | null;
  courseName?: string;
}

export default function ShareCard({ places, directions, courseName }: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownloadImage = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#1e1826',
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

  if (places.length === 0) return null;

  return (
    <div className="share-card-wrapper">
      {/* The actual card to be captured */}
      <div ref={cardRef} className="share-card">
        <div className="share-card-header">
          <div className="share-card-logo">💕</div>
          <div>
            <div className="share-card-brand">DatingRoute</div>
            <div className="share-card-name">{courseName || '나의 데이트 코스'}</div>
          </div>
        </div>

        <div className="share-card-places">
          {(() => {
            const assignedPlaces = places.filter(p => (p.day || 0) > 0);
            const displayPlaces = assignedPlaces.length > 0 ? assignedPlaces : places;
            
            // Group by day
            const grouped: Record<number, CoursePlace[]> = {};
            displayPlaces.forEach(p => {
              const d = p.day || 1;
              if (!grouped[d]) grouped[d] = [];
              grouped[d].push(p);
            });
            const days = Object.keys(grouped).map(Number).sort((a,b) => a-b);
            
            return days.map(day => (
              <div key={`day-${day}`} className="share-card-day-section">
                {days.length > 1 && (
                  <div className="share-card-day-header" style={{
                    fontSize: '14px', fontWeight: 'bold', color: '#f472b6', 
                    padding: '8px 0 4px', borderBottom: '1px dashed rgba(244,114,182,0.3)',
                    marginBottom: '8px'
                  }}>
                    Day {day}
                  </div>
                )}
                {grouped[day].map((place, idx) => (
                  <div key={place.id} className="share-card-place">
                    <div className="share-card-number">{idx + 1}</div>
                    <div className="share-card-place-info">
                      <div className="share-card-place-name">{stripHtml(place.title)}</div>
                      <div className="share-card-place-addr">{place.roadAddress || place.address}</div>
                    </div>
                  </div>
                ))}
              </div>
            ));
          })()}
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

        <div className="share-card-footer">
          DatingRoute로 만든 데이트 코스 💕
        </div>
      </div>

      {/* Download button */}
      <button
        className="btn btn-primary share-download-btn"
        onClick={handleDownloadImage}
      >
        📷 이미지로 저장
      </button>
    </div>
  );
}

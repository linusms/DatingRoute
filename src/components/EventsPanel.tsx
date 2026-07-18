'use client';

import React, { useState, useCallback } from 'react';
import { DateSchedule, FestivalEvent, TrendPlace, Place } from '@/lib/types';
import { stripHtml, tourDateToISO } from '@/lib/utils';
import DateSchedulePicker from './DateSchedulePicker';

interface EventsPanelProps {
  onAddPlace: (place: Place) => void;
  onHighlightPlace?: (place: Place | null) => void;
}

export default function EventsPanel({ onAddPlace, onHighlightPlace }: EventsPanelProps) {
  const [schedule, setSchedule] = useState<DateSchedule | null>(null);
  const [events, setEvents] = useState<FestivalEvent[]>([]);
  const [trendPlaces, setTrendPlaces] = useState<TrendPlace[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeSection, setActiveSection] = useState<'events' | 'trends'>('trends');

  const handleSearch = useCallback(async () => {
    if (!schedule) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const startDate = schedule.startDate.replace(/-/g, '');
      const endDate = schedule.endDate.replace(/-/g, '');

      const res = await fetch(`/api/events?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error('이벤트 검색에 실패했습니다.');

      const data = await res.json();
      setEvents(data.events || []);
      setTrendPlaces(data.trendPlaces || []);

      // Auto-switch to section with results
      if (data.events?.length > 0) {
        setActiveSection('events');
      } else if (data.trendPlaces?.length > 0) {
        setActiveSection('trends');
      }
    } catch (err: any) {
      setError(err.message || '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [schedule]);

  const eventToPlace = (event: FestivalEvent): Place => ({
    id: event.contentId || Math.random().toString(36).slice(2, 9),
    title: event.title,
    category: event.category || '행사',
    address: event.address,
    roadAddress: event.address,
    mapx: event.mapx ? event.mapx * 10_000_000 : 0, // TourAPI returns WGS84 directly
    mapy: event.mapy ? event.mapy * 10_000_000 : 0,
    link: '',
    description: '',
  });

  const trendToPlace = (trend: TrendPlace): Place => ({
    id: Math.random().toString(36).slice(2, 9),
    title: trend.title,
    category: trend.category || '핫플',
    address: trend.address,
    roadAddress: trend.roadAddress,
    mapx: trend.mapx,
    mapy: trend.mapy,
    link: trend.link,
    description: trend.reason,
  });

  const formatEventDate = (start: string, end: string) => {
    const s = tourDateToISO(start);
    const e = tourDateToISO(end);
    if (s === e) return s;
    return `${s} ~ ${e}`;
  };

  return (
    <div className="events-panel">
      <DateSchedulePicker
        schedule={schedule}
        onScheduleChange={setSchedule}
        onSearch={handleSearch}
        isLoading={isLoading}
      />

      {/* Results */}
      {hasSearched && !isLoading && (
        <div className="events-results animate-fade-in">
          {error && (
            <div className="events-error">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Section Tabs */}
          {!error && (
            <>
              <div className="events-section-tabs">
                <button
                  className={`events-section-tab ${activeSection === 'events' ? 'active' : ''}`}
                  onClick={() => setActiveSection('events')}
                >
                  🎪 행사/축제
                  {events.length > 0 && (
                    <span className="events-count">{events.length}</span>
                  )}
                </button>
                <button
                  className={`events-section-tab ${activeSection === 'trends' ? 'active' : ''}`}
                  onClick={() => setActiveSection('trends')}
                >
                  🔥 트렌드
                  {trendPlaces.length > 0 && (
                    <span className="events-count">{trendPlaces.length}</span>
                  )}
                </button>
              </div>

              {/* Events Section */}
              {activeSection === 'events' && (
                <div className="events-list stagger-children">
                  {events.length === 0 ? (
                    <div className="events-empty">
                      <div className="events-empty-icon">🎪</div>
                      <p>해당 기간에 등록된 행사가 없습니다</p>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        트렌드 탭에서 AI 추천을 확인해보세요!
                      </p>
                    </div>
                  ) : (
                    events.map((event) => (
                      <div
                        key={event.contentId}
                        className="event-card"
                        onMouseEnter={() => {
                          if (event.mapx && event.mapy) {
                            onHighlightPlace?.(eventToPlace(event));
                          }
                        }}
                        onMouseLeave={() => onHighlightPlace?.(null)}
                      >
                        {event.imageUrl && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={event.imageUrl}
                            alt={event.title}
                            className="event-card-image"
                          />
                        )}
                        <div className="event-card-content">
                          <div className="event-card-header">
                            <h3 className="event-card-title">{stripHtml(event.title)}</h3>
                            <span className="event-card-badge">행사</span>
                          </div>
                          <div className="event-card-date">
                            📅 {formatEventDate(event.startDate, event.endDate)}
                          </div>
                          <div className="event-card-address">
                            📍 {event.address || '주소 정보 없음'}
                          </div>
                          <div className="event-card-actions">
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => onAddPlace(eventToPlace(event))}
                            >
                              + 코스 추가
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Trends Section */}
              {activeSection === 'trends' && (
                <div className="events-list stagger-children">
                  {trendPlaces.length === 0 ? (
                    <div className="events-empty">
                      <div className="events-empty-icon">🔥</div>
                      <p>트렌드 추천을 가져오지 못했습니다</p>
                    </div>
                  ) : (
                    trendPlaces.map((trend, idx) => (
                      <div
                        key={`trend-${idx}-${trend.mapx}`}
                        className="event-card trend-card"
                        onMouseEnter={() => {
                          if (trend.mapx && trend.mapy) {
                            onHighlightPlace?.(trendToPlace(trend));
                          }
                        }}
                        onMouseLeave={() => onHighlightPlace?.(null)}
                      >
                        <div className="event-card-content">
                          <div className="event-card-header">
                            <h3 className="event-card-title">
                              <span style={{ color: '#fb923c', marginRight: '4px' }}>★</span>
                              {stripHtml(trend.title)}
                            </h3>
                            <span className="event-card-badge trend-badge">핫플</span>
                          </div>
                          <div className="event-card-reason">
                            ✨ {trend.reason}
                          </div>
                          <div className="event-card-address">
                            📍 {trend.roadAddress || trend.address || '주소 정보 없음'}
                          </div>
                          <div className="event-card-actions">
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => onAddPlace(trendToPlace(trend))}
                            >
                              + 코스 추가
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

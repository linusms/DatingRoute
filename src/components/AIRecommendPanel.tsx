'use client';

import React, { useState, useCallback } from 'react';
import { CoursePlace, DateSchedule, RecommendedPlace, RegionEvent, Place } from '@/lib/types';
import { stripHtml, tourDateToISO } from '@/lib/utils';
import DateSchedulePicker from './DateSchedulePicker';

interface AIRecommendPanelProps {
  coursePlaces: CoursePlace[];
  onAddPlace: (place: Place) => void;
  onHighlightPlace?: (place: Place | null) => void;
}

export default function AIRecommendPanel({
  coursePlaces,
  onAddPlace,
  onHighlightPlace,
}: AIRecommendPanelProps) {
  const [schedule, setSchedule] = useState<DateSchedule | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendedPlace[]>([]);
  const [events, setEvents] = useState<RegionEvent[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeSection, setActiveSection] = useState<'recommend' | 'events'>('recommend');

  const handleAIRecommend = useCallback(async () => {
    if (coursePlaces.length === 0) {
      setError('먼저 장소검색 탭에서 장소를 1개 이상 추가해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await fetch('/api/ai-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          places: coursePlaces.map(p => ({
            title: p.title,
            address: p.address,
            roadAddress: p.roadAddress,
            mapx: p.mapx,
            mapy: p.mapy,
          })),
          schedule: schedule ? {
            startDate: schedule.startDate,
            endDate: schedule.endDate,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
          } : null,
        }),
      });

      if (!res.ok) throw new Error('AI 추천을 가져오는데 실패했습니다.');

      const data = await res.json();
      setRecommendations(data.recommendations || []);
      setEvents(data.events || []);
      setSummary(data.summary || '');

      // Auto switch to section with content
      if (data.events?.length > 0 && data.recommendations?.length === 0) {
        setActiveSection('events');
      } else {
        setActiveSection('recommend');
      }
    } catch (err: any) {
      setError(err.message || '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [coursePlaces, schedule]);

  const recToPlace = (rec: RecommendedPlace): Place => ({
    id: Math.random().toString(36).slice(2, 9),
    title: rec.name,
    category: rec.category || '추천',
    address: rec.address,
    roadAddress: rec.roadAddress,
    mapx: rec.mapx,
    mapy: rec.mapy,
    link: rec.link,
    description: rec.reason,
  });

  const eventToPlace = (event: RegionEvent): Place => ({
    id: event.contentId || Math.random().toString(36).slice(2, 9),
    title: event.title,
    category: event.category || '행사',
    address: event.address,
    roadAddress: event.address,
    mapx: event.mapx ? event.mapx * 10_000_000 : 0,
    mapy: event.mapy ? event.mapy * 10_000_000 : 0,
    link: '',
    description: '',
  });

  const formatEventDate = (start: string, end: string) => {
    const s = tourDateToISO(start);
    const e = tourDateToISO(end);
    if (s === e) return s;
    return `${s} ~ ${e}`;
  };

  return (
    <div className="ai-recommend-panel">
      {/* Schedule Picker */}
      <DateSchedulePicker
        schedule={schedule}
        onScheduleChange={setSchedule}
        onSearch={handleAIRecommend}
        isLoading={isLoading}
      />

      {/* Course places summary */}
      {coursePlaces.length > 0 && (
        <div className="ai-places-summary">
          <div className="ai-places-summary-label">
            📍 담은 장소 ({coursePlaces.length}곳)
          </div>
          <div className="ai-places-chips">
            {coursePlaces.map((p, i) => (
              <span key={p.id} className="ai-place-chip">
                {i + 1}. {stripHtml(p.title)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI Recommend Button */}
      <button
        className="btn btn-primary ai-recommend-btn"
        onClick={handleAIRecommend}
        disabled={isLoading || coursePlaces.length === 0}
      >
        {isLoading ? (
          <>
            <span className="dsp-spinner" />
            AI 분석 중...
          </>
        ) : (
          <>✨ AI 요약 추천</>
        )}
      </button>

      {coursePlaces.length === 0 && !hasSearched && (
        <div className="ai-empty-state">
          <div className="ai-empty-icon">✨</div>
          <h4>AI 추천을 받아보세요!</h4>
          <p>
            장소검색 탭에서 가고 싶은 장소를 추가한 뒤
            <br />
            날짜를 설정하고 AI 추천 버튼을 눌러주세요
          </p>
        </div>
      )}

      {/* Results */}
      {hasSearched && !isLoading && (
        <div className="ai-results animate-fade-in">
          {error && (
            <div className="ai-error">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Summary */}
          {summary && !error && (
            <div className="ai-summary-card">
              <span className="ai-summary-icon">✨</span>
              <p>{summary}</p>
            </div>
          )}

          {/* Section Tabs */}
          {!error && (
            <>
              <div className="ai-section-tabs">
                <button
                  className={`ai-section-tab ${activeSection === 'recommend' ? 'active' : ''}`}
                  onClick={() => setActiveSection('recommend')}
                >
                  ✨ AI 추천 장소
                  {recommendations.length > 0 && (
                    <span className="ai-count-badge">{recommendations.length}</span>
                  )}
                </button>
                <button
                  className={`ai-section-tab ${activeSection === 'events' ? 'active' : ''}`}
                  onClick={() => setActiveSection('events')}
                >
                  🎪 행사/축제
                  {events.length > 0 && (
                    <span className="ai-count-badge">{events.length}</span>
                  )}
                </button>
              </div>

              {/* Recommendations */}
              {activeSection === 'recommend' && (
                <div className="ai-list stagger-children">
                  {recommendations.length === 0 ? (
                    <div className="ai-empty-section">
                      <div className="ai-empty-section-icon">✨</div>
                      <p>추천 장소를 가져오지 못했습니다</p>
                    </div>
                  ) : (
                    recommendations.map((rec, idx) => (
                      <div
                        key={`rec-${idx}-${rec.mapx}`}
                        className="ai-rec-card"
                        onMouseEnter={() => onHighlightPlace?.(recToPlace(rec))}
                        onMouseLeave={() => onHighlightPlace?.(null)}
                      >
                        <div className="ai-rec-header">
                          <h3 className="ai-rec-title">
                            <span className="ai-rec-star">★</span>
                            {rec.name}
                          </h3>
                          <span className="ai-rec-category">{rec.category}</span>
                        </div>
                        <p className="ai-rec-reason">{rec.reason}</p>
                        {rec.keywords && rec.keywords.length > 0 && (
                          <div className="ai-rec-keywords">
                            {rec.keywords.map((kw, ki) => (
                              <span key={ki} className="ai-keyword-tag">#{kw}</span>
                            ))}
                          </div>
                        )}
                        <div className="ai-rec-address">
                          📍 {rec.roadAddress || rec.address || '주소 정보 없음'}
                        </div>
                        <div className="ai-rec-actions">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => onAddPlace(recToPlace(rec))}
                          >
                            + 경로 추가
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Events */}
              {activeSection === 'events' && (
                <div className="ai-list stagger-children">
                  {events.length === 0 ? (
                    <div className="ai-empty-section">
                      <div className="ai-empty-section-icon">🎪</div>
                      <p>해당 기간/지역에 등록된 행사가 없습니다</p>
                    </div>
                  ) : (
                    events.map((event) => (
                      <div
                        key={event.contentId}
                        className="ai-event-card"
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
                            className="ai-event-image"
                          />
                        )}
                        <div className="ai-event-content">
                          <div className="ai-event-header">
                            <h3 className="ai-event-title">{stripHtml(event.title)}</h3>
                            <span className="ai-event-badge">행사</span>
                          </div>
                          <div className="ai-event-date">
                            📅 {formatEventDate(event.startDate, event.endDate)}
                          </div>
                          <div className="ai-event-address">
                            📍 {event.address || '주소 정보 없음'}
                          </div>
                          <div className="ai-event-actions">
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => onAddPlace(eventToPlace(event))}
                            >
                              + 경로 추가
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

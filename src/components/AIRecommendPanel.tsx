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
  
  // Real-time status state
  const [isLoading, setIsLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(4);
  const [statusMessage, setStatusMessage] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeSection, setActiveSection] = useState<'recommend' | 'events'>('recommend');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [isPlacesSummaryExpanded, setIsPlacesSummaryExpanded] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const handleAIRecommend = useCallback(async (isLoadMore?: boolean) => {
    const loadMore = isLoadMore === true;
    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setError(null);
      setHasSearched(true);
      setProgressStep(1);
      setStatusMessage('🚀 AI 데이터 분석 준비 중...');
    }

    try {
      const response = await fetch('/api/ai-recommend', {
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
          excludePlaces: loadMore ? recommendations.map(r => r.name) : [],
          schedule: schedule ? {
            startDate: schedule.startDate,
            endDate: schedule.endDate,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
          } : null,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('AI 추천 수집에 실패했습니다.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'progress') {
                setProgressStep(data.step);
                setTotalSteps(data.total);
                setStatusMessage(data.message);
              } else if (data.type === 'result') {
                if (loadMore) {
                  setRecommendations(prev => [...prev, ...(data.recommendations || [])]);
                  setEvents(prev => {
                     const existingIds = new Set(prev.map(e => e.contentId));
                     return [...prev, ...(data.events || []).filter((e: any) => !existingIds.has(e.contentId))];
                  });
                } else {
                  setRecommendations(data.recommendations || []);
                  setEvents(data.events || []);
                  setSummary(data.summary || '');
                }
              } else if (data.type === 'error') {
                setError(data.message);
              }
            } catch {
              // skip parse error
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || '오류가 발생했습니다.');
    } finally {
      if (loadMore) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [coursePlaces, schedule, recommendations]);

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
    category: '행사/축제',
    address: event.address,
    roadAddress: event.address,
    mapx: event.mapx ? Math.round(event.mapx * 10_000_000) : 0,
    mapy: event.mapy ? Math.round(event.mapy * 10_000_000) : 0,
    link: event.contentId
      ? `https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=${event.contentId}`
      : '',
    description: `${formatEventDate(event.startDate, event.endDate)}`,
  });

  const formatEventDate = (start: string, end: string) => {
    const s = tourDateToISO(start);
    const e = tourDateToISO(end);
    if (s === e) return s;
    return `${s} ~ ${e}`;
  };

  const getSourceIcon = (sourceType?: string) => {
    if (sourceType === 'youtube') return '▶️ YouTube';
    if (sourceType === 'event') return '🎪 행사/축제';
    if (sourceType === 'popup') return '🛍️ 팝업스토어';
    return '📝 네이버 블로그';
  };

  return (
    <div className="ai-recommend-panel">
      {/* Calendar Date Picker with Single Search Button */}
      <DateSchedulePicker
        schedule={schedule}
        onScheduleChange={setSchedule}
        onSearch={handleAIRecommend}
        isLoading={isLoading}
      />

      {/* Selected Places Hint */}
      {coursePlaces.length > 0 && (
        <div className="ai-places-summary">
          <div 
            className="ai-places-summary-label" 
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            onClick={() => setIsPlacesSummaryExpanded(!isPlacesSummaryExpanded)}
          >
            <span>📍 코스 추가된 장소 ({coursePlaces.length}곳)</span>
            <span style={{ transform: isPlacesSummaryExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
          </div>
          {isPlacesSummaryExpanded && (
            <div className="ai-places-chips" style={{ marginTop: '12px' }}>
              {coursePlaces.map((p, i) => (
                <span key={p.id} className="ai-place-chip">
                  {i + 1}. {stripHtml(p.title)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Real-time Loading Status Modal / Card */}
      {isLoading && (
        <div className="ai-realtime-loading-card animate-scale-in">
          <div className="ai-loading-spinner-wrapper">
            <div className="ai-loading-pulse-ring" />
            <div className="ai-loading-icon">✨</div>
          </div>
          <div className="ai-loading-status-text">
            {statusMessage || '실시간 정보 수집 중...'}
          </div>
          <div className="ai-loading-progress-bar-bg">
            <div
              className="ai-loading-progress-bar-fill"
              style={{ width: `${(progressStep / totalSteps) * 100}%` }}
            />
          </div>
          <div className="ai-loading-step-count">
            [{progressStep} / {totalSteps}] 단계 진행 중...
          </div>
        </div>
      )}

      {/* Empty State before search */}
      {!hasSearched && !isLoading && (
        <div className="ai-empty-state">
          <div className="ai-empty-icon">📅</div>
          <h4>데이트 일정에 맞는 AI 추천</h4>
          <p>
            위 달력에서 데이트할 기간을 선택한 후
            <br />
            <strong>[🔍 검색]</strong> 버튼을 누르면 YouTube, 네이버 블로그,
            <br />
            한국관광공사의 핫플, 팝업스토어, 축제가 자동으로 정리됩니다!
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

          {/* AI Summary Removed */}

          {/* Section Tabs */}
          {!error && (
            <>
              <div className="ai-section-tabs">
                <button
                  className={`ai-section-tab ${activeSection === 'recommend' ? 'active' : ''}`}
                  onClick={() => setActiveSection('recommend')}
                >
                  ✨ AI 추천 핫플/팝업
                  {recommendations.length > 0 && (
                    <span className="ai-count-badge">{recommendations.length}</span>
                  )}
                </button>
                <button
                  className={`ai-section-tab ${activeSection === 'events' ? 'active' : ''}`}
                  onClick={() => setActiveSection('events')}
                >
                  🎪 지역 행사/축제
                  {events.length > 0 && (
                    <span className="ai-count-badge">{events.length}</span>
                  )}
                </button>
              </div>

              {/* Recommended Places */}
              {activeSection === 'recommend' && (
                <div className="ai-list stagger-children">
                  {recommendations.length === 0 ? (
                    <div className="ai-empty-section">
                      <div className="ai-empty-section-icon">✨</div>
                      <p>추천 장소를 불러오지 못했습니다</p>
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
                        <div style={{ marginBottom: '6px' }}>
                          <span style={{
                            fontSize: '11px', padding: '2px 6px', borderRadius: '4px',
                            background: 'rgba(255,255,255,0.06)', color: '#f472b6', fontWeight: 600,
                            cursor: rec.link ? 'pointer' : 'default',
                            display: 'inline-block'
                          }}
                          onClick={(e) => {
                            if (rec.link) {
                              e.stopPropagation();
                              window.open(rec.link, '_blank');
                            }
                          }}>
                            {getSourceIcon((rec as any).sourceType)}
                          </span>
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
                  {recommendations.length > 0 && (
                    <button 
                      className="btn btn-secondary" 
                      style={{ width: '100%', marginTop: '16px', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer' }}
                      onClick={() => handleAIRecommend(true)}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? '더 불러오는 중...' : '+ 더 불러오기'}
                    </button>
                  )}
                </div>
              )}

              {/* Regional Events */}
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
                        className={`ai-event-card ${expandedEventId === event.contentId ? 'expanded' : ''}`}
                        onMouseEnter={() => {
                          if (event.mapx && event.mapy) {
                            onHighlightPlace?.(eventToPlace(event));
                          }
                        }}
                        onMouseLeave={() => onHighlightPlace?.(null)}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setExpandedEventId(prev => prev === event.contentId ? null : event.contentId)}
                      >
                        <div className="ai-event-header-compact" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h3 className="ai-event-title" style={{ margin: 0, fontSize: '15px' }}>{stripHtml(event.title)}</h3>
                            <div className="ai-event-address" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
                              📍 {event.address || '주소 정보 없음'}
                            </div>
                          </div>
                          <span style={{ transform: expandedEventId === event.contentId ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
                        </div>
                        
                        {expandedEventId === event.contentId && (
                          <div className="ai-event-details" style={{ padding: '0 16px 16px 16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }} onClick={(e) => e.stopPropagation()}>
                            {event.imageUrl && (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={event.imageUrl}
                                alt={event.title}
                                className="ai-event-image"
                                style={{ borderRadius: '8px', marginBottom: '12px' }}
                              />
                            )}
                            <div className="ai-event-content" style={{ padding: 0 }}>
                              <div className="ai-event-date">
                                📅 {formatEventDate(event.startDate, event.endDate)}
                              </div>
                              <div className="ai-event-actions" style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => onAddPlace(eventToPlace(event))}
                                >
                                  + 경로 추가
                                </button>
                                {event.contentId && (
                                  <button
                                    className="btn btn-sm"
                                    style={{
                                      background: 'rgba(255,255,255,0.08)',
                                      color: '#f472b6',
                                      border: '1px solid rgba(244,114,182,0.3)',
                                      cursor: 'pointer',
                                      borderRadius: '6px',
                                      padding: '4px 10px',
                                      fontSize: '13px',
                                    }}
                                    onClick={() => window.open(
                                      `https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=${event.contentId}`,
                                      '_blank'
                                    )}
                                  >
                                    🔗 상세보기
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
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

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CoursePlace, DateSchedule, RecommendedPlace, RegionEvent, Place } from '@/lib/types';
import { stripHtml, tourDateToISO } from '@/lib/utils';
import DateSchedulePicker from './DateSchedulePicker';

interface AIRecommendPanelProps {
  coursePlaces: CoursePlace[];
  schedule: DateSchedule | null;
  onScheduleChange: (s: DateSchedule | null) => void;
  onAddPlace: (place: Place) => void;
  onHighlightPlace?: (place: Place | null) => void;
  roomId?: string | null;
}

// 카테고리 정의
const AI_CATEGORIES = [
  { id: 'restaurant', label: '🍽️ 식당', desc: '맛집/음식점' },
  { id: 'cafe', label: '☕ 카페', desc: '카페/디저트' },
  { id: 'activity', label: '🎯 액티비티/문화', desc: '체험/전시/공연' },
  { id: 'accommodation', label: '🏨 숙박시설', desc: '호텔/펜션/게스트하우스' },
];

export type SearchHistoryItem = {
  id: string;
  timestamp: number;
  conditions: {
    selectedPlaceId: string;
    radiusKm: number;
    categories: string[];
    sortOrder: string;
    searchKeyword?: string;
  };
  results: {
    recommendations: RecommendedPlace[];
    events: RegionEvent[];
    summary: string;
  };
};

export default function AIRecommendPanel({
  coursePlaces,
  schedule,
  onScheduleChange,
  onAddPlace,
  onHighlightPlace,
  roomId,
}: AIRecommendPanelProps) {
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

  const [recommendations, setRecommendations] = useState<RecommendedPlace[]>([]);
  const [events, setEvents] = useState<RegionEvent[]>([]);
  const [summary, setSummary] = useState<string>('');

  // 기준 장소 및 반경
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>('all');
  const [radiusKm, setRadiusKm] = useState<number>(5);

  // 카테고리 필터 및 키워드
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['restaurant', 'cafe', 'activity', 'accommodation']);
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Real-time status state
  const [isLoading, setIsLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(4);
  const [statusMessage, setStatusMessage] = useState('');
  
  // For cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeSection, setActiveSection] = useState<'recommend' | 'events'>('recommend');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [showCategory, setShowCategory] = useState(true);

  // Sorting
  const [sortOrder, setSortOrder] = useState<'default' | 'mention-desc' | 'mention-asc'>('default');

  // Resize state
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelSize, setPanelSize] = useState({ width: 600, height: 700 });
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPanelSize({ width: 600, height: Math.round(window.innerHeight * 0.85) });
    }
  }, []);

  // 로컬 스토리지에 캐싱 (경로(룸) 별로 AI 추천 유지, 없으면 로컬 전용)
  const storageKey = roomId ? `ai-recommend-history-${roomId}` : 'ai-recommend-history-local';

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.history && Array.isArray(data.history)) {
          setSearchHistory(data.history);
          if (data.activeId) {
            setActiveHistoryId(data.activeId);
            const activeItem = data.history.find((h: SearchHistoryItem) => h.id === data.activeId);
            if (activeItem) {
              loadHistoryItem(activeItem);
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to load AI recommend cache', e);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    if (searchHistory.length === 0) return;
    try {
      const data = {
        history: searchHistory,
        activeId: activeHistoryId
      };
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save AI recommend cache', e);
    }
  }, [storageKey, searchHistory, activeHistoryId]);

  // 진행 중이거나 더 불러오기 한 결과를 현재 활성화된 History Item에 동기화
  useEffect(() => {
    if (!activeHistoryId || !hasSearched) return;
    setSearchHistory(prev => prev.map(item => {
      if (item.id === activeHistoryId) {
        return {
          ...item,
          results: { recommendations, events, summary }
        };
      }
      return item;
    }));
  }, [activeHistoryId, recommendations, events, summary, hasSearched]);

  const loadHistoryItem = (item: SearchHistoryItem) => {
    setSelectedPlaceId(item.conditions.selectedPlaceId);
    setRadiusKm(item.conditions.radiusKm);
    setSelectedCategories(item.conditions.categories);
    setSortOrder(item.conditions.sortOrder as any);
    setSearchKeyword(item.conditions.searchKeyword || '');
    
    setRecommendations(item.results.recommendations);
    setEvents(item.results.events);
    setSummary(item.results.summary);
    setHasSearched(true);
    setShowPopup(true);
  };

  const handleNewSearch = () => {
    setActiveHistoryId(null);
    setHasSearched(false);
    setShowPopup(false);
    setRecommendations([]);
    setEvents([]);
    setSummary('');
  };

  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchHistory(prev => {
      const updated = prev.filter(h => h.id !== id);
      if (activeHistoryId === id) {
        // If deleting the currently active one, reset view
        handleNewSearch();
      }
      return updated;
    });
  };

  const isResizingRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      w: panelSize.width,
      h: panelSize.height,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizingRef.current) return;
      const dx = ev.clientX - resizeStartRef.current.x;
      const dy = ev.clientY - resizeStartRef.current.y;
      setPanelSize({
        width: Math.max(360, Math.min(window.innerWidth * 0.95, resizeStartRef.current.w + dx)),
        height: Math.max(400, Math.min(window.innerHeight * 0.98, resizeStartRef.current.h + dy)),
      });
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelSize]);

  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev =>
      prev.includes(catId)
        ? prev.filter(c => c !== catId)
        : [...prev, catId]
    );
  };

  const handleAIRecommend = useCallback(async (isLoadMore?: boolean) => {
    const loadMore = isLoadMore === true;
    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      handleNewSearch();
      setIsLoading(true);
      setError(null);
      setHasSearched(false);
      setProgressStep(1);
      setStatusMessage('🚀 AI 데이터 분석 준비 중...');
    }

    // 기준 장소 결정
    const centerPlace = selectedPlaceId === 'all'
      ? null
      : coursePlaces.find(p => p.id === selectedPlaceId) || null;

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/ai-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          places: coursePlaces.map(p => ({
            title: p.title,
            address: p.address,
            roadAddress: p.roadAddress,
            mapx: p.mapx,
            mapy: p.mapy,
          })),
          centerPlace: centerPlace ? {
            title: centerPlace.title,
            address: centerPlace.address,
            mapx: centerPlace.mapx,
            mapy: centerPlace.mapy,
          } : null,
          radiusKm,
          categories: selectedCategories,
          searchKeyword: searchKeyword.trim(),
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
                  setHasSearched(true);
                  setShowPopup(true);

                  const newId = Date.now().toString();
                  const newItem: SearchHistoryItem = {
                    id: newId,
                    timestamp: Date.now(),
                    conditions: {
                      selectedPlaceId,
                      radiusKm,
                      categories: selectedCategories,
                      sortOrder,
                      searchKeyword: searchKeyword.trim(),
                    },
                    results: {
                      recommendations: data.recommendations || [],
                      events: data.events || [],
                      summary: data.summary || ''
                    }
                  };
                  
                  setSearchHistory(prev => {
                    const updated = [newItem, ...prev];
                    return updated.slice(0, 10);
                  });
                  setActiveHistoryId(newId);
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
      if (err.name === 'AbortError') {
        setError('검색이 취소되었습니다.');
      } else {
        setError(err.message || '오류가 발생했습니다.');
      }
    } finally {
      abortControllerRef.current = null;
      if (loadMore) {
        setIsLoadingMore(false);
      } else {
        setIsLoading(false);
      }
    }
  }, [coursePlaces, schedule, recommendations, selectedPlaceId, radiusKm, selectedCategories]);

  const handleCancelSearch = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
    setIsLoadingMore(false);
    setShowPopup(false);
  };

  const recToPlace = (rec: RecommendedPlace): Place => ({
    id: Math.random().toString(36).slice(2, 9),
    title: rec.name,
    category: rec.category || '추천',
    address: rec.address || '',
    roadAddress: rec.roadAddress || '',
    mapx: rec.mapx || 0,
    mapy: rec.mapy || 0,
    link: rec.link || '',
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

  const sortedRecommendations = [...recommendations].sort((a, b) => {
    if (sortOrder === 'mention-desc') {
      return (b.mentionCount || 0) - (a.mentionCount || 0);
    }
    if (sortOrder === 'mention-asc') {
      return (a.mentionCount || 0) - (b.mentionCount || 0);
    }
    return 0; // default (기본 추천순)
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

  const selectedCenterPlace = coursePlaces.find(p => p.id === selectedPlaceId);

  return (
    <div className="ai-recommend-panel">
      {/* ── 검색 기록 리스트 ── */}
      {searchHistory.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(244,114,182,0.15)',
          borderRadius: '12px', padding: '14px', marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', color: '#8b7fa8', fontWeight: 600, letterSpacing: '0.5px' }}>
              🕒 최근 검색 기록
            </div>
            {activeHistoryId && (
              <button
                onClick={handleNewSearch}
                style={{
                  background: 'rgba(244,114,182,0.15)', border: '1px solid rgba(244,114,182,0.3)',
                  color: '#f472b6', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer'
                }}
              >
                + 새 검색
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={activeHistoryId || ''}
              onChange={e => {
                const id = e.target.value;
                if (id) {
                  setActiveHistoryId(id);
                  const item = searchHistory.find(h => h.id === id);
                  if (item) loadHistoryItem(item);
                } else {
                  handleNewSearch();
                }
              }}
              style={{
                flex: 1, padding: '8px 10px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(244,114,182,0.2)',
                color: '#f5f0ff', fontSize: '13px', cursor: 'pointer', outline: 'none'
              }}
            >
              <option value="" style={{ background: '#1a1520' }}>새로운 조건으로 검색하기...</option>
              {searchHistory.map(h => {
                const date = new Date(h.timestamp);
                const timeStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
                const cats = h.conditions.categories.map(c => AI_CATEGORIES.find(ac => ac.id === c)?.label.split(' ')[1] || c).join(', ');
                const kw = h.conditions.searchKeyword ? ` "${h.conditions.searchKeyword}"` : '';
                return (
                  <option key={h.id} value={h.id} style={{ background: '#1a1520' }}>
                    [{timeStr}] 반경 {h.conditions.radiusKm}km / {cats || '전체'}{kw}
                  </option>
                );
              })}
            </select>
            {activeHistoryId && (
              <button
                onClick={(e) => handleDeleteHistory(activeHistoryId, e)}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#ef4444', padding: '8px', borderRadius: '8px', cursor: 'pointer',
                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                title="현재 기록 삭제"
              >
                🗑️
              </button>
            )}
          </div>
        </div>
      )}

      {/* Calendar Date Picker */}
      <div style={{ marginBottom: '16px' }}>
        <DateSchedulePicker
          schedule={schedule}
          onScheduleChange={onScheduleChange}
        />
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
        <button 
          onClick={() => handleAIRecommend()}
          disabled={isLoading}
          className="btn btn-primary"
          style={{ padding: '10px 24px', fontSize: '14px', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {isLoading ? (statusMessage || '분석 중...') : '🔍 추천 검색'}
        </button>
        {isLoading && (
          <button 
            onClick={handleCancelSearch}
            className="btn btn-secondary"
            style={{ padding: '10px 16px', fontSize: '14px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.5)' }}
          >
            취소
          </button>
        )}
      </div>

      {/* ── 기준 장소 선택 ── */}
      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(244,114,182,0.15)',
        borderRadius: '12px', padding: '14px', marginBottom: '12px',
      }}>
        <div style={{ fontSize: '12px', color: '#8b7fa8', marginBottom: '8px', fontWeight: 600, letterSpacing: '0.5px' }}>
          📍 기준 장소 선택
        </div>
        <select
          value={selectedPlaceId}
          onChange={e => setSelectedPlaceId(e.target.value)}
          style={{
            width: '100%', padding: '8px 10px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(244,114,182,0.2)',
            color: '#f5f0ff', fontSize: '13px', cursor: 'pointer', outline: 'none',
            marginBottom: coursePlaces.length > 0 ? '10px' : '0',
          }}
        >
          <option value="all" style={{ background: '#1a1520' }}>🌏 전체 코스 장소 기준</option>
          {Array.from(new Map(coursePlaces.map(p => [p.title, p])).values()).map(p => (
            <option key={p.id} value={p.id} style={{ background: '#1a1520' }}>
              📍 {stripHtml(p.title)}
            </option>
          ))}
        </select>

        {selectedPlaceId !== 'all' && (
          <div>
            <div style={{ fontSize: '12px', color: '#8b7fa8', marginBottom: '6px' }}>
              반경: <strong style={{ color: '#f472b6' }}>{radiusKm}km</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11px', color: '#6b5f85' }}>1km</span>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={radiusKm}
                onChange={e => setRadiusKm(Number(e.target.value))}
                style={{
                  flex: 1, accentColor: '#f472b6', cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: '11px', color: '#6b5f85' }}>20km</span>
            </div>
            {selectedCenterPlace && (
              <div style={{ fontSize: '11px', color: '#8b7fa8', marginTop: '6px' }}>
                📌 <strong style={{ color: '#c084fc' }}>{stripHtml(selectedCenterPlace.title)}</strong> 반경 {radiusKm}km 내 추천
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 카테고리 필터 ── */}
      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(244,114,182,0.15)',
        borderRadius: '12px', padding: '14px', marginBottom: '12px',
      }}>
        <div 
          onClick={() => setShowCategory(!showCategory)}
          style={{ fontSize: '12px', color: '#8b7fa8', marginBottom: showCategory ? '10px' : '0', fontWeight: 600, letterSpacing: '0.5px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>🏷️ 추천 카테고리</span>
          <span>{showCategory ? '▲' : '▼'}</span>
        </div>
        {showCategory && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {AI_CATEGORIES.map(cat => {
                const isActive = selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    style={{
                      padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
                      border: isActive ? '1px solid rgba(244,114,182,0.5)' : '1px solid rgba(255,255,255,0.08)',
                      background: isActive ? 'rgba(244,114,182,0.12)' : 'rgba(255,255,255,0.04)',
                      color: isActive ? '#f472b6' : '#8b7fa8',
                      fontSize: '12px', fontWeight: isActive ? 600 : 400,
                      transition: 'all 0.2s', textAlign: 'left',
                      display: 'flex', flexDirection: 'column', gap: '2px',
                    }}
                  >
                    <span>{cat.label}</span>
                    <span style={{ fontSize: '10px', opacity: 0.7 }}>{cat.desc}</span>
                  </button>
                );
              })}
            </div>
            {selectedCategories.length === 0 && (
              <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '8px' }}>
                ⚠️ 최소 1개 이상 카테고리를 선택해주세요
              </div>
            )}
            
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '12px', color: '#8b7fa8', marginBottom: '6px' }}>
                맞춤 키워드 추가 (선택)
              </div>
              <input
                type="text"
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                placeholder="예) 오션뷰, 떡볶이, 분위기 좋은"
                style={{
                  width: '100%', padding: '10px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(244,114,182,0.2)',
                  color: '#f5f0ff', fontSize: '13px', outline: 'none'
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAIRecommend();
                  }
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* Sidebar Results Summary */}
      {hasSearched && !isLoading && !showPopup && (
        <div 
          onClick={() => setShowPopup(true)}
          className="animate-fade-in"
          style={{
            width: '100%', padding: '16px', borderRadius: '12px', cursor: 'pointer',
            background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(244,114,182,0.4)',
            color: '#8b7fa8', display: 'flex', flexDirection: 'column', gap: '10px',
            marginTop: '16px', transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(244,114,182,0.08)';
            e.currentTarget.style.borderColor = 'rgba(244,114,182,0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
            e.currentTarget.style.borderColor = 'rgba(244,114,182,0.4)';
          }}
        >
          <div style={{ fontSize: '14px', color: '#f5f0ff', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>✨ AI 추천 완료!</span>
            <span style={{ fontSize: '12px', background: 'rgba(244,114,182,0.2)', padding: '2px 8px', borderRadius: '12px', color: '#f472b6' }}>열기 ↗</span>
          </div>
          <div style={{ fontSize: '12px', color: '#c084fc', marginBottom: '4px' }}>
            핫플 {recommendations.length}개, 행사 {events.length}개 발견
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {recommendations.slice(0, 3).map((rec, idx) => (
              <div key={idx} style={{ fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#e2e8f0', display: 'flex', gap: '6px' }}>
                <span style={{ opacity: 0.6 }}>📍</span>
                <span>{rec.name}</span>
              </div>
            ))}
          </div>

          {recommendations.length > 3 && (
            <div style={{ fontSize: '11px', textAlign: 'center', marginTop: '6px', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
              + {recommendations.length - 3}개 더보기 (클릭)
            </div>
          )}
        </div>
      )}

      {/* Search Results Popup Overlay */}
      {showPopup && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.6)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowPopup(false)}>
          <div
            ref={panelRef}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative',
              width: `${panelSize.width}px`,
              background: 'rgba(26,21,32,0.95)',
              backdropFilter: 'blur(20px)',
              borderRadius: '24px',
              border: '1px solid rgba(244,114,182,0.3)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              maxHeight: `${Math.min(panelSize.height, typeof window !== 'undefined' ? window.innerHeight * 0.95 : 1000)}px`,
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
              <h3 style={{ margin: 0, color: '#f5f0ff', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ✨ AI 추천 결과
              </h3>
              <button onClick={() => setShowPopup(false)} style={{ background: 'transparent', border: 'none', color: '#8b7fa8', cursor: 'pointer', fontSize: '20px', padding: '4px' }}>✕</button>
            </div>

            {/* Content Area */}
            <div style={{ overflowY: 'auto', padding: '20px', minHeight: '300px' }} className="custom-scrollbar">
              {isLoading && (
                <div className="ai-realtime-loading-card animate-scale-in" style={{ margin: '40px auto' }}>
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

              {hasSearched && !isLoading && (
                <div className="ai-results animate-fade-in">
                  {error && (
                    <div className="ai-error">
                      <span>⚠️</span> {error}
                    </div>
                  )}

                  {!error && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div className="ai-section-tabs" style={{ marginBottom: 0 }}>
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
                        
                        {activeSection === 'recommend' && (
                          <select 
                            value={sortOrder}
                            onChange={e => setSortOrder(e.target.value as any)}
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              color: '#fff',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontSize: '13px',
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="default" style={{ color: '#000' }}>✨ 추천순</option>
                            <option value="mention-desc" style={{ color: '#000' }}>🔥 SNS 언급 많은순</option>
                            <option value="mention-asc" style={{ color: '#000' }}>🌱 SNS 언급 적은순</option>
                          </select>
                        )}
                      </div>

                      {/* Recommended Places */}
                      {activeSection === 'recommend' && (
                        <div className="ai-list stagger-children">
                          {sortedRecommendations.length === 0 ? (
                            <div className="ai-empty-section">
                              <div className="ai-empty-section-icon">✨</div>
                              <p>추천 장소를 불러오지 못했습니다</p>
                            </div>
                          ) : (
                            sortedRecommendations.map((rec, idx) => (
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
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    {(rec.mentionCount ?? 0) > 0 && (
                                      <span style={{ fontSize: '12px', color: '#fb923c', fontWeight: 600 }}>
                                        🔥 블로그/유튜브 {rec.mentionCount}회 언급
                                      </span>
                                    )}
                                    <span className="ai-rec-category">{rec.category}</span>
                                  </div>
                                </div>
                                <div style={{ marginBottom: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
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
                                  {/* Instagram & NaverMap quick links */}
                                  <a
                                    href={`https://www.instagram.com/explore/tags/${encodeURIComponent(rec.name.replace(/\s/g, ''))}`}
                                    target="_blank" rel="noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    style={{
                                      fontSize: '11px', padding: '2px 6px', borderRadius: '4px',
                                      background: 'rgba(255,255,255,0.06)', color: '#c084fc',
                                      textDecoration: 'none', border: '1px solid rgba(192,132,252,0.2)',
                                    }}
                                  >📷 인스타</a>
                                  <a
                                    href={`https://map.naver.com/v5/search/${encodeURIComponent(rec.name)}`}
                                    target="_blank" rel="noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    style={{
                                      fontSize: '11px', padding: '2px 6px', borderRadius: '4px',
                                      background: 'rgba(255,255,255,0.06)', color: '#4ade80',
                                      textDecoration: 'none', border: '1px solid rgba(74,222,128,0.2)',
                                    }}
                                  >🗺️ 네이버맵</a>
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

            {/* Bottom-right resize handle */}
            <div
              onMouseDown={handleResizeMouseDown}
              style={{
                position: 'absolute', right: 0, bottom: 0,
                width: '24px', height: '24px', cursor: 'nwse-resize',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
                padding: '4px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M11 1L1 11M11 6L6 11M11 11L11 11" stroke="rgba(244,114,182,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

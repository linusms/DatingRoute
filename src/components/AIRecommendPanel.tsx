'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CoursePlace, DateSchedule, RecommendedPlace, RegionEvent, Place } from '@/lib/types';
import { useResizable } from '@/hooks/useResizable';
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

  const [sortOrder, setSortOrder] = useState<'default' | 'mention-desc' | 'mention-asc'>('default');

  // Condition panel accordion state
  const [showConditionPanel, setShowConditionPanel] = useState(true);

  // Resize state
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelSize, setPanelSize] = useState({ width: 600, height: 700 });
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPanelSize({ width: 600, height: Math.round(window.innerHeight * 0.85) });
    }
  }, []);

  // DB 기반 AI 히스토리 동기화 (다기기 지원)
  useEffect(() => {
    if (!roomId) return;
    // Load from DB
    fetch(`/api/sessions/${roomId}/ai-history`)
      .then(r => r.json())
      .then(data => {
        let parsed = data.aiHistory;
        
        // 마이그레이션: DB에 없고 로컬 스토리지에만 있다면 가져와서 덮어쓰기
        if (!parsed) {
          const storageKey = `ai-recommend-history-${roomId}`;
          try {
            const cached = localStorage.getItem(storageKey);
            if (cached) {
              parsed = JSON.parse(cached);
              // Save to DB immediately so it migrates
              fetch(`/api/sessions/${roomId}/ai-history`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aiHistory: parsed }),
              }).catch(()=>null);
            }
          } catch(e) {}
        }

        if (parsed) {
          if (parsed.history && Array.isArray(parsed.history)) {
            setSearchHistory(parsed.history);
            if (parsed.activeId) {
              setActiveHistoryId(parsed.activeId);
              const activeItem = parsed.history.find((h: SearchHistoryItem) => h.id === parsed.activeId);
              if (activeItem) loadHistoryItem(activeItem);
            }
          }
        }
      })
      .catch(e => console.error('Failed to load AI history from DB', e));
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    if (searchHistory.length === 0) return;
    const data = { history: searchHistory, activeId: activeHistoryId };
    // Save to DB (debounce)
    const timer = setTimeout(() => {
      fetch(`/api/sessions/${roomId}/ai-history`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiHistory: data }),
      }).catch(e => console.error('Failed to save AI history to DB', e));
    }, 1000);
    return () => clearTimeout(timer);
  }, [roomId, searchHistory, activeHistoryId]);

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
    setShowConditionPanel(true); // expand conditions on new search
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

  const {
    size: hookPanelSize,
    handleResizeStart: handleResizeMouseDown
  } = useResizable({
    mode: 'pixel',
    direction: 'both',
    initialWidth: panelSize.width,
    initialHeight: panelSize.height,
    minWidth: 360,
    minHeight: 400,
  });

  // Sync local hook size with the component's state (if needed) or just use the hook's size directly
  useEffect(() => {
    setPanelSize(hookPanelSize);
  }, [hookPanelSize, setPanelSize]);

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
      setShowConditionPanel(false); // auto-collapse conditions when search starts
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
    if (sourceType === 'popup') return '🛍️ 팝업스토어';
    return '🌐 공식 웹/SNS';
  };

  const selectedCenterPlace = coursePlaces.find(p => p.id === selectedPlaceId);

  return (
    <div className="ai-recommend-panel">
      {/* ── 검색 기록 리스트 ── */}
      {searchHistory.length > 0 && (
        <div style={{
          background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
          borderRadius: '12px', padding: '14px', marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>
              🕒 최근 검색 기록
            </div>
            {activeHistoryId && (
              <button
                onClick={handleNewSearch}
                style={{
                  background: 'var(--color-border)', border: '1px solid var(--color-border-active)',
                  color: 'var(--color-accent-primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer'
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
                flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: '8px',
                background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)', fontSize: '13px', cursor: 'pointer', outline: 'none',
                textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'
              }}
            >
              <option value="" style={{ background: 'var(--color-bg-card)' }}>새로운 조건으로 검색하기...</option>
              {searchHistory.map(h => {
                const date = new Date(h.timestamp);
                const timeStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
                const cats = h.conditions.categories.map(c => AI_CATEGORIES.find(ac => ac.id === c)?.label.split(' ')[1] || c).join(', ');
                const kw = h.conditions.searchKeyword ? ` "${h.conditions.searchKeyword}"` : '';
                return (
                  <option key={h.id} value={h.id} style={{ background: 'var(--color-bg-card)' }}>
                    [{timeStr}] 반경 {h.conditions.radiusKm}km / {cats || '전체'}{kw}
                  </option>
                );
              })}
            </select>
            {activeHistoryId && (
              <button
                onClick={(e) => handleDeleteHistory(activeHistoryId, e)}
                style={{
                  background: 'var(--color-border)', border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)', padding: '8px', borderRadius: '8px', cursor: 'pointer',
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
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '10px' }}>
        <button 
          onClick={() => handleAIRecommend()}
          disabled={isLoading}
          className="btn btn-primary"
          style={{ padding: '10px 20px', fontSize: '14px', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {isLoading ? (statusMessage || '분석 중...') : '🔍 AI 추천 검색'}
        </button>
        {isLoading && (
          <button 
            onClick={handleCancelSearch}
            className="btn btn-secondary"
            style={{ padding: '10px 14px', fontSize: '13px', background: 'var(--color-border)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
          >
            취소
          </button>
        )}
      </div>

      {/* ── 검색 조건 accordion ── */}
      <div style={{ marginBottom: '10px' }}>
        <button
          onClick={() => setShowConditionPanel(v => !v)}
          style={{
            width: '100%', padding: '7px 12px', borderRadius: '8px',
            background: showConditionPanel ? 'var(--color-border)' : 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>
            🎛️ 검색 조건 — {selectedCategories.length}/ {AI_CATEGORIES.length} 카테고리
            {selectedPlaceId !== 'all' ? ` · 반경 ${radiusKm}km` : ''}
            {searchKeyword ? ` · "​${searchKeyword}"​` : ''}
          </span>
          <span style={{ fontSize: '10px' }}>{showConditionPanel ? '▲' : '▼'}</span>
        </button>
        {showConditionPanel && (
          <div style={{
            background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
            borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '12px',
          }}>
            {/* 기준 장소 */}
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 600 }}>📍 기준 장소</div>
            <select
              value={selectedPlaceId}
              onChange={e => setSelectedPlaceId(e.target.value)}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: '7px',
                background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)', fontSize: '13px', cursor: 'pointer', outline: 'none',
                marginBottom: '8px',
              }}
            >
              <option value="all" style={{ background: 'var(--color-bg-card)' }}>🌏 전체 코스 장소 기준</option>
              {Array.from(new Map(coursePlaces.map(p => [p.title, p])).values()).map(p => (
                <option key={p.id} value={p.id} style={{ background: 'var(--color-bg-card)' }}>
                  📍 {stripHtml(p.title)}
                </option>
              ))}
            </select>
            <div style={{ marginBottom: '10px', opacity: selectedPlaceId === 'all' ? 0.4 : 1, pointerEvents: selectedPlaceId === 'all' ? 'none' : 'auto' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                반경: <strong style={{ color: 'var(--color-accent-primary)' }}>{radiusKm}km</strong>
                {selectedPlaceId === 'all' && <span style={{ marginLeft: '6px', fontSize: '10px' }}>(장소 선택 시 활성화)</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>1km</span>
                <input type="range" min={1} max={20} step={1} value={radiusKm}
                  onChange={e => setRadiusKm(Number(e.target.value))}
                  style={{ flex: 1, accentColor: 'var(--color-accent-primary)', cursor: 'pointer' }} />
                <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>20km</span>
              </div>
            </div>



            {/* 카테고리 */}
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: 600 }}>🏷️ 카테고리</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
              {AI_CATEGORIES.map(cat => {
                const isActive = selectedCategories.includes(cat.id);
                return (
                  <button key={cat.id} onClick={() => toggleCategory(cat.id)}
                    style={{
                      padding: '7px 8px', borderRadius: '8px', cursor: 'pointer',
                      border: isActive ? '1px solid var(--color-border)' : '1px solid var(--color-border)',
                      background: isActive ? 'var(--color-border)' : 'var(--color-bg-secondary)',
                      color: isActive ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                      fontSize: '12px', fontWeight: isActive ? 600 : 400,
                      transition: 'all 0.2s', textAlign: 'left',
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
            {selectedCategories.length === 0 && (
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>⚠️ 최소 1개 선택 필요</div>
            )}
            {/* 키워드 */}
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>맞춤 키워드 (선택)</div>
            <input
              type="text" value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              placeholder="예) 오션뷰, 떡볶이"
              style={{
                width: '100%', padding: '8px 10px', borderRadius: '7px',
                background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)', fontSize: '13px', outline: 'none',
              }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAIRecommend(); } }}
            />
            
            {/* AI Preset Chips */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px', overflowX: 'auto', paddingBottom: '4px' }} className="custom-scrollbar">
              {[
                { icon: '🌧️', label: '비 오는 날 실내', keyword: '비 오는 날 실내 데이트' },
                { icon: '☕', label: '조용한 대화', keyword: '분위기 좋은 조용한 대화 카페' },
                { icon: '🍽️', label: '기념일 분위기', keyword: '기념일 파인다이닝 레스토랑' },
                { icon: '🚶‍♀️', label: '걷기 좋은 길', keyword: '걷기 좋은 예쁜 산책로' }
              ].map(preset => (
                <button
                  key={preset.label}
                  onClick={() => {
                    setSearchKeyword(preset.keyword);
                    // Timeout to let state update before fetching
                    setTimeout(() => handleAIRecommend(), 0);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
                    padding: '6px 10px', borderRadius: '16px', background: 'var(--color-bg-tertiary)',
                    border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)',
                    fontSize: '11px', cursor: 'pointer', transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; e.currentTarget.style.borderColor = 'var(--color-accent-primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                >
                  <span>{preset.icon}</span>
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Results Summary */}
      {hasSearched && !isLoading && !showPopup && (
        <div 
          onClick={() => setShowPopup(true)}
          className="animate-fade-in"
          style={{
            width: '100%', padding: '16px', borderRadius: '12px', cursor: 'pointer',
            background: 'var(--color-bg-secondary)', border: '1px dashed var(--color-border)',
            color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: '10px',
            marginTop: '16px', transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--color-border)';
            e.currentTarget.style.borderColor = 'var(--color-border)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--color-bg-secondary)';
            e.currentTarget.style.borderColor = 'var(--color-border)';
          }}
        >
          <div style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>✨ AI 추천 완료!</span>
            <span style={{ fontSize: '12px', background: 'var(--color-border)', padding: '2px 8px', borderRadius: '12px', color: 'var(--color-accent-primary)' }}>열기 ↗</span>
          </div>
          <div style={{ fontSize: '12px', color: '#c084fc', marginBottom: '4px' }}>
            핫플 {recommendations.length}개, 행사 {events.length}개 발견
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {recommendations.slice(0, 3).map((rec, idx) => (
              <div key={idx} style={{ fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--color-text-primary)', display: 'flex', gap: '6px' }}>
                <span style={{ opacity: 0.6 }}>📍</span>
                <span>{rec.name}</span>
              </div>
            ))}
          </div>

          {recommendations.length > 3 && (
            <div style={{ fontSize: '11px', textAlign: 'center', marginTop: '6px', color: '#94a3b8', borderTop: '1px solid var(--color-bg-secondary)', paddingTop: '10px' }}>
              + {recommendations.length - 3}개 더보기 (클릭)
            </div>
          )}
        </div>
      )}

      {/* Search Results Popup Overlay */}
      {showPopup && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'var(--color-bg-tertiary)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setShowPopup(false)}>
          <div
            ref={panelRef}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative',
              width: `${panelSize.width}px`,
              background: 'var(--color-bg-primary)',
              backdropFilter: 'blur(20px)',
              borderRadius: '24px',
              border: '1px solid var(--color-border-active)',
              boxShadow: '0 20px 40px var(--color-bg-tertiary)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              maxHeight: `${Math.min(panelSize.height, typeof window !== 'undefined' ? window.innerHeight * 0.95 : 1000)}px`,
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-tertiary)' }}>
              <h3 style={{ margin: 0, color: 'var(--color-text-primary)', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ✨ AI 추천 결과
              </h3>
              <button onClick={() => setShowPopup(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '20px', padding: '4px' }}>✕</button>
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
                        <div style={{ marginBottom: 0 }}>
                          <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>✨ AI 추천 핫플/팝업</span>
                          {recommendations.length > 0 && (
                            <span className="ai-count-badge" style={{ marginLeft: '8px' }}>{recommendations.length}</span>
                          )}
                        </div>
                        
                        {activeSection === 'recommend' && (
                          <select 
                            value={sortOrder}
                            onChange={e => setSortOrder(e.target.value as any)}
                            style={{
                              background: 'var(--color-bg-secondary)',
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-text-primary)',
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
                                    background: 'var(--color-bg-secondary)', color: 'var(--color-accent-primary)', fontWeight: 600,
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

                                  <a
                                    href={`https://map.naver.com/v5/search/${encodeURIComponent(rec.name)}`}
                                    target="_blank" rel="noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    style={{
                                      fontSize: '11px', padding: '2px 6px', borderRadius: '4px',
                                      background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)',
                                      textDecoration: 'none', border: '1px solid var(--color-border)',
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
                              style={{ width: '100%', marginTop: '16px', padding: '12px', borderRadius: '8px', background: 'var(--color-border)', color: 'white', border: 'none', cursor: 'pointer' }}
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
                                    <div className="ai-event-address" style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                                      📍 {event.address || '주소 정보 없음'}
                                    </div>
                                  </div>
                                  <span style={{ transform: expandedEventId === event.contentId ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
                                </div>

                                {expandedEventId === event.contentId && (
                                  <div className="ai-event-details" style={{ padding: '0 16px 16px 16px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }} onClick={(e) => e.stopPropagation()}>
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
                                              background: 'var(--color-border)',
                                              color: 'var(--color-accent-primary)',
                                              border: '1px solid var(--color-border-active)',
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
                <path d="M11 1L1 11M11 6L6 11M11 11L11 11" stroke="var(--color-border)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

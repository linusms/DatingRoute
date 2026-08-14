'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Place } from '@/lib/types';
import { stripHtml, katechToWgs84 } from '@/lib/utils';

interface SearchPanelProps {
  coursePlaces?: Place[];
  onAddPlace: (place: Place) => void;
  onShowReview: (placeName: string) => void;
  onHighlightPlace?: (place: Place | null) => void;
}

export default function SearchPanel({
  coursePlaces = [],
  onAddPlace,
  onShowReview,
  onHighlightPlace,
}: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilterSection, setShowFilterSection] = useState(false);

  const [selectedPlaceId, setSelectedPlaceId] = useState<string>('all');
  const [radiusKm, setRadiusKm] = useState<number>(5);

  const uniqueCoursePlaces = useMemo(() => {
    const map = new Map<string, Place>();
    for (const p of coursePlaces) {
      if (!map.has(p.title)) {
        map.set(p.title, p);
      }
    }
    return Array.from(map.values());
  }, [coursePlaces]);

  const handleSearch = useCallback(
    async (searchQuery: string) => {
      const q = searchQuery.trim();
      if (!q) return;

      setIsLoading(true);
      setError(null);

      try {
        const url = new URL('/api/places', window.location.origin);
        url.searchParams.set('query', q);
        url.searchParams.set('display', '50');

        if (selectedPlaceId !== 'all') {
          const center = uniqueCoursePlaces.find(p => p.id === selectedPlaceId);
          if (center) {
            const { lat, lng } = katechToWgs84(center.mapx, center.mapy);
            url.searchParams.set('lat', lat.toString());
            url.searchParams.set('lng', lng.toString());
            url.searchParams.set('radius', radiusKm.toString());
          }
        }

        const res = await fetch(url.toString());
        if (!res.ok) {
          throw new Error('검색에 실패했습니다.');
        }

        const data = await res.json();
        const r = data.items || [];
        setResults(r);
      } catch (err: any) {
        setError(err.message || '오류가 발생했습니다.');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedPlaceId, radiusKm, uniqueCoursePlaces]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch(query);
    }
  };

  const selectedCenter = uniqueCoursePlaces.find(p => p.id === selectedPlaceId);

  return (
    <div className="search-panel">
      {/* Search box */}
      <div className="search-box">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="장소 검색 (예: 홍대 카페, 이태원 맛집)"
          className="input"
        />
        <div className="search-icon" onClick={() => handleSearch(query)} style={{ cursor: 'pointer' }}>
          🔍
        </div>
      </div>

      {/* Filter toggle — accordion */}
      <div style={{ marginBottom: '8px' }}>
        <button
          onClick={() => setShowFilterSection(v => !v)}
          style={{
            width: '100%', padding: '7px 12px', borderRadius: '8px',
            background: showFilterSection ? 'rgba(244,114,182,0.08)' : 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(244,114,182,0.15)',
            color: selectedPlaceId !== 'all' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>
            📍 {selectedPlaceId !== 'all' && selectedCenter
              ? `${stripHtml(selectedCenter.title)} 반경 ${radiusKm}km`
              : '기준 장소 필터 (선택)'}
          </span>
          <span style={{ fontSize: '10px' }}>{showFilterSection ? '▲' : '▼'}</span>
        </button>

        {showFilterSection && (
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(244,114,182,0.12)',
            borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '10px',
          }}>
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
              <option value="all" style={{ background: '#1a1520' }}>🌏 전체 지역 검색</option>
              {uniqueCoursePlaces.map(p => (
                <option key={p.id} value={p.id} style={{ background: '#1a1520' }}>
                  📍 {stripHtml(p.title)}
                </option>
              ))}
            </select>

            {selectedPlaceId !== 'all' && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>
                  반경: <strong style={{ color: 'var(--color-accent-primary)' }}>{radiusKm}km</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10px', color: '#6b5f85' }}>1</span>
                  <input
                    type="range" min={1} max={20} step={1} value={radiusKm}
                    onChange={e => setRadiusKm(Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--color-accent-primary)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '10px', color: '#6b5f85' }}>20km</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="search-results custom-scrollbar">
        {isLoading && <div className="loading-state">네이버 장소 검색 중...</div>}
        {error && <div className="error-state">{error}</div>}

        {!isLoading && !error && results.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">💑</div>
            <p>
              가고 싶은 데이트 장소를 검색하고
              <br />
              나만의 코스에 추가해보세요!
            </p>
          </div>
        )}

        {results.map((place) => (
          <div
            key={place.mapx + place.mapy + place.title}
            className="place-card animate-slide-up"
            onMouseEnter={() => onHighlightPlace?.(place)}
            onMouseLeave={() => onHighlightPlace?.(null)}
          >
            <div className="place-card-content">
              <div className="place-card-header">
                <h3 className="place-card-title">{stripHtml(place.title)}</h3>
                <span className="place-card-category">{place.category}</span>
              </div>
              <div className="place-card-address" style={{ marginBottom: '8px', WebkitLineClamp: 1 } as any}>
                {place.roadAddress || place.address}
              </div>
              <div className="place-card-actions">
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: '12px', padding: '4px 8px' }}
                  onClick={() => onShowReview(stripHtml(place.title))}
                >
                  후기
                </button>
                <button
                  className="btn btn-primary"
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                  onClick={() => onAddPlace(place)}
                >
                  + 추가
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

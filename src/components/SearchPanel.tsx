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

  return (
    <div className="search-panel">
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
            marginBottom: uniqueCoursePlaces.length > 0 ? '10px' : '0',
          }}
        >
          <option value="all" style={{ background: '#1a1520' }}>🌏 지역 전체 검색</option>
          {uniqueCoursePlaces.map(p => (
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
          </div>
        )}
      </div>

      <div className="search-box">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="장소를 검색하세요 (예: 홍대 카페, 가로수길 맛집)"
          className="input"
        />
        <div className="search-icon" onClick={() => handleSearch(query)} style={{ cursor: 'pointer' }}>
          🔍
        </div>
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
              <div className="place-card-address">
                {place.roadAddress || place.address}
              </div>
              <div className="place-card-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => onShowReview(stripHtml(place.title))}
                >
                  📝 리뷰/후기
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => onAddPlace(place)}
                >
                  + 경로 추가
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

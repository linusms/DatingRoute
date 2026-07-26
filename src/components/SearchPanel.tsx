'use client';

import React, { useState, useCallback } from 'react';
import { Place } from '@/lib/types';
import { stripHtml, katechToWgs84 } from '@/lib/utils';

interface SearchPanelProps {
  onAddPlace: (place: Place) => void;
  onShowReview: (placeName: string) => void;
  onHighlightPlace?: (place: Place | null) => void;
}

const CATEGORIES = [
  { id: '전체', icon: '🔍' },
  { id: '카페', icon: '☕' },
  { id: '식당', icon: '🍽' },
  { id: '문화시설', icon: '🏛' },
];

export default function SearchPanel({
  onAddPlace,
  onShowReview,
  onHighlightPlace,
}: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('전체');
  const [results, setResults] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [radius, setRadius] = useState('1');
  const [centerCoords, setCenterCoords] = useState<{lat: number, lng: number} | null>(null);

  const handleSearch = useCallback(
    async (searchQuery: string, searchCategory: string) => {
      const q = searchQuery.trim();
      if (!q) return;

      setIsLoading(true);
      setError(null);

      try {
        const url = new URL('/api/places', window.location.origin);
        url.searchParams.set('query', q);
        if (searchCategory !== '전체') {
          url.searchParams.set('category', searchCategory);
          if (centerCoords) {
            url.searchParams.set('lat', centerCoords.lat.toString());
            url.searchParams.set('lng', centerCoords.lng.toString());
            url.searchParams.set('radius', radius);
          }
        }

        const res = await fetch(url.toString());
        if (!res.ok) {
          throw new Error('검색에 실패했습니다.');
        }

        const data = await res.json();
        const r = data.items || [];
        setResults(r);

        if (searchCategory === '전체' && r.length > 0) {
          setCenterCoords(katechToWgs84(r[0].mapx, r[0].mapy));
        }
      } catch (err: any) {
        setError(err.message || '오류가 발생했습니다.');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [centerCoords, radius]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch(query, category);
    }
  };

  const onCategoryClick = (cat: string) => {
    setCategory(cat);
    if (query) {
      handleSearch(query, cat);
    }
  };

  return (
    <div className="search-panel">
      <div className="search-box">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="장소를 검색하세요 (예: 홍대 카페)"
          className="input"
        />
        <div className="search-icon">🔍</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: '#8b7fa8', fontWeight: 500 }}>
          {centerCoords && category !== '전체' ? '현재 위치 기준 반경 검색 중' : '카테고리 선택'}
        </span>
        <select 
          value={radius} 
          onChange={(e) => setRadius(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#f5f0ff',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '12px',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="0.5">반경 500m</option>
          <option value="1">반경 1km</option>
          <option value="2">반경 2km</option>
          <option value="5">반경 5km</option>
        </select>
      </div>

      <div className="category-list">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`category-badge ${category === cat.id ? 'active' : ''}`}
            onClick={() => onCategoryClick(cat.id)}
          >
            {cat.icon} {cat.id}
          </button>
        ))}
      </div>

      <div className="search-results custom-scrollbar">
        {isLoading && <div className="loading-state">검색 중...</div>}
        {error && <div className="error-state">{error}</div>}

        {!isLoading && !error && results.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">💑</div>
            <p>
              데이트 장소를 검색하고
              <br />
              나만의 코스를 만들어보세요!
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

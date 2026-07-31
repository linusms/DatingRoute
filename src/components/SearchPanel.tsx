'use client';

import React, { useState, useCallback } from 'react';
import { Place } from '@/lib/types';
import { stripHtml } from '@/lib/utils';

interface SearchPanelProps {
  onAddPlace: (place: Place) => void;
  onShowReview: (placeName: string) => void;
  onHighlightPlace?: (place: Place | null) => void;
}

export default function SearchPanel({
  onAddPlace,
  onShowReview,
  onHighlightPlace,
}: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(
    async (searchQuery: string) => {
      const q = searchQuery.trim();
      if (!q) return;

      setIsLoading(true);
      setError(null);

      try {
        const url = new URL('/api/places', window.location.origin);
        url.searchParams.set('query', q);

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
    []
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch(query);
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

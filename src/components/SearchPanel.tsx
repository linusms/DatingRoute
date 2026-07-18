'use client';

import React, { useState, useCallback } from 'react';
import { Place } from '@/lib/types';
import { stripHtml } from '@/lib/utils';

interface SearchPanelProps {
  onAddPlace: (place: Place) => void;
  onShowReview: (placeName: string) => void;
  onHighlightPlace?: (place: Place | null) => void;
}

const CATEGORIES = [
  { id: '전체', icon: '🔍' },
  { id: '카페', icon: '☕' },
  { id: '레스토랑', icon: '🍽' },
  { id: '영화관', icon: '🎬' },
  { id: '산책', icon: '🌳' },
  { id: '쇼핑', icon: '🛍' },
  { id: '바/펍', icon: '🍷' },
  { id: '액티비티', icon: '🎯' },
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
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [recommendationPlaces, setRecommendationPlaces] = useState<Place[]>([]);

  const handleSearch = useCallback(
    async (searchQuery: string, searchCategory: string) => {
      const q = searchQuery.trim();
      if (!q) return;

      setIsLoading(true);
      setError(null);
      setRecommendation(null);
      setRecommendationPlaces([]);

      try {
        const url = new URL('/api/places', window.location.origin);
        url.searchParams.set('query', q);
        if (searchCategory !== '전체') {
          url.searchParams.set('category', searchCategory);
        }

        const res = await fetch(url.toString());
        if (!res.ok) {
          throw new Error('검색에 실패했습니다.');
        }

        const data = await res.json();
        const r = data.items || [];
        setResults(r);

        // Fetch AI recommendation if we got results
        if (r.length > 0) {
          try {
            const recRes = await fetch(`/api/recommend?place=${encodeURIComponent(r[0].title)}&category=${encodeURIComponent(r[0].category)}`);
            if (recRes.ok) {
              const recData = await recRes.json();
              if (recData.recommendation) {
                setRecommendation(recData.recommendation);
              }
              if (recData.places) {
                setRecommendationPlaces(recData.places);
              }
            }
          } catch (e) {
            console.error('Recommend error', e);
          }
        }
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

        {!isLoading && !error && results.length > 0 && recommendation && (
          <div className="ai-recommendation animate-fade-in" style={{
            background: 'rgba(244,114,182,0.1)',
            border: '1px solid rgba(244,114,182,0.3)',
            borderRadius: '12px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#f5f0ff',
            lineHeight: 1.5,
          }}>
            <strong style={{ color: '#f472b6', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span>✨</span> Gemini AI 추천
            </strong>
            <p style={{ marginBottom: recommendationPlaces.length > 0 ? '12px' : '0' }}>{recommendation}</p>

            {/* AI 추천 장소 카드 렌더링 */}
            {recommendationPlaces.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {recommendationPlaces.map((place, idx) => (
                  <div
                    key={`rec-${idx}-${place.mapx}`}
                    className="place-card animate-slide-up"
                    onMouseEnter={() => onHighlightPlace?.(place)}
                    onMouseLeave={() => onHighlightPlace?.(null)}
                    style={{
                      border: '1px solid #f472b6',
                      background: 'rgba(244,114,182,0.05)',
                      padding: '12px',
                    }}
                  >
                    <div className="place-card-content">
                      <div className="place-card-header">
                        <h3 className="place-card-title">
                          <span style={{ color: '#f472b6', marginRight: '4px' }}>★</span>
                          {stripHtml(place.title)}
                        </h3>
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
                          + 코스 추가
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
                  + 코스 추가
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

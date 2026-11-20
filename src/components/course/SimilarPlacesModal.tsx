'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CoursePlace } from '@/lib/types';
import type { NewPlaceInput } from '@/hooks/useCourseSession';
import { formatDistance, stripHtml } from '@/lib/utils';
import { naverSearchUrl } from '@/lib/links';

interface SimilarPlace {
  name: string;
  category: string;
  address: string;
  roadAddress: string;
  mapx: number;
  mapy: number;
  link: string;
  distance: number;
}

interface SimilarPlacesModalProps {
  place: CoursePlace;
  onClose: () => void;
  onPick: (input: NewPlaceInput) => void;
}

/** "비슷한 곳": nearby places of the same kind that can replace this one in place. */
export default function SimilarPlacesModal({ place, onClose, onPick }: SimilarPlacesModalProps) {
  const [items, setItems] = useState<SimilarPlace[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      title: stripHtml(place.title),
      category: place.category || '',
      address: place.roadAddress || place.address || '',
      mapx: String(place.mapx),
      mapy: String(place.mapy),
    });
    let alive = true;
    fetch(`/api/places/similar?${params}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('검색 실패'))))
      .then((data) => { if (alive) setItems(data.places || []); })
      .catch(() => { if (alive) setError('비슷한 곳을 찾지 못했어요.'); });
    return () => { alive = false; };
  }, [place]);

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal cb-similar-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="비슷한 곳">
        <div className="modal-header">
          <h3>🔄 &lsquo;{stripHtml(place.title)}&rsquo; 대신 갈 곳</h3>
          <button className="modal-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <div className="modal-body">
          {error && <p className="cb-muted">{error}</p>}
          {!error && items === null && <p className="cb-muted">근처에서 찾는 중...</p>}
          {items && items.length === 0 && <p className="cb-muted">2km 안에서 비슷한 곳을 찾지 못했어요.</p>}
          <div className="cb-similar-list">
            {items?.map((item) => (
              <div key={item.name} className="cb-similar-item">
                <div className="cb-similar-info">
                  <div className="cb-similar-name">{item.name}</div>
                  <div className="cb-muted cb-small">
                    {item.category} · {formatDistance(item.distance)}
                  </div>
                  <div className="cb-muted cb-small">{item.roadAddress || item.address}</div>
                </div>
                <div className="cb-similar-actions">
                  <a href={naverSearchUrl(item.name)} target="_blank" rel="noreferrer" className="cb-chip-btn">보기</a>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      onPick({
                        id: '',
                        title: item.name,
                        category: item.category,
                        address: item.address,
                        roadAddress: item.roadAddress,
                        mapx: item.mapx,
                        mapy: item.mapy,
                        link: item.link,
                        description: '',
                      });
                      onClose();
                    }}
                  >
                    바꾸기
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

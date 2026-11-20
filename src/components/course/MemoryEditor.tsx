'use client';

import { useRef, useState } from 'react';
import type { CoursePlace, PlaceUpdatableFields } from '@/lib/types';
import { resizeImage } from '@/lib/image';

interface MemoryEditorProps {
  place: CoursePlace;
  onUpdate: (fields: PlaceUpdatableFields) => void;
  onUploadPhoto: (file: Blob | null) => Promise<void>;
}

/** Rating, a short review and one photo for a visited place. */
export default function MemoryEditor({ place, onUpdate, onUploadPhoto }: MemoryEditorProps) {
  const [review, setReview] = useState(place.review || '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Keep the draft in sync when someone else edits the review
  const [lastServerReview, setLastServerReview] = useState(place.review || '');
  if ((place.review || '') !== lastServerReview) {
    setLastServerReview(place.review || '');
    setReview(place.review || '');
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const blob = await resizeImage(file);
      await onUploadPhoto(blob);
    } catch (err) {
      setError((err as Error).message || '사진을 올리지 못했어요.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="cb-memory">
      <div className="cb-field-label">📸 추억 남기기</div>
      <div className="cb-stars" role="radiogroup" aria-label="별점">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={place.rating === n}
            className={(place.rating ?? 0) >= n ? 'on' : ''}
            onClick={() => onUpdate({ rating: place.rating === n ? null : n })}
            title={`${n}점`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        className="cb-input cb-textarea"
        value={review}
        maxLength={500}
        rows={2}
        placeholder="어땠나요? 한 줄로 남겨보세요"
        onChange={(e) => setReview(e.target.value)}
        onBlur={() => { if (review !== (place.review || '')) onUpdate({ review }); }}
      />
      <div className="cb-memory-photo">
        {place.photoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={place.photoUrl} alt={`${place.title} 사진`} />
            <button className="cb-chip-btn" onClick={() => onUploadPhoto(null)} disabled={uploading}>사진 삭제</button>
          </>
        ) : (
          <button className="cb-chip-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? '올리는 중...' : '사진 1장 올리기'}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
      </div>
      {error && <div className="cb-error-text">{error}</div>}
    </div>
  );
}

'use client';

import React, { useState } from 'react';

interface CourseManagerProps {
  onClose: () => void;
  onSaveCourse: (name: string, description: string) => void;
  hasPlaces: boolean;
}

export default function CourseManager({
  onClose,
  onSaveCourse,
  hasPlaces,
}: CourseManagerProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = () => {
    if (!name.trim()) return;
    onSaveCourse(name.trim(), description.trim());
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>💾 경로 저장</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {!hasPlaces ? (
            <div className="review-empty">
              <p>코스에 장소를 먼저 추가해주세요!</p>
            </div>
          ) : (
            <>
              <div className="save-input-group">
                <label>경로 이름</label>
                <input
                  className="input"
                  placeholder="예: 홍대 데이트 코스"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
              </div>
              <div className="save-input-group">
                <label>설명 (선택)</label>
                <input
                  className="input"
                  placeholder="예: 카페 → 맛집 → 산책"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
              </div>
            </>
          )}
        </div>

        {hasPlaces && (
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>
              취소
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!name.trim()}
            >
              💾 저장
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

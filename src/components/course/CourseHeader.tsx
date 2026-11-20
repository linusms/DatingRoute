'use client';

import { useState } from 'react';

interface CourseHeaderProps {
  courseName: string;
  courseDescription: string;
  onSave: (displayName: string, description: string) => Promise<void>;
}

export default function CourseHeader({ courseName, courseDescription, onSave }: CourseHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setName(courseName);
    setIsEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(name.trim(), courseDescription);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="cb-header">
        <input
          className="cb-input cb-header-input"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
          placeholder="경로 이름을 입력하세요"
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setIsEditing(false);
          }}
          autoFocus
        />
        <button onClick={save} disabled={saving} className="btn btn-primary btn-sm">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    );
  }

  return (
    <div className="cb-header">
      <div className="cb-header-text">
        <span className="cb-header-kicker">나만의 데이트 코스 💖</span>
        <span className="cb-header-name">{courseName || '새로운 코스'}</span>
      </div>
      <button onClick={startEdit} className="cb-chip-btn">이름 변경 ✏️</button>
    </div>
  );
}

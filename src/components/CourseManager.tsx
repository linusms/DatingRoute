'use client';

import React, { useState, useEffect } from 'react';
import { Course, SessionMode } from '@/lib/types';
import { getCourses, deleteCourse as deleteLocalCourse } from '@/lib/courseStorage';

interface CourseManagerProps {
  onClose: () => void;
  onLoadCourse: (course: Course) => void;
  onSaveCourse: (name: string, description: string) => void;
  hasPlaces: boolean;
  sessionMode: SessionMode;
  sessionId: string | null;
}

export default function CourseManager({
  onClose,
  onLoadCourse,
  onSaveCourse,
  hasPlaces,
  sessionMode,
  sessionId,
}: CourseManagerProps) {
  const [tab, setTab] = useState<'save' | 'load'>('load');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);

  // Load courses based on mode
  useEffect(() => {
    if (sessionMode === 'dev') {
      setCourses(getCourses());
    } else if (sessionId) {
      setLoading(true);
      fetch(`/api/sessions/${sessionId}/courses`)
        .then((res) => res.json())
        .then((data) => {
          setCourses(data.courses || []);
        })
        .catch(() => setCourses([]))
        .finally(() => setLoading(false));
    }
  }, [sessionMode, sessionId]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSaveCourse(name.trim(), description.trim());
    onClose();
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (sessionMode === 'dev') {
      deleteLocalCourse(id);
      setCourses(getCourses());
    } else if (sessionId) {
      try {
        await fetch(`/api/sessions/${sessionId}/courses/${id}`, { method: 'DELETE' });
        setCourses((prev) => prev.filter((c) => c.id !== id));
      } catch { /* ignore */ }
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{tab === 'save' ? '💾 코스 저장' : '📂 저장된 코스'}</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
          <button
            className={`sidebar-tab ${tab === 'load' ? 'active' : ''}`}
            onClick={() => setTab('load')}
          >
            불러오기
          </button>
          <button
            className={`sidebar-tab ${tab === 'save' ? 'active' : ''}`}
            onClick={() => setTab('save')}
          >
            새로 저장
          </button>
        </div>

        <div className="modal-body">
          {tab === 'save' ? (
            <>
              {!hasPlaces ? (
                <div className="review-empty">
                  <p>코스에 장소를 먼저 추가해주세요!</p>
                </div>
              ) : (
                <>
                  <div className="save-input-group">
                    <label>코스 이름</label>
                    <input
                      className="input"
                      placeholder="예: 홍대 데이트 코스"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="save-input-group">
                    <label>설명 (선택)</label>
                    <input
                      className="input"
                      placeholder="예: 카페 → 맛집 → 산책"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {loading ? (
                <div className="review-empty">
                  <p>⏳ 불러오는 중...</p>
                </div>
              ) : courses.length === 0 ? (
                <div className="review-empty">
                  <p>저장된 코스가 없습니다</p>
                </div>
              ) : (
                <div className="stagger-children">
                  {courses.map((course) => (
                    <div
                      key={course.id}
                      className="saved-course-item"
                      onClick={() => {
                        onLoadCourse(course);
                        onClose();
                      }}
                    >
                      <div className="saved-course-info">
                        <div className="saved-course-name">{course.name}</div>
                        <div className="saved-course-meta">
                          📍 {course.places.length}곳 · {formatDate(course.updatedAt)}
                        </div>
                      </div>
                      <button
                        className="saved-course-delete"
                        onClick={(e) => handleDelete(e, course.id)}
                        title="삭제"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {tab === 'save' && hasPlaces && (
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

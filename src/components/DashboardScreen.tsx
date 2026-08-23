'use client';

import React, { useState, useEffect } from 'react';
import type { Course, User } from '@/lib/types';

interface DashboardScreenProps {
  currentUser: User;
  onCreateNew: () => void;
  onLoadCourse: (course: Course) => void;
  onLogout: () => void;
  pendingInviteCode?: string | null;
  onJoinByInviteCode?: (code: string) => void;
}

interface EditState {
  courseId: string;
  name: string;
  description: string;
}

export default function DashboardScreen({
  currentUser,
  onCreateNew,
  onLoadCourse,
  onLogout,
  pendingInviteCode,
  onJoinByInviteCode,
}: DashboardScreenProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
    setLoading(true);
    fetch(`/api/users/${currentUser.id}/courses`)
      .then((res) => res.json())
      .then((data) => setCourses(data.courses || []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, [currentUser?.id]);

  // If there's a pending invite code from URL, auto-join
  useEffect(() => {
    if (pendingInviteCode && onJoinByInviteCode) {
      onJoinByInviteCode(pendingInviteCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInviteCode]);

  const handleDelete = async (e: React.MouseEvent, courseId: string) => {
    e.stopPropagation();
    if (!currentUser?.id) return;
    try {
      await fetch(`/api/users/${currentUser.id}/courses/delete?id=${courseId}`, { method: 'DELETE' });
      setCourses((prev) => prev.filter((c) => c.id !== courseId));
    } catch { /* ignore */ }
  };

  const handleEditStart = (e: React.MouseEvent, course: Course) => {
    e.stopPropagation();
    setEditState({
      courseId: course.id,
      name: course.isLive ? (course.displayName || '') : course.name,
      description: course.description || '',
    });
  };

  const handleEditSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editState || !currentUser?.id) return;
    if (!editState.name.trim()) return;

    setEditSaving(true);
    try {
      const course = courses.find(c => c.id === editState.courseId);
      if (!course) return;

      if (course.isLive && course.roomId) {
        const res = await fetch(`/api/sessions/${course.roomId}/name`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: editState.name, description: editState.description }),
        });
        if (res.ok) {
          setCourses(prev =>
            prev.map(c =>
              c.id === editState.courseId
                ? { ...c, displayName: editState.name, description: editState.description }
                : c
            )
          );
          setEditState(null);
        }
      } else {
        const res = await fetch(`/api/users/${currentUser.id}/courses/${editState.courseId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editState.name, description: editState.description }),
        });
        if (res.ok) {
          setCourses(prev =>
            prev.map(c =>
              c.id === editState.courseId
                ? { ...c, name: editState.name, description: editState.description }
                : c
            )
          );
          setEditState(null);
        }
      }
    } catch { /* ignore */ }
    finally {
      setEditSaving(false);
    }
  };

  const handleEditCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditState(null);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="dashboard-screen">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-brand">
          <span className="dashboard-logo">💕</span>
          <div>
            <div className="dashboard-title">DatingRoute</div>
            <div className="dashboard-subtitle">데이트 코스 플래너</div>
          </div>
        </div>
          <div className="dashboard-user-info">
            <span className="dashboard-nickname">👋 {currentUser.nickname}님</span>
            <button
              onClick={onLogout}
              title="로그아웃"
              style={{
                fontSize: '16px', color: 'var(--color-text-secondary)',
                border: 'none', background: 'transparent',
                width: '32px', height: '32px', borderRadius: '50%',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s, color 0.2s'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-secondary)'; e.currentTarget.style.color = 'var(--color-error)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-content">
        {/* Create New Button */}
        <button className="dashboard-create-btn" onClick={onCreateNew}>
          <div className="dashboard-create-icon">✨</div>
          <div className="dashboard-create-text">
            <span className="dashboard-create-title">새 경로 만들기</span>
            <span className="dashboard-create-desc">새로운 데이트 코스를 작성하세요</span>
          </div>
          <span className="dashboard-create-arrow">→</span>
        </button>

        {/* Course List */}
        <div className="dashboard-section">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">📂 저장된 경로</h2>
            <span className="dashboard-section-count">{courses.length}개</span>
          </div>

          {loading ? (
            <div className="dashboard-empty">
              <div className="dashboard-loading-spinner" />
              <p>불러오는 중...</p>
            </div>
          ) : courses.length === 0 ? (
            <div className="dashboard-empty">
              <div className="dashboard-empty-icon">🗺️</div>
              <p>저장된 경로가 없습니다</p>
              <p className="dashboard-empty-hint">새 경로를 만들어 저장해보세요!</p>
            </div>
          ) : (
            <div className="dashboard-course-list">
              {courses.map((course) => {
                const isEditing = editState?.courseId === course.id;
                const isUnsaved = course.name === '저장되지 않은 경로';
                
                const assignedPlaces = course.places.filter(p => (p.day || 0) > 0);
                const displayPlaces = assignedPlaces.length > 0 ? assignedPlaces : course.places;

                return (
                  <div
                    key={course.id}
                    className="dashboard-course-card"
                    onClick={() => !isEditing && onLoadCourse(course)}
                    style={{ cursor: isEditing ? 'default' : 'pointer' }}
                  >
                    <div className="dashboard-course-header">
                      <div className="dashboard-course-name-row" style={{ flex: 1, minWidth: 0 }}>
                        {course.isCollaborative && (
                          <span className="dashboard-collab-badge" title="협업 경로">👥</span>
                        )}

                        {/* 편집 모드 */}
                        {isEditing ? (
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }} onClick={e => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editState!.name}
                              onChange={e => setEditState(prev => prev ? { ...prev, name: e.target.value } : null)}
                              placeholder="경로 이름"
                              style={{
                                width: '100%', padding: '6px 10px', borderRadius: '6px',
                                background: 'rgba(255,255,255,0.08)', border: '1px solid var(--color-border)',
                                color: 'var(--color-text-primary)', fontSize: '14px', outline: 'none',
                              }}
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleEditSave(e as any);
                                if (e.key === 'Escape') setEditState(null);
                              }}
                            />
                            <input
                              type="text"
                              value={editState!.description}
                              onChange={e => setEditState(prev => prev ? { ...prev, description: e.target.value } : null)}
                              placeholder="설명 (선택사항)"
                              style={{
                                width: '100%', padding: '6px 10px', borderRadius: '6px',
                                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                                color: '#b4a9c9', fontSize: '12px', outline: 'none',
                              }}
                            />
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={handleEditSave}
                                disabled={editSaving || !editState!.name.trim()}
                                style={{
                                  padding: '4px 12px', borderRadius: '6px', fontSize: '12px',
                                  background: 'linear-gradient(135deg, var(--color-accent-primary), #c084fc)',
                                  color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600,
                                  opacity: (!editState!.name.trim() || editSaving) ? 0.5 : 1,
                                }}
                              >
                                {editSaving ? '저장 중...' : '✓ 저장'}
                              </button>
                              <button
                                onClick={handleEditCancel}
                                style={{
                                  padding: '4px 10px', borderRadius: '6px', fontSize: '12px',
                                  background: 'rgba(255,255,255,0.08)', color: 'var(--color-text-secondary)',
                                  border: '1px solid var(--color-border)', cursor: 'pointer',
                                }}
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className="dashboard-course-name">
                                {isUnsaved ? (
                                  <span style={{ color: 'var(--color-text-primary)' }}>{course.displayName || '이름 없는 경로'}</span>
                                ) : course.name}
                              </span>
                              {course.memberCount && course.memberCount > 1 && (
                                <span className="dashboard-member-count">{course.memberCount}명 참여</span>
                              )}
                            </div>
                            {course.description && (
                              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {course.description}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 액션 버튼 (편집/삭제) */}
                      {!isEditing && (
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'flex-start' }}>
                          <button
                            className="dashboard-course-edit"
                            onClick={(e) => handleEditStart(e, course)}
                            title="이름/설명 편집"
                            style={{
                              background: 'var(--color-border)', color: 'var(--color-accent-primary)',
                              border: 'none', width: '30px', height: '30px', borderRadius: '6px',
                              cursor: 'pointer', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', fontSize: '14px',
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            className="dashboard-course-delete"
                            onClick={(e) => handleDelete(e, course.id)}
                            title="삭제"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Places preview */}
                    {!isEditing && (
                      <>
                        <div className="dashboard-course-places">
                          {displayPlaces.length === 0 ? (
                            <span className="dashboard-no-places">장소 없음</span>
                          ) : (
                            displayPlaces.slice(0, 5).map((p, i) => (
                              <span key={p.id || i} className="dashboard-place-chip">
                                📍 {(p.title || '').replace(/<[^>]+>/g, '')}
                              </span>
                            ))
                          )}
                          {displayPlaces.length > 5 && (
                            <span className="dashboard-place-more">+{displayPlaces.length - 5}곳</span>
                          )}
                        </div>

                        {/* Footer info */}
                        <div className="dashboard-course-footer">
                          <span className="dashboard-course-date">{formatDate(course.updatedAt)}</span>
                          <span className="dashboard-course-count">📍 {displayPlaces.length}곳</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

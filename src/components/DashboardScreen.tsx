'use client';

import React, { useEffect, useState } from 'react';
import type { Course, Memory, User } from '@/lib/types';
import { todayISO } from '@/lib/timeline';
import ChangePasswordModal from './ChangePasswordModal';

interface DashboardScreenProps {
  currentUser: User;
  onUserChange: (user: User) => void;
  onCreateNew: () => void;
  onLoadCourse: (course: Course) => void;
  onLogout: () => void;
  onJoinByInviteCode: (code: string) => Promise<void>;
}

interface EditState {
  courseId: string;
  name: string;
  description: string;
}

function dDayLabel(course: Course): { text: string; tone: 'today' | 'soon' | 'past' } | null {
  const start = course.schedule?.startDate;
  if (!start) return null;
  const end = course.schedule?.endDate || start;
  const today = todayISO();
  if (today >= start && today <= end) return { text: '오늘', tone: 'today' };
  if (today > end) return { text: '지난 데이트', tone: 'past' };
  const days = Math.round((Date.parse(`${start}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86400000);
  return { text: `D-${days}`, tone: 'soon' };
}

export default function DashboardScreen({ currentUser, onUserChange, onCreateNew, onLoadCourse, onLogout, onJoinByInviteCode }: DashboardScreenProps) {
  const [view, setView] = useState<'courses' | 'memories'>('courses');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/users/${currentUser.id}/courses`)
      .then((res) => res.json())
      .then((data) => { if (alive) setCourses(data.courses || []); })
      .catch(() => { if (alive) setCourses([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [currentUser.id]);

  useEffect(() => {
    if (view !== 'memories' || memories !== null) return;
    let alive = true;
    fetch(`/api/users/${currentUser.id}/memories`)
      .then((res) => res.json())
      .then((data) => { if (alive) setMemories(data.memories || []); })
      .catch(() => { if (alive) setMemories([]); });
    return () => { alive = false; };
  }, [view, memories, currentUser.id]);

  const handleDelete = async (e: React.MouseEvent, course: Course) => {
    e.stopPropagation();
    const message = course.isLive && (course.memberCount ?? 1) > 1
      ? '이 코스에서 나가시겠어요? 다른 참여자에게는 코스가 그대로 남아요.'
      : '이 코스를 삭제하시겠어요? 되돌릴 수 없어요.';
    if (!confirm(message)) return;
    try {
      const res = await fetch(`/api/users/${currentUser.id}/courses/delete?id=${encodeURIComponent(course.id)}`, { method: 'DELETE' });
      if (res.ok) setCourses((prev) => prev.filter((c) => c.id !== course.id));
    } catch { /* ignore */ }
  };

  const handleEditSave = async () => {
    if (!editState || !editState.name.trim()) return;
    const course = courses.find((c) => c.id === editState.courseId);
    if (!course) return;
    setEditSaving(true);
    try {
      const res = course.isLive && course.roomId
        ? await fetch(`/api/sessions/${course.roomId}/name`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName: editState.name, description: editState.description }),
          })
        : await fetch(`/api/users/${currentUser.id}/courses/${editState.courseId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: editState.name, description: editState.description }),
          });
      if (res.ok) {
        setCourses((prev) => prev.map((c) => (c.id !== editState.courseId ? c : course.isLive
          ? { ...c, displayName: editState.name, description: editState.description }
          : { ...c, name: editState.name, description: editState.description })));
        setEditState(null);
      }
    } catch { /* ignore */ } finally {
      setEditSaving(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) return;
    setJoining(true);
    try {
      await onJoinByInviteCode(code);
    } catch { /* toast shown by the hook */ } finally {
      setJoining(false);
    }
  };

  const formatDate = (dateStr: string) =>
    dateStr ? new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="dashboard-screen">
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
          <button className="icon-btn" onClick={() => setShowPasswordModal(true)} title={currentUser.isGuest ? '계정으로 저장' : '비밀번호 변경'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </button>
          <button className="icon-btn danger" onClick={onLogout} title="로그아웃">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        {currentUser.isGuest && (
          <div className="guest-banner">
            <div>
              <strong>게스트로 참여 중이에요.</strong>
              <span> 이 브라우저의 쿠키가 지워지면 코스를 잃을 수 있어요. 비밀번호를 정하면 어느 기기에서든 이어서 볼 수 있어요.</span>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowPasswordModal(true)}>계정으로 저장</button>
          </div>
        )}

        <button className="dashboard-create-btn" onClick={onCreateNew}>
          <div className="dashboard-create-icon">✨</div>
          <div className="dashboard-create-text">
            <span className="dashboard-create-title">새 경로 만들기</span>
            <span className="dashboard-create-desc">새로운 데이트 코스를 작성하세요</span>
          </div>
          <span className="dashboard-create-arrow">→</span>
        </button>

        <form className="join-form" onSubmit={handleJoin}>
          <input
            className="input"
            value={joinCode}
            maxLength={6}
            placeholder="초대코드 6자리"
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            aria-label="초대코드"
          />
          <button className="btn btn-secondary" type="submit" disabled={joinCode.length !== 6 || joining}>
            {joining ? '참여 중...' : '코드로 참여'}
          </button>
        </form>

        <div className="dashboard-view-tabs" role="tablist">
          <button role="tab" aria-selected={view === 'courses'} className={view === 'courses' ? 'active' : ''} onClick={() => setView('courses')}>
            📂 내 코스 <span className="dashboard-section-count">{courses.length}</span>
          </button>
          <button role="tab" aria-selected={view === 'memories'} className={view === 'memories' ? 'active' : ''} onClick={() => setView('memories')}>
            📸 추억
          </button>
        </div>

        {view === 'courses' && (
          <div className="dashboard-section">
            {loading ? (
              <div className="dashboard-empty">
                <div className="dashboard-loading-spinner" />
                <p>불러오는 중...</p>
              </div>
            ) : courses.length === 0 ? (
              <div className="dashboard-empty">
                <div className="dashboard-empty-icon">🗺️</div>
                <p>아직 코스가 없어요</p>
                <p className="dashboard-empty-hint">새 경로를 만들거나 초대코드로 참여해보세요!</p>
              </div>
            ) : (
              <div className="dashboard-course-list">
                {courses.map((course) => {
                  const isEditing = editState?.courseId === course.id;
                  const dayPlaces = course.places.filter((p) => (p.day || 0) > 0);
                  const displayPlaces = dayPlaces.length > 0 ? dayPlaces : course.places;
                  const dDay = dDayLabel(course);
                  const title = course.isLive ? (course.displayName || '이름 없는 경로') : course.name;

                  return (
                    <div
                      key={course.id}
                      className="dashboard-course-card"
                      onClick={() => !isEditing && onLoadCourse(course)}
                      style={{ cursor: isEditing ? 'default' : 'pointer' }}
                    >
                      <div className="dashboard-course-header">
                        <div className="dashboard-course-name-row" style={{ flex: 1, minWidth: 0 }}>
                          {course.isCollaborative && <span className="dashboard-collab-badge" title="협업 경로">👥</span>}
                          {isEditing ? (
                            <div className="dashboard-edit" onClick={(e) => e.stopPropagation()}>
                              <input
                                className="input"
                                value={editState.name}
                                maxLength={100}
                                onChange={(e) => setEditState({ ...editState, name: e.target.value })}
                                placeholder="경로 이름"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleEditSave();
                                  if (e.key === 'Escape') setEditState(null);
                                }}
                              />
                              <input
                                className="input"
                                value={editState.description}
                                maxLength={500}
                                onChange={(e) => setEditState({ ...editState, description: e.target.value })}
                                placeholder="설명 (선택사항)"
                              />
                              <div className="dashboard-edit-actions">
                                <button className="btn btn-primary btn-sm" onClick={handleEditSave} disabled={editSaving || !editState.name.trim()}>
                                  {editSaving ? '저장 중...' : '✓ 저장'}
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setEditState(null)}>취소</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="dashboard-course-title-row">
                                <span className="dashboard-course-name">{title}</span>
                                {dDay && <span className={`dday-badge ${dDay.tone}`}>{dDay.text}</span>}
                                {course.memberCount && course.memberCount > 1 && (
                                  <span className="dashboard-member-count">{course.memberCount}명 참여</span>
                                )}
                                {!course.isLive && <span className="dashboard-member-count">저장본</span>}
                              </div>
                              {course.description && <div className="dashboard-course-desc">{course.description}</div>}
                            </div>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="dashboard-course-actions">
                            <button
                              className="dashboard-course-edit"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditState({ courseId: course.id, name: title === '이름 없는 경로' ? '' : title, description: course.description || '' });
                              }}
                              title="이름/설명 편집"
                            >
                              ✏️
                            </button>
                            <button className="dashboard-course-delete" onClick={(e) => handleDelete(e, course)} title={course.isLive && (course.memberCount ?? 1) > 1 ? '나가기' : '삭제'}>
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>

                      {!isEditing && (
                        <>
                          <div className="dashboard-course-places">
                            {displayPlaces.length === 0 ? (
                              <span className="dashboard-no-places">장소 없음</span>
                            ) : (
                              displayPlaces.slice(0, 5).map((p, i) => (
                                <span key={p.id || i} className="dashboard-place-chip">📍 {(p.title || '').replace(/<[^>]+>/g, '')}</span>
                              ))
                            )}
                            {displayPlaces.length > 5 && <span className="dashboard-place-more">+{displayPlaces.length - 5}곳</span>}
                          </div>
                          <div className="dashboard-course-footer">
                            <span className="dashboard-course-date">
                              {course.schedule?.startDate ? `📅 ${course.schedule.startDate}` : formatDate(course.updatedAt)}
                            </span>
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
        )}

        {view === 'memories' && (
          <div className="dashboard-section">
            {memories === null ? (
              <div className="dashboard-empty">
                <div className="dashboard-loading-spinner" />
                <p>불러오는 중...</p>
              </div>
            ) : memories.length === 0 ? (
              <div className="dashboard-empty">
                <div className="dashboard-empty-icon">📸</div>
                <p>아직 남긴 추억이 없어요</p>
                <p className="dashboard-empty-hint">데이트 후 코스의 장소 카드에서 별점·한 줄 후기·사진을 남겨보세요.</p>
              </div>
            ) : (
              <div className="memory-grid">
                {memories.map((m) => (
                  <div key={m.placeId} className="memory-card">
                    {m.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photoUrl} alt={`${m.title} 사진`} className="memory-photo" />
                    ) : (
                      <div className="memory-photo placeholder">📍</div>
                    )}
                    <div className="memory-body">
                      <div className="memory-title">{m.title}</div>
                      {m.rating && <div className="memory-stars" aria-label={`${m.rating}점`}>{'★'.repeat(m.rating)}<span>{'★'.repeat(5 - m.rating)}</span></div>}
                      {m.review && <p className="memory-review">{m.review}</p>}
                      <div className="memory-meta">
                        {m.courseName}{m.visitedAt ? ` · ${new Date(m.visitedAt).toLocaleDateString('ko-KR')}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showPasswordModal && (
        <ChangePasswordModal
          onClose={() => setShowPasswordModal(false)}
          guestUser={currentUser.isGuest ? currentUser : null}
          onUpgraded={onUserChange}
        />
      )}
    </div>
  );
}

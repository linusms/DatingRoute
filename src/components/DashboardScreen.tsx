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
  }, [pendingInviteCode, onJoinByInviteCode]);

  const handleDelete = async (e: React.MouseEvent, courseId: string) => {
    e.stopPropagation();
    if (!currentUser?.id) return;
    try {
      await fetch(`/api/users/${currentUser.id}/courses/delete?id=${courseId}`, { method: 'DELETE' });
      setCourses((prev) => prev.filter((c) => c.id !== courseId));
    } catch { /* ignore */ }
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
          <span className="dashboard-nickname">👤 {currentUser.nickname}님</span>
          <button className="dashboard-logout-btn" onClick={onLogout}>로그아웃</button>
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
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="dashboard-course-card"
                  onClick={() => onLoadCourse(course)}
                >
                  <div className="dashboard-course-header">
                    <div className="dashboard-course-name-row">
                      {course.isCollaborative && (
                        <span className="dashboard-collab-badge" title="협업 경로">👥</span>
                      )}
                      <span className="dashboard-course-name">
                        {course.name === '저장되지 않은 경로' ? (
                          <span className="dashboard-unsaved-label">{course.name}</span>
                        ) : course.name}
                      </span>
                      {course.memberCount && course.memberCount > 1 && (
                        <span className="dashboard-member-count">{course.memberCount}명 참여</span>
                      )}
                    </div>
                    <button
                      className="dashboard-course-delete"
                      onClick={(e) => handleDelete(e, course.id)}
                      title="삭제"
                    >
                      🗑️
                    </button>
                  </div>

                  {/* Places preview */}
                  <div className="dashboard-course-places">
                    {course.places.length === 0 ? (
                      <span className="dashboard-no-places">장소 없음</span>
                    ) : (
                      course.places.slice(0, 5).map((p, i) => (
                        <span key={p.id || i} className="dashboard-place-chip">
                          📍 {(p.title || '').replace(/<[^>]+>/g, '')}
                        </span>
                      ))
                    )}
                    {course.places.length > 5 && (
                      <span className="dashboard-place-more">+{course.places.length - 5}곳</span>
                    )}
                  </div>

                  {/* Footer info */}
                  <div className="dashboard-course-footer">
                    <span className="dashboard-course-date">{formatDate(course.updatedAt)}</span>
                    <span className="dashboard-course-count">📍 {course.places.length}곳</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

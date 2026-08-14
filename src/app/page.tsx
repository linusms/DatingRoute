'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Header from '@/components/Header';
import SearchPanel from '@/components/SearchPanel';
import AIRecommendPanel from '@/components/AIRecommendPanel';
import CourseBuilder from '@/components/CourseBuilder';
import NaverMap from '@/components/NaverMap';
import ReviewPanel from '@/components/ReviewPanel';
import CourseManager from '@/components/CourseManager';
import DashboardScreen from '@/components/DashboardScreen';
import AuthScreen from '@/components/AuthScreen';
import {
  User,
  Place,
  CoursePlace,
  Course,
  DirectionResult,
  TransitMode,
  SessionMode,
  RoomMember,
  DateSchedule,
} from '@/lib/types';
import {
  encodeCourseToUrl,
  decodeCourseFromUrl,
} from '@/lib/courseStorage';
import { katechToWgs84, getStraightLineDistance, calculateFallbackDirections, stripHtml } from '@/lib/utils';
import { useCourseSession } from '@/hooks/useCourseSession';
import { useResizable } from '@/hooks/useResizable';
import { useDirections } from '@/hooks/useDirections';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'search' | 'ai' | 'route'>('search');

  // Directions state
  const { directions, setDirections, routePath, setRoutePath, fetchDirections, clearDirections } = useDirections();

  // Route features state
  const [isRouteCreated, setIsRouteCreated] = useState(false);
  const [transitMode, setTransitMode] = useState<TransitMode>('driving');
  const [activeDayTab, setActiveDayTab] = useState<'all' | number>('all');

  const [highlightPlace, setHighlightPlace] = useState<Place | null>(null);
  const [reviewPlace, setReviewPlace] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showStoragePins, setShowStoragePins] = useState(false);

  const {
    currentUser,
    setCurrentUser,
    isInitializing,
    coursePlaces,
    setCoursePlaces,
    schedule,
    setSchedule,
    courseName,
    setCourseName,
    courseDescription,
    setCourseDescription,
    sessionMode,
    sessionId,
    inviteCode,
    nickname,
    members,
    isOwner,
    pendingInviteCode,
    setPendingInviteCode,
    sessionInvalidated,
    isConnected,
    skipNextSSERef,
    handleCreateNewRoute,
    handleUpdateCourseName,
    handleLoadCourseFromDashboard,
    handleJoinByInviteCode,
    handleCreateInviteCode,
    handleGoToDashboard,
    handleLogout,
    handleSessionInvalidatedLogout,
  } = useCourseSession({
    setActiveTab,
    showToastMsg: (msg) => {
      setToast(msg);
      setTimeout(() => setToast(null), 2500);
    },
    clearDirections,
    setIsRouteCreated,
  });

  // ──── Resize Panel State ────
  const appMainRef = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  const {
    size: hookSidebarSize,
    handleResizeStart,
    isResizing
  } = useResizable({
    mode: 'percentage',
    direction: isMobile ? 'vertical' : 'horizontal',
    initialWidth: 50, // These will be ignored if sidebarSize is overridden, but required by hook initial state
    initialHeight: 50,
    minWidth: 15,
    maxWidth: 70,
    minHeight: 20,
    maxHeight: 80,
    containerRef: appMainRef
  });

  const [sidebarSize, setSidebarSize] = useState<number | null>(null);

  useEffect(() => {
    // Synchronize hook state with local state (sidebarSize uses width for desktop, height for mobile)
    if (isMobile) {
      if (hookSidebarSize.height !== 50) setSidebarSize(hookSidebarSize.height);
    } else {
      if (hookSidebarSize.width !== 50) setSidebarSize(hookSidebarSize.width);
    }
  }, [hookSidebarSize.width, hookSidebarSize.height, isMobile]);

  const showToastMsg = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Initialize Kakao SDK
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Kakao) {
      if (!window.Kakao.isInitialized()) {
        const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
        if (key && key !== 'your_kakao_js_key') {
          window.Kakao.init(key);
        }
      }
    }
  }, []);



  const handleClearRoute = useCallback(() => {
    clearDirections();
    setSchedule(null);
  }, [clearDirections, setSchedule]);

  // ──── Directions ────

  const handleCreateRoute = useCallback(() => {
    if (coursePlaces.length < 2) {
      showToastMsg('경로를 만들려면 장소가 2개 이상 필요합니다.');
      return;
    }
    fetchDirections(coursePlaces);
    setIsRouteCreated(true);
  }, [coursePlaces, fetchDirections, showToastMsg]);

  // ──── Place Actions (with server sync) ────
  const handleAddPlace = useCallback(
    async (place: Place & { day?: number }) => {
      const cleanTitle = stripHtml(place.title);
      const targetDay = place.day ?? 0;

      if (coursePlaces.some((p) => stripHtml(p.title) === cleanTitle && (p.day ?? 0) === targetDay)) {
        showToastMsg('이미 코스에 추가된 장소입니다');
        return;
      }

      const newPlace: CoursePlace = {
        ...place,
        id: Math.random().toString(36).substring(2, 9),
        order: coursePlaces.length,
        memo: '',
        day: targetDay,
      };

      setCoursePlaces((prev) => [...prev, newPlace]);



      setIsRouteCreated(false);
      showToastMsg(`"${cleanTitle}" 추가됨`);

      // Sync to server
      if (sessionId && newPlace) {
        skipNextSSERef.current = true;
        try {
          const res = await fetch(`/api/sessions/${sessionId}/places`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ place: newPlace, userId: currentUser?.id }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.place && data.place.id) {
              setCoursePlaces((prev) =>
                prev.map((p) => (p.id === newPlace!.id ? { ...p, id: data.place.id } : p))
              );
            }
          }
        } catch { /* ignore */ }
      }
    },
    [coursePlaces, showToastMsg, sessionId, currentUser?.id]
  );

  const handleRemovePlace = useCallback(
    async (id: string) => {
      const updated = coursePlaces.filter((p) => p.id !== id).map((p, i) => ({ ...p, order: i }));
      setCoursePlaces(updated);
      setIsRouteCreated(false);

      // Sync to server
      if (sessionId) {
        skipNextSSERef.current = true;
        try {
          await fetch(`/api/sessions/${sessionId}/places?id=${id}&userId=${currentUser?.id}`, {
            method: 'DELETE',
          });
        } catch { /* ignore */ }
      }
    },
    [coursePlaces, sessionId, currentUser?.id]
  );

  const handleReorderPlaces = useCallback(
    async (newPlaces: CoursePlace[]) => {
      setCoursePlaces(newPlaces);
      if (isRouteCreated) {
        setIsRouteCreated(false);
        setRoutePath(null);
        setDirections(null);
      }

      // Sync to server
      if (sessionId) {
        skipNextSSERef.current = true;
        try {
          await fetch(`/api/sessions/${sessionId}/places`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'set',
              places: newPlaces,
              userId: currentUser?.id,
            }),
          });
        } catch { /* ignore */ }
      }
    },
    [isRouteCreated, sessionId, currentUser?.id]
  );

  // ──── Course Save ────
  const handleSaveCourse = useCallback(
    async (name: string, description: string) => {
      if (sessionId) {
        try {
          const res = await fetch(`/api/sessions/${sessionId}/courses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, userId: currentUser?.id, nickname: currentUser?.nickname, schedule }),
          });
          if (!res.ok) {
            throw new Error('Save failed');
          }
          showToastMsg(`"${name}" 저장되었습니다!`);
        } catch {
          showToastMsg('경로 저장에 실패했습니다. (저장되지 않음)');
        }
      }
    },
    [showToastMsg, sessionId, currentUser?.id, currentUser?.nickname]
  );

  // ──── Share ────
  const handleShareCourseUrl = useCallback(() => {
    if (coursePlaces.length === 0) return;

    if (inviteCode) {
      const url = `${window.location.origin}?invite=${inviteCode}`;
      navigator.clipboard.writeText(url).then(() => {
        showToastMsg('초대 링크가 클립보드에 복사되었습니다!');
      });
    } else {
      const course: Course = {
        id: '', name: '공유 코스', description: '', places: coursePlaces, createdAt: '', updatedAt: '',
      };
      const url = encodeCourseToUrl(course);
      navigator.clipboard.writeText(url).then(() => {
        showToastMsg('공유 링크가 클립보드에 복사되었습니다!');
      });
    }
  }, [coursePlaces, showToastMsg, inviteCode]);

  const handleShareKakao = useCallback(() => {
    if (coursePlaces.length === 0) return;
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      showToastMsg('카카오톡 공유가 설정되지 않았습니다. API 키를 확인해주세요.');
      return;
    }

    let url: string;
    if (inviteCode) {
      url = `${window.location.origin}?invite=${inviteCode}`;
    } else {
      const course: Course = {
        id: '', name: '우리의 데이트 코스 💖', description: '', places: coursePlaces, createdAt: '', updatedAt: '',
      };
      url = encodeCourseToUrl(course);
    }

    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: 'DatingRoute - 데이트 코스 제안',
        description: coursePlaces.map((p) => p.title.replace(/<[^>]+>/g, '')).join(' ➔ '),
        imageUrl: 'https://cdn-icons-png.flaticon.com/512/3238/3238002.png',
        link: { mobileWebUrl: url, webUrl: url },
      },
      buttons: [{ title: '코스 확인하기', link: { mobileWebUrl: url, webUrl: url } }],
    });
  }, [coursePlaces, showToastMsg, inviteCode]);

  const handleCopyInviteCode = useCallback(() => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode).then(() => {
        showToastMsg(`초대코드 "${inviteCode}" 복사됨!`);
      });
    }
  }, [inviteCode, showToastMsg]);

  const handleCopyInviteLink = useCallback(() => {
    if (inviteCode) {
      const url = `${window.location.origin}?invite=${inviteCode}`;
      navigator.clipboard.writeText(url).then(() => {
        showToastMsg('초대 링크가 복사되었습니다!');
      });
    }
  }, [inviteCode, showToastMsg]);

  // ──── Render: Session Invalidated ────
  if (sessionInvalidated) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100dvh', width: '100%', background: 'var(--color-bg-primary)',
        position: 'fixed', top: 0, left: 0, zIndex: 9999, padding: '24px', boxSizing: 'border-box'
      }}>
        <div style={{
          background: 'var(--color-bg-card)', padding: '32px', borderRadius: '12px',
          width: '100%', maxWidth: '360px', textAlign: 'center',
          border: '1px solid var(--color-border)', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
        }}>
          <h2 style={{
            fontSize: '18px', color: 'var(--color-text-primary)', fontWeight: '700',
            margin: '0 0 12px 0', letterSpacing: '-0.3px'
          }}>
            다른 기기에서 로그인됨
          </h2>
          <p style={{
            fontSize: '14px', color: 'var(--color-text-secondary)',
            lineHeight: 1.6, margin: '0 0 24px 0', wordBreak: 'keep-all'
          }}>
            동일한 계정으로 다른 기기에서 접속하여<br />현재 세션이 종료되었습니다.
          </p>
          <button
            onClick={handleSessionInvalidatedLogout}
            style={{
              padding: '12px 16px', borderRadius: '8px', border: 'none',
              background: 'var(--color-text-primary)', color: 'var(--color-bg-primary)', fontSize: '14px',
              fontWeight: '600', cursor: 'pointer', width: '100%', transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#000'}
            onMouseOut={(e) => e.currentTarget.style.background = 'var(--color-text-primary)'}
          >
            확인
          </button>
        </div>
      </div>
    );
  }

  // ──── Render: Auth Screen ────
  if (!currentUser) {
    return <AuthScreen onLogin={(u) => {
      setCurrentUser(u);
      sessionStorage.setItem('datingroute_user', JSON.stringify(u));
      localStorage.removeItem('datingroute_user');
    }} />;
  }

  // ──── Render: Dashboard (no session mode selected) ────
  if (sessionMode === null) {
    return (
      <DashboardScreen
        currentUser={currentUser}
        onCreateNew={handleCreateNewRoute}
        onLoadCourse={handleLoadCourseFromDashboard}
        onLogout={handleLogout}
        pendingInviteCode={pendingInviteCode}
        onJoinByInviteCode={handleJoinByInviteCode}
      />
    );
  }

  // ──── Render: Main App (Builder) ────
  return (
    <div className="app-layout">
      <Header
        onGoToDashboard={handleGoToDashboard}
        courseCount={coursePlaces.length}
        currentUser={currentUser}
        onLogout={handleLogout}
        inviteCode={inviteCode}
        nickname={nickname}
        members={members}
        isConnected={isConnected}
        courseName={courseName}
        onUpdateCourseName={(name) => handleUpdateCourseName(name, courseDescription)}
        onCopyInviteCode={handleCopyInviteCode}
        onCopyInviteLink={handleCopyInviteLink}
      />

      <div className="app-main" ref={appMainRef}>
        <aside
          className="sidebar"
          style={sidebarSize != null ? (
            isMobile
              ? { height: `${sidebarSize}vh`, maxHeight: `${sidebarSize}vh` }
              : { width: `${sidebarSize}%`, minWidth: `${sidebarSize}%` }
          ) : undefined}
        >
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              🔍 장소검색
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai')}
            >
              ✨ AI 추천
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'route' ? 'active' : ''}`}
              onClick={() => setActiveTab('route')}
            >
              🗺️ 경로 생성
              {(() => {
                const totalCount = coursePlaces.filter(p => (p.day || 0) > 0).length;
                return totalCount > 0 ? (
                  <span className="sidebar-tab-badge">{totalCount}</span>
                ) : null;
              })()}
            </button>
          </div>

          <div className="sidebar-content" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: activeTab === 'search' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <SearchPanel
                coursePlaces={coursePlaces}
                onAddPlace={handleAddPlace}
                onShowReview={(name) => setReviewPlace(name)}
                onHighlightPlace={setHighlightPlace}
              />
            </div>
            <div style={{ display: activeTab === 'ai' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <AIRecommendPanel
                coursePlaces={coursePlaces}
                schedule={schedule}
                onScheduleChange={setSchedule}
                onAddPlace={handleAddPlace}
                onHighlightPlace={setHighlightPlace}
                roomId={sessionId}
              />
            </div>
            <div style={{ display: activeTab === 'route' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
              <CourseBuilder
                places={coursePlaces}
                directions={directions}
                onRemovePlace={handleRemovePlace}
                onAddPlace={handleAddPlace}
                onReorderPlaces={handleReorderPlaces}
                onShowReview={(name) => setReviewPlace(name)}
                onHighlightPlace={setHighlightPlace}
                onCreateRoute={handleCreateRoute}
                isRouteCreated={isRouteCreated}
                transitMode={transitMode}
                onChangeTransitMode={setTransitMode}
                onShareCourseUrl={handleShareCourseUrl}
                onShareKakao={handleShareKakao}
                inviteCode={inviteCode}
                onCreateInviteCode={handleCreateInviteCode}
                onJoinByInviteCode={handleJoinByInviteCode}
                onCopyInviteCode={handleCopyInviteCode}
                onCopyInviteLink={handleCopyInviteLink}
                members={members}
                currentUserId={currentUser?.id}
                schedule={schedule}
                onScheduleChange={setSchedule}
                courseName={courseName}
                courseDescription={courseDescription}
                onUpdateCourseName={handleUpdateCourseName}
                activeDayTab={activeDayTab}
                setActiveDayTab={setActiveDayTab}
                showStoragePins={showStoragePins}
                setShowStoragePins={setShowStoragePins}
                onShowToast={showToastMsg}
              />
            </div>
          </div>
        </aside>

        {/* Resize Handle */}
        <div
          className={`resize-handle ${isResizing ? 'dragging' : ''}`}
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
        >
          <div className="resize-handle-bar" />
        </div>

        <NaverMap
          coursePlaces={coursePlaces}
          highlightPlace={highlightPlace}
          routePath={isRouteCreated ? (routePath as any) : null}
          transitMode={transitMode}
          activeDayTab={activeDayTab}
          showStoragePins={showStoragePins}
        />

        {reviewPlace && (
          <ReviewPanel
            placeName={reviewPlace}
            onClose={() => setReviewPlace(null)}
          />
        )}
      </div>

      {showSaveModal && (
        <CourseManager
          onClose={() => setShowSaveModal(false)}
          onSaveCourse={handleSaveCourse}
          hasPlaces={coursePlaces.length > 0}
        />
      )}

      {toast && (
        <div className="toast toast-success">
          <span>✅</span> {toast}
        </div>
      )}
    </div>
  );
}

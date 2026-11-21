'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import SearchPanel from '@/components/SearchPanel';
import AIRecommendPanel from '@/components/AIRecommendPanel';
import CourseBuilder from '@/components/CourseBuilder';
import NaverMap from '@/components/NaverMap';
import ReviewPanel, { type ReviewMode } from '@/components/ReviewPanel';
import DashboardScreen from '@/components/DashboardScreen';
import AuthScreen from '@/components/AuthScreen';
import MembersPanel from '@/components/course/MembersPanel';
import type { Place, TransitMode } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { stripHtml } from '@/lib/utils';
import { useCourseSession } from '@/hooks/useCourseSession';
import { useResizable } from '@/hooks/useResizable';
import { useDirections } from '@/hooks/useDirections';
import { createInviteLink, useConnections } from '@/hooks/useConnections';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'search' | 'ai' | 'route'>('search');

  const { directions, routePath, fetchDirections, clearDirections } = useDirections();

  const [isRouteCreated, setIsRouteCreated] = useState(false);
  const [transitMode, setTransitMode] = useState<TransitMode>('driving');
  const [activeDayTab, setActiveDayTab] = useState<'all' | number>('all');

  const [highlightPlace, setHighlightPlace] = useState<Place | null>(null);
  const [reviewPlace, setReviewPlace] = useState<{ name: string; mode: ReviewMode } | null>(null);
  const showReview = useCallback((name: string, mode: ReviewMode = 'reviews') => setReviewPlace({ name, mode }), []);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToastMsg = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const [showStoragePins, setShowStoragePins] = useState(false);
  const [aiRadiusCircle, setAiRadiusCircle] = useState<{ center: { lat: number; lng: number }; radiusKm: number } | null>(null);

  const session = useCourseSession({
    setActiveTab,
    showToastMsg,
    clearDirections,
    setIsRouteCreated,
  });
  const {
    currentUser,
    setCurrentUser,
    isInitializing,
    isEntering,
    coursePlaces,
    schedule,
    courseName,
    courseDescription,
    sessionMode,
    sessionId,
    members,
    onlineUserIds,
    isOwner,
    pendingInviteCode,
    pendingImport,
    sessionInvalidated,
    isConnected,
    addPlaces,
  } = session;

  // The host's connections, for switching sharing on/off per person in the open course
  const { connections: hostConnections } = useConnections(sessionMode === 'builder' && isOwner, session.connectionsVersion);

  // ──── Resize Panel State ────
  const appMainRef = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  const { size: hookSidebarSize, handleResizeStart, isResizing } = useResizable({
    mode: 'percentage',
    direction: isMobile ? 'vertical' : 'horizontal',
    initialWidth: 50,
    initialHeight: 50,
    minWidth: 15,
    maxWidth: 70,
    minHeight: 20,
    maxHeight: 80,
    containerRef: appMainRef,
  });

  // Until the user drags the handle (hook still at its 50% default), keep the CSS layout
  const draggedSize = isMobile ? hookSidebarSize.height : hookSidebarSize.width;
  const sidebarSize = draggedSize !== 50 ? draggedSize : null;

  // Initialize Kakao SDK
  useEffect(() => {
    const init = () => {
      if (!window.Kakao || window.Kakao.isInitialized()) return;
      const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
      if (key && key !== 'your_kakao_js_key') window.Kakao.init(key);
    };
    init();
    const timer = setTimeout(init, 1500); // the SDK script loads after hydration
    return () => clearTimeout(timer);
  }, []);

  // ──── Directions ────
  const handleCreateRoute = useCallback(() => {
    if (coursePlaces.filter((p) => (p.day ?? 0) > 0).length < 2) {
      showToastMsg('경로를 만들려면 날짜에 담긴 장소가 2개 이상 필요합니다.');
      return;
    }
    fetchDirections(coursePlaces);
    setIsRouteCreated(true);
  }, [coursePlaces, fetchDirections, showToastMsg]);

  const handleAddPlace = useCallback((place: Place & { day?: number }) => {
    addPlaces([place]);
  }, [addPlaces]);

  // ──── Share ────
  const getShareUrl = useCallback(async (): Promise<string | null> => {
    if (!sessionId) return null;
    try {
      const data = await apiFetch<{ path: string }>(`/api/sessions/${sessionId}/share`, { method: 'POST' });
      return `${window.location.origin}${data.path}`;
    } catch (err) {
      showToastMsg((err as Error).message || '공유 링크를 만들지 못했어요.');
      return null;
    }
  }, [sessionId, showToastMsg]);

  const copyText = useCallback(async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToastMsg(message);
    } catch {
      window.prompt('아래 링크를 복사하세요', text);
    }
  }, [showToastMsg]);

  const handleCopyShareLink = useCallback(async () => {
    const url = await getShareUrl();
    if (url) copyText(url, '읽기 전용 공유 링크를 복사했어요!');
  }, [getShareUrl, copyText]);

  const handleShareKakao = useCallback(async () => {
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      showToastMsg('카카오톡 공유가 설정되지 않았습니다. API 키를 확인해주세요.');
      return;
    }
    const url = await getShareUrl();
    if (!url) return;
    const dayPlaces = coursePlaces.filter((p) => (p.day ?? 0) > 0);
    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: courseName || 'DatingRoute 데이트 코스',
        description: (dayPlaces.length > 0 ? dayPlaces : coursePlaces).map((p) => stripHtml(p.title)).join(' → ').slice(0, 200),
        imageUrl: `${url}/opengraph-image`,
        link: { mobileWebUrl: url, webUrl: url },
      },
      buttons: [{ title: '코스 보기', link: { mobileWebUrl: url, webUrl: url } }],
    });
  }, [coursePlaces, courseName, getShareUrl, showToastMsg]);

  /** Host only: a one-time link that connects the invitee and opens this course for them */
  const handleCopyCourseInvite = useCallback(async () => {
    if (!sessionId) return;
    try {
      const link = await createInviteLink(sessionId);
      copyText(link.url, '초대 링크를 복사했어요! 받은 사람은 닉네임만으로 바로 참여할 수 있어요. (7일, 1회)');
    } catch (err) {
      showToastMsg((err as Error).message || '초대 링크를 만들지 못했어요.');
    }
  }, [sessionId, copyText, showToastMsg]);

  // ──── Render: Session Invalidated ────
  if (sessionInvalidated) {
    return (
      <div className="fullscreen-center">
        <div className="notice-card">
          <h2>로그인이 필요해요</h2>
          <p>로그아웃했거나 로그인한 지 오래되어 세션이 끝났습니다.<br />다시 로그인해주세요.</p>
          <button className="notice-card-btn" onClick={session.handleSessionInvalidatedLogout}>확인</button>
        </div>
      </div>
    );
  }

  if (isInitializing) {
    return <div style={{ height: '100dvh', background: 'var(--color-bg-primary)' }} />;
  }

  if (!currentUser) {
    return (
      <AuthScreen
        onLogin={setCurrentUser}
        inviteCode={pendingInviteCode}
        importName={pendingImport ? (pendingImport.kind === 'legacy' ? pendingImport.name : '공유받은 코스') : null}
      />
    );
  }

  if (sessionMode === null) {
    return (
      <>
        <DashboardScreen
          currentUser={currentUser}
          onUserChange={setCurrentUser}
          onCreateNew={session.handleCreateNewRoute}
          onLoadCourse={session.handleLoadCourseFromDashboard}
          onLogout={session.handleLogout}
          onRedeemInvite={session.handleRedeemInvite}
          connectionsVersion={session.connectionsVersion}
          onCopy={copyText}
        />
        {isEntering && (
          <div className="entering-overlay" role="status" aria-live="polite">
            <div className="dashboard-loading-spinner" />
            <span>경로를 여는 중...</span>
          </div>
        )}
        {toast && <div className="toast toast-success"><span>✅</span> {toast}</div>}
      </>
    );
  }

  const dayPlaceCount = coursePlaces.filter((p) => (p.day || 0) > 0).length;

  return (
    <div className="app-layout">
      <Header
        onGoToDashboard={session.handleGoToDashboard}
        currentUser={currentUser}
        onLogout={session.handleLogout}
        members={members}
        onlineUserIds={onlineUserIds}
        isConnected={isConnected}
        membersPanel={sessionId ? (
          <MembersPanel
            roomId={sessionId}
            members={members}
            onlineUserIds={onlineUserIds}
            currentUserId={currentUser.id}
            isHost={isOwner}
            connections={hostConnections}
            onToggle={session.setMemberEnabled}
            onCopy={copyText}
          />
        ) : null}
      />

      <div className="app-main" ref={appMainRef}>
        <aside
          className="sidebar"
          style={sidebarSize != null ? (
            isMobile
              ? { height: `${sidebarSize}dvh`, maxHeight: `${sidebarSize}dvh` }
              : { width: `${sidebarSize}%`, minWidth: `${sidebarSize}%` }
          ) : undefined}
        >
          <div className="sidebar-tabs">
            <button className={`sidebar-tab ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>
              🔍 장소검색
            </button>
            <button className={`sidebar-tab ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => setActiveTab('ai')}>
              ✨ AI 추천
            </button>
            <button className={`sidebar-tab ${activeTab === 'route' ? 'active' : ''}`} onClick={() => setActiveTab('route')}>
              🗺️ 코스
              {dayPlaceCount > 0 && <span className="sidebar-tab-badge">{dayPlaceCount}</span>}
            </button>
          </div>

          <div className="sidebar-content" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: activeTab === 'search' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <SearchPanel
                coursePlaces={coursePlaces}
                onAddPlace={handleAddPlace}
                onShowReview={showReview}
                onHighlightPlace={setHighlightPlace}
              />
            </div>
            <div style={{ display: activeTab === 'ai' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <AIRecommendPanel
                coursePlaces={coursePlaces}
                schedule={schedule}
                onScheduleChange={session.handleScheduleChange}
                onAddPlace={handleAddPlace}
                onAddPlaces={addPlaces}
                onShowReview={showReview}
                onHighlightPlace={setHighlightPlace}
                onRadiusCircleChange={setAiRadiusCircle}
                onOpenDay={(day) => { setActiveTab('route'); setActiveDayTab(day); }}
                roomId={sessionId}
              />
            </div>
            <div style={{ display: activeTab === 'route' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
              <CourseBuilder
                places={coursePlaces}
                directions={directions}
                isRouteCreated={isRouteCreated}
                transitMode={transitMode}
                onChangeTransitMode={setTransitMode}
                onCreateRoute={handleCreateRoute}
                onApplyPlaces={session.applyPlaces}
                onAddPlaces={addPlaces}
                onRemovePlace={session.removePlace}
                onUpdatePlace={session.updatePlace}
                onReact={session.setReaction}
                onReplacePlace={session.replacePlace}
                onUploadPhoto={session.uploadPhoto}
                onShowReview={showReview}
                onHighlightPlace={setHighlightPlace}
                onShareKakao={handleShareKakao}
                onCopyShareLink={handleCopyShareLink}
                onCopyInviteLink={isOwner ? handleCopyCourseInvite : undefined}
                members={members}
                currentUserId={currentUser.id}
                schedule={schedule}
                onScheduleChange={session.handleScheduleChange}
                courseName={courseName}
                courseDescription={courseDescription}
                onUpdateCourseName={session.handleUpdateCourseName}
                activeDayTab={activeDayTab}
                setActiveDayTab={setActiveDayTab}
                showStoragePins={showStoragePins}
                setShowStoragePins={setShowStoragePins}
                onShowToast={showToastMsg}
              />
            </div>
          </div>
        </aside>

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
          routePath={isRouteCreated ? routePath : null}
          transitMode={transitMode}
          activeDayTab={activeDayTab}
          showStoragePins={showStoragePins}
          searchRadiusCircle={activeTab === 'ai' ? aiRadiusCircle : null}
        />

        {reviewPlace && (
          <ReviewPanel
            key={reviewPlace.name}
            placeName={reviewPlace.name}
            mode={reviewPlace.mode}
            onModeChange={(mode) => setReviewPlace((prev) => (prev ? { ...prev, mode } : prev))}
            onClose={() => setReviewPlace(null)}
          />
        )}
      </div>

      {toast && (
        <div className="toast toast-success">
          <span>✅</span> {toast}
        </div>
      )}
    </div>
  );
}

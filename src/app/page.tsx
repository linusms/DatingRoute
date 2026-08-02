'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import Header from '@/components/Header';
import SearchPanel from '@/components/SearchPanel';
import AIRecommendPanel from '@/components/AIRecommendPanel';
import CourseBuilder from '@/components/CourseBuilder';
import NaverMap from '@/components/NaverMap';
import ReviewPanel from '@/components/ReviewPanel';
import CourseManager from '@/components/CourseManager';
import SessionModeSelector from '@/components/SessionModeSelector';
import SessionBar from '@/components/SessionBar';
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
} from '@/lib/types';
import {
  saveCourse as saveLocalCourse,
  generateCourseId,
  encodeCourseToUrl,
  decodeCourseFromUrl,
} from '@/lib/courseStorage';
import { katechToWgs84, getStraightLineDistance } from '@/lib/utils';
import { useSessionSync } from '@/lib/useSessionSync';

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'ai' | 'route'>('search');
  const [coursePlaces, setCoursePlaces] = useState<CoursePlace[]>([]);

  // Directions state
  const [directions, setDirections] = useState<DirectionResult | null>(null);
  const [routePath, setRoutePath] = useState<Array<[number, number]> | null>(null);

  // Route features state
  const [isRouteCreated, setIsRouteCreated] = useState(false);
  const [transitMode, setTransitMode] = useState<TransitMode>('driving');

  const [highlightPlace, setHighlightPlace] = useState<Place | null>(null);
  const [reviewPlace, setReviewPlace] = useState<string | null>(null);
  const [showManager, setShowManager] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Session state
  const [sessionMode, setSessionMode] = useState<SessionMode | null>(null); // null = not yet decided
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>('');
  const [memberId, setMemberId] = useState<string | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);

  // Skip SSE updates that were triggered by this client
  const skipNextSSERef = useRef(false);

  // ──── Resize Panel State ────
  const [sidebarSize, setSidebarSize] = useState<number | null>(null); // null = use default
  const isDraggingRef = useRef(false);
  const appMainRef = useRef<HTMLDivElement>(null);

  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768;
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = isMobile ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current || !appMainRef.current) return;
      const rect = appMainRef.current.getBoundingClientRect();
      const clientPos = 'touches' in ev ? ev.touches[0] : ev;

      if (isMobile) {
        // Vertical resize: sidebar height
        const offsetY = clientPos.clientY - rect.top;
        const percent = (offsetY / rect.height) * 100;
        setSidebarSize(Math.max(20, Math.min(80, percent)));
      } else {
        // Horizontal resize: sidebar width
        const offsetX = clientPos.clientX - rect.left;
        const percent = (offsetX / rect.width) * 100;
        setSidebarSize(Math.max(15, Math.min(70, percent)));
      }
    };

    const handleEnd = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
  }, [isMobile]);

  // Detect localhost and check for invite parameter
  useEffect(() => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    setIsLocalhost(isLocal);

    // Check for invite code in URL
    const params = new URLSearchParams(window.location.search);
    const invite = params.get('invite');
    if (invite) {
      setPendingInviteCode(invite.toUpperCase());
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Check for old-style shared URL
    const shared = params.get('shared');
    if (shared) {
      const decoded = decodeCourseFromUrl(shared);
      if (decoded) {
        setCoursePlaces(decoded.places);
        setActiveTab('route');
        setSessionMode('dev'); // Load shared course in dev mode
        showToastMsg(`"${decoded.name}" 공유 코스를 불러왔습니다!`);
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }
    }

    // Try to restore persisted session
    try {
      const userRaw = localStorage.getItem('datingroute_user');
      if (userRaw) {
        setCurrentUser(JSON.parse(userRaw));
      }

      const raw = localStorage.getItem('datingroute_session');
      if (raw) {
        const persisted = JSON.parse(raw);
        if (persisted.mode && persisted.sessionId) {
          // Validate session still exists
          fetch(`/api/sessions/${persisted.sessionId}?userId=${persisted.memberId}`)
            .then((res) => {
              if (!res.ok) throw new Error('expired');
              return res.json();
            })
            .then((data) => {
              setSessionMode(persisted.mode);
              setSessionId(persisted.sessionId);
              setInviteCode(persisted.inviteCode);
              setNickname(persisted.nickname);
              setMemberId(persisted.memberId);
              setIsOwner(persisted.isOwner);
              setMembers(data.room?.members || []);

              // Load live places
              if (data.coursePlaces && data.coursePlaces.length > 0) {
                setCoursePlaces(data.coursePlaces);
              }
            })
            .catch(() => {
              localStorage.removeItem('datingroute_session');
              // Session expired, show mode selector
            });
          return;
        }
      }
    } catch { /* ignore */ }

    // If invite code in URL, show join flow
    if (invite) {
      // Will be handled by SessionModeSelector
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ──── SSE Real-time Sync ────
  const { isConnected } = useSessionSync({
    sessionId,
    enabled: (sessionMode === 'invite' || sessionMode === 'dev') && !!sessionId,
    onPlaceAdded: (_place, allPlaces) => {
      if (skipNextSSERef.current) {
        skipNextSSERef.current = false;
        return;
      }
      if (allPlaces) setCoursePlaces(allPlaces);
    },
    onPlaceRemoved: (_placeId, allPlaces) => {
      if (skipNextSSERef.current) {
        skipNextSSERef.current = false;
        return;
      }
      if (allPlaces) {
        setCoursePlaces(allPlaces);
        setIsRouteCreated(false);
      }
    },
    onPlacesReordered: (allPlaces) => {
      if (skipNextSSERef.current) {
        skipNextSSERef.current = false;
        return;
      }
      if (allPlaces) {
        setCoursePlaces(allPlaces);
        setIsRouteCreated(false);
      }
    },
    onMemberJoined: (member) => {
      setMembers((prev) => {
        if (prev.find((m) => m.id === member.id)) return prev;
        return [...prev, member];
      });
      showToastMsg(`🎉 ${member.nickname}님이 참여했습니다!`);
    },
  });

  // ──── Helper ────
  const showToastMsg = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const persistSessionData = useCallback((data: {
    mode: SessionMode; sessionId: string; inviteCode: string;
    nickname: string; memberId: string; isOwner: boolean;
  }) => {
    try {
      localStorage.setItem('datingroute_session', JSON.stringify(data));
    } catch { /* ignore */ }
  }, []);

  // ──── Session Actions ────
  const handleCreateSession = useCallback(async (mode: SessionMode) => {
    if (!currentUser) return;
    
    if (mode === 'personal') {
      const personalRoomId = `personal_${currentUser.id}`;
      setSessionMode('personal');
      setSessionId(personalRoomId);
      setInviteCode(null);
      setNickname(currentUser.nickname);
      setMemberId(currentUser.id);
      setMembers([]);
      setIsOwner(true);
      
      persistSessionData({
        mode: 'personal',
        sessionId: personalRoomId,
        inviteCode: '',
        nickname: currentUser.nickname,
        memberId: currentUser.id,
        isOwner: true,
      });

      // Fetch personal live places
      try {
        const placesRes = await fetch(`/api/sessions/${personalRoomId}?userId=${currentUser.id}`);
        if (placesRes.ok) {
          const placesData = await placesRes.json();
          if (placesData.coursePlaces?.length > 0) {
            setCoursePlaces(placesData.coursePlaces);
          } else {
            setCoursePlaces([]);
          }
        }
      } catch (err) {
        console.error(err);
      }
      return;
    }

    // Invite mode
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId: currentUser.id, expiresInDays: 30 }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '세션 생성 실패');
    }
    const data = await res.json();

    setSessionMode('dev');
    setSessionId(data.room.id);
    setInviteCode(data.inviteCode);
    setNickname(currentUser.nickname);
    setMemberId(currentUser.id);
    setMembers([]);
    setIsOwner(true);

    persistSessionData({
      mode: 'dev',
      sessionId: data.room.id,
      inviteCode: data.inviteCode,
      nickname: currentUser.nickname,
      memberId: currentUser.id,
      isOwner: true,
    });

    setCoursePlaces([]);
    showToastMsg(`✨ 초대코드: ${data.inviteCode}`);
  }, [currentUser, persistSessionData, showToastMsg]);

  const handleJoinSession = useCallback(async (code: string) => {
    if (!currentUser) return;
    
    const res = await fetch('/api/sessions/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: code, userId: currentUser.id }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '세션 참여 실패');
    }
    const data = await res.json();

    setSessionMode('invite');
    setSessionId(data.room.id);
    setInviteCode(data.room.inviteCode);
    setNickname(currentUser.nickname);
    setMemberId(currentUser.id);
    setMembers([]);
    setIsOwner(false);
    setPendingInviteCode(null);

    persistSessionData({
      mode: 'invite',
      sessionId: data.room.id,
      inviteCode: data.room.inviteCode,
      nickname: currentUser.nickname,
      memberId: currentUser.id,
      isOwner: false,
    });

    // Load live places from session
    try {
      const placesRes = await fetch(`/api/sessions/${data.room.id}?userId=${currentUser.id}`);
      if (placesRes.ok) {
        const placesData = await placesRes.json();
        if (placesData.coursePlaces?.length > 0) {
          setCoursePlaces(placesData.coursePlaces);
          setActiveTab('route');
        }
      }
    } catch { /* ignore */ }

    showToastMsg(`🎉 세션에 참여했습니다!`);
  }, [currentUser, persistSessionData, showToastMsg]);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem('datingroute_user');
    handleDisconnect();
  }, []);

  const handleDisconnect = useCallback(() => {
    setSessionMode(null);
    setSessionId(null);
    setInviteCode(null);
    setNickname('');
    setMemberId(null);
    setMembers([]);
    setIsOwner(false);
    setCoursePlaces([]);
    setDirections(null);
    setRoutePath(null);
    setIsRouteCreated(false);
    localStorage.removeItem('datingroute_session');
  }, []);

  // ──── Directions ────
  const fetchDirections = useCallback(async (places: CoursePlace[]) => {
    if (places.length < 2) {
      setDirections(null);
      setRoutePath(null);
      return;
    }

    try {
      const coords = places.map((p) => {
        const { lng, lat } = katechToWgs84(p.mapx, p.mapy);
        return `${lng},${lat}`;
      });

      const start = coords[0];
      const goal = coords[coords.length - 1];
      const waypoints = coords.length > 2 ? coords.slice(1, -1).join('|') : undefined;

      let url = `/api/directions?start=${start}&goal=${goal}`;
      if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || data.error) throw new Error(data.error || 'API Error');

      if (data._fullPath && data._fullPath.length > 0) {
        setDirections({
          totalDistance: data._totalDistance || 0,
          totalDuration: data._totalDuration || 0,
          legs: data._parsedLegs || [],
          fullPath: data._fullPath,
        });
        setRoutePath(data._fullPath);
      } else {
        throw new Error('No path data');
      }
    } catch {
      // Fallback: straight-line distance
      let totalDistMeters = 0;
      const fullPath: Array<[number, number]> = [];
      const coords = places.map((p) => {
        const { lng, lat } = katechToWgs84(p.mapx, p.mapy);
        fullPath.push([lng, lat]);
        return { lng, lat };
      });

      const fallbackLegs = [];
      for (let i = 0; i < coords.length - 1; i++) {
        const dist = getStraightLineDistance(coords[i].lat, coords[i].lng, coords[i + 1].lat, coords[i + 1].lng);
        totalDistMeters += dist;
        fallbackLegs.push({ index: i, distance: dist, duration: (dist / 40000) * 3600000, name: '' });
      }

      setDirections({ totalDistance: totalDistMeters, totalDuration: (totalDistMeters / 40000) * 3600000, legs: fallbackLegs, fullPath });
      setRoutePath(fullPath);
    }
  }, []);

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
    async (place: Place) => {
      const alreadyExists = coursePlaces.some((p) => p.title === place.title);
      if (alreadyExists) {
        showToastMsg('이미 코스에 추가된 장소입니다');
        return;
      }

      const coursePlace: CoursePlace = {
        ...place,
        id: place.id || Math.random().toString(36).substring(2, 9),
        order: coursePlaces.length,
        memo: '',
      };

      const updated = [...coursePlaces, coursePlace];
      setCoursePlaces(updated);
      setIsRouteCreated(false);
      showToastMsg(`"${place.title.replace(/<[^>]+>/g, '')}" 추가됨`);

      // Sync to server
      if (sessionMode && sessionId) {
        skipNextSSERef.current = true;
        try {
          await fetch(`/api/sessions/${sessionId}/places`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ place: coursePlace, userId: currentUser?.id }),
          });
        } catch { /* ignore */ }
      }
    },
    [coursePlaces, showToastMsg, sessionMode, sessionId, nickname]
  );

  const handleRemovePlace = useCallback(
    async (id: string) => {
      const updated = coursePlaces.filter((p) => p.id !== id).map((p, i) => ({ ...p, order: i }));
      setCoursePlaces(updated);
      setIsRouteCreated(false);

      // Sync to server
      if (sessionMode && sessionId) {
        skipNextSSERef.current = true;
        try {
          await fetch(`/api/sessions/${sessionId}/places?id=${id}&userId=${currentUser?.id}`, {
            method: 'DELETE',
          });
        } catch { /* ignore */ }
      }
    },
    [coursePlaces, sessionMode, sessionId, nickname]
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
      if (sessionMode && sessionId) {
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
    [isRouteCreated, sessionMode, sessionId, nickname]
  );

  // ──── Course Save/Load ────
  const handleSaveCourse = useCallback(
    async (name: string, description: string) => {
      if (sessionId) {
        try {
          await fetch(`/api/sessions/${sessionId}/courses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, userId: currentUser?.id, nickname: currentUser?.nickname }),
          });
        } catch { /* ignore */ }
      }
      showToastMsg(`"${name}" 저장되었습니다!`);
    },
    [coursePlaces, showToastMsg, sessionMode, sessionId, nickname]
  );

  const handleLoadCourse = useCallback(
    async (course: Course) => {
      setCoursePlaces(course.places);
      setActiveTab('route');
      const hasRoute = course.places.length >= 2;
      setIsRouteCreated(hasRoute);
      if (hasRoute) fetchDirections(course.places);

      // Sync loaded course to live places
      if (sessionMode && sessionId) {
        skipNextSSERef.current = true;
        try {
          await fetch(`/api/sessions/${sessionId}/places`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set', places: course.places, userId: currentUser?.id }),
          });
        } catch { /* ignore */ }
      }

      showToastMsg(`"${course.name}" 불러왔습니다`);
    },
    [showToastMsg, fetchDirections, sessionMode, sessionId, nickname]
  );

  // ──── Share ────
  const handleShareCourseUrl = useCallback(() => {
    if (coursePlaces.length === 0) return;

    if (sessionMode === 'invite' && inviteCode) {
      // Share via invite link
      const url = `${window.location.origin}?invite=${inviteCode}`;
      navigator.clipboard.writeText(url).then(() => {
        showToastMsg('초대 링크가 클립보드에 복사되었습니다!');
      });
    } else {
      // Legacy URL share
      const course: Course = {
        id: '', name: '공유 코스', description: '', places: coursePlaces, createdAt: '', updatedAt: '',
      };
      const url = encodeCourseToUrl(course);
      navigator.clipboard.writeText(url).then(() => {
        showToastMsg('공유 링크가 클립보드에 복사되었습니다!');
      });
    }
  }, [coursePlaces, showToastMsg, sessionMode, inviteCode]);

  const handleShareKakao = useCallback(() => {
    if (coursePlaces.length === 0) return;
    if (!window.Kakao || !window.Kakao.isInitialized()) {
      showToastMsg('카카오톡 공유가 설정되지 않았습니다. API 키를 확인해주세요.');
      return;
    }

    let url: string;
    if (sessionMode === 'invite' && inviteCode) {
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
  }, [coursePlaces, showToastMsg, sessionMode, inviteCode]);

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

  // ──── Render: Mode Selection ────
  if (!currentUser) {
    return <AuthScreen onLogin={(u) => {
      setCurrentUser(u);
      localStorage.setItem('datingroute_user', JSON.stringify(u));
    }} />;
  }

  if (sessionMode === null) {
    return (
      <SessionModeSelector
        onSelect={(mode, code) => {
          if (mode === 'invite' && code) {
            handleJoinSession(code);
          } else {
            handleCreateSession(mode);
          }
        }}
        isLoading={false}
      />
    );
  }

  // ──── Render: Main App ────
  return (
    <div className="app-layout">
      <Header
        onOpenManager={() => setShowManager(true)}
        courseCount={coursePlaces.length}
        sessionMode={sessionMode}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Session Bar */}
      {sessionMode && (
        <SessionBar
          mode={sessionMode}
          inviteCode={inviteCode}
          nickname={nickname}
          members={members}
          isConnected={isConnected}
          onCopyInviteCode={handleCopyInviteCode}
          onCopyInviteLink={handleCopyInviteLink}
          onDisconnect={handleDisconnect}
        />
      )}

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
              {coursePlaces.length > 0 && (
                <span className="sidebar-tab-badge">{coursePlaces.length}</span>
              )}
            </button>
          </div>

          <div className="sidebar-content">
            <div style={{ display: activeTab === 'search' ? 'block' : 'none', height: '100%' }}>
              <SearchPanel
                onAddPlace={handleAddPlace}
                onShowReview={(name) => setReviewPlace(name)}
                onHighlightPlace={setHighlightPlace}
              />
            </div>
            <div style={{ display: activeTab === 'ai' ? 'block' : 'none', height: '100%' }}>
              <AIRecommendPanel
                coursePlaces={coursePlaces}
                onAddPlace={handleAddPlace}
                onHighlightPlace={setHighlightPlace}
              />
            </div>
            <div style={{ display: activeTab === 'route' ? 'block' : 'none', height: '100%' }}>
              <CourseBuilder
                places={coursePlaces}
                directions={directions}
                onRemovePlace={handleRemovePlace}
                onReorderPlaces={handleReorderPlaces}
                onShowReview={(name) => setReviewPlace(name)}
                onHighlightPlace={setHighlightPlace}
                onCreateRoute={handleCreateRoute}
                isRouteCreated={isRouteCreated}
                transitMode={transitMode}
                onChangeTransitMode={setTransitMode}
                onShareCourseUrl={handleShareCourseUrl}
                onShareKakao={handleShareKakao}
              />
            </div>
          </div>
        </aside>

        {/* Resize Handle */}
        <div
          className={`resize-handle ${isDraggingRef.current ? 'dragging' : ''}`}
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
        />

        {reviewPlace && (
          <ReviewPanel
            placeName={reviewPlace}
            onClose={() => setReviewPlace(null)}
          />
        )}
      </div>

      {showManager && (
        <CourseManager
          onClose={() => setShowManager(false)}
          onLoadCourse={handleLoadCourse}
          onSaveCourse={handleSaveCourse}
          hasPlaces={coursePlaces.length > 0}
          sessionMode={sessionMode}
          sessionId={sessionId}
          userId={currentUser.id}
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

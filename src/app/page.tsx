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
  DateSchedule,
} from '@/lib/types';
import {
  encodeCourseToUrl,
  decodeCourseFromUrl,
} from '@/lib/courseStorage';
import { katechToWgs84, getStraightLineDistance, stripHtml } from '@/lib/utils';
import { useSessionSync } from '@/lib/useSessionSync';

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'ai' | 'route'>('search');
  const [coursePlaces, setCoursePlaces] = useState<CoursePlace[]>([]);
  
  // Shared course state
  const [schedule, setSchedule] = useState<DateSchedule | null>(null);
  const [courseName, setCourseName] = useState<string>('');
  const [courseDescription, setCourseDescription] = useState<string>('');

  // Directions state
  const [directions, setDirections] = useState<DirectionResult | null>(null);
  const [routePath, setRoutePath] = useState<Array<[number, number]> | null>(null);

  // Route features state
  const [isRouteCreated, setIsRouteCreated] = useState(false);
  const [transitMode, setTransitMode] = useState<TransitMode>('driving');
  const [activeDayTab, setActiveDayTab] = useState<'all' | number>('all');

  const [highlightPlace, setHighlightPlace] = useState<Place | null>(null);
  const [reviewPlace, setReviewPlace] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showStoragePins, setShowStoragePins] = useState(false);

  // Session state - unified: null = dashboard, 'builder' = editing
  const [sessionMode, setSessionMode] = useState<SessionMode | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null); // room ID
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>('');
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const [sessionInvalidated, setSessionInvalidated] = useState(false);

  // Skip SSE updates that were triggered by this client
  const skipNextSSERef = useRef(false);

  // ──── Resize Panel State ────
  const [sidebarSize, setSidebarSize] = useState<number | null>(null);
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
        const offsetY = clientPos.clientY - rect.top;
        const percent = (offsetY / rect.height) * 100;
        setSidebarSize(Math.max(20, Math.min(80, percent)));
      } else {
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

  // ──── Session Token Validation ────
  const validateSession = useCallback(async () => {
    if (!currentUser?.sessionToken || !currentUser?.id) return;
    try {
      const res = await fetch('/api/auth/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, sessionToken: currentUser.sessionToken }),
      });
      if (!res.ok) {
        setSessionInvalidated(true);
      }
    } catch { /* ignore network errors */ }
  }, [currentUser?.id, currentUser?.sessionToken]);

  // Periodically validate session token (every 30 seconds)
  useEffect(() => {
    if (!currentUser?.sessionToken) return;
    const interval = setInterval(validateSession, 30000);
    return () => clearInterval(interval);
  }, [validateSession, currentUser?.sessionToken]);

  // Detect invite parameter and restore session on mount
  useEffect(() => {
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
        showToastMsg(`"${decoded.name}" 공유 코스를 불러왔습니다!`);
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }
    }

    // Try to restore persisted user
    try {
      const userRaw = localStorage.getItem('datingroute_user');
      if (userRaw) {
        setCurrentUser(JSON.parse(userRaw));
      }
    } catch { /* ignore */ }
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
    enabled: sessionMode === 'builder' && !!sessionId,
    onPlaceAdded: (_place, allPlaces) => {
      if (skipNextSSERef.current) {
        skipNextSSERef.current = false;
        return;
      }
      if (allPlaces) {
        setCoursePlaces(allPlaces);
        setIsRouteCreated(false);
      } else if (_place) {
        setCoursePlaces(prev => {
          const exists = prev.find(p => p.id === _place.id);
          if (exists) return prev;
          return [...prev, _place].sort((a, b) => a.order - b.order);
        });
        setIsRouteCreated(false);
      }
    },
    onPlaceRemoved: (_placeId, allPlaces) => {
      if (skipNextSSERef.current) {
        skipNextSSERef.current = false;
        return;
      }
      if (allPlaces) {
        setCoursePlaces(allPlaces);
        setIsRouteCreated(false);
      } else if (_placeId) {
        setCoursePlaces(prev => prev.filter(p => p.id !== _placeId));
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

  // ──── Session Actions ────

  /** Create a new route: always creates a room */
  const handleCreateNewRoute = useCallback(async () => {
    if (!currentUser) return;

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: currentUser.id, expiresInDays: 30 }),
      });
      if (!res.ok) throw new Error('방 생성 실패');
      const data = await res.json();

      setSessionMode('builder');
      setSessionId(data.room.id);
      setInviteCode(data.inviteCode);
      setNickname(currentUser.nickname);
      setMembers([{
        id: currentUser.id,
        roomId: data.room.id,
        userId: currentUser.id,
        joinedAt: new Date().toISOString(),
        isOwner: true,
        nickname: currentUser.nickname,
      }]);
      setIsOwner(true);
      setCoursePlaces([]);
      setDirections(null);
      setRoutePath(null);
      setIsRouteCreated(false);
      setCourseName('');
      setCourseDescription('');
      setSchedule(null);
    } catch (err) {
      console.error(err);
      showToastMsg('경로 생성에 실패했습니다.');
    }
  }, [currentUser, showToastMsg]);

  /** Update live course name */
  const handleUpdateCourseName = useCallback(async (displayName: string, description: string) => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}/name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, description }),
      });
      if (res.ok) {
        setCourseName(displayName);
        setCourseDescription(description);
        showToastMsg('경로 이름이 저장되었습니다.');
      }
    } catch (err) {
      console.error(err);
      showToastMsg('경로 이름 저장 중 오류가 발생했습니다.');
    }
  }, [sessionId, showToastMsg]);

  /** Load an existing course from the dashboard */
  const handleLoadCourseFromDashboard = useCallback(async (course: Course) => {
    if (!currentUser) return;

    // If the course has a roomId, reconnect to that room
    if (course.roomId) {
      try {
        const res = await fetch(`/api/sessions/${course.roomId}?userId=${currentUser.id}`);
        if (res.ok) {
          const data = await res.json();

          setSessionMode('builder');
          setSessionId(course.roomId);
          setInviteCode(data.room?.inviteCode || data.room?.invite_code || null);
          setNickname(currentUser.nickname);
          setMembers(data.room?.members || []);
          setIsOwner(data.room?.ownerId === currentUser.id);

          if (data.courseDetails) {
            setCourseName(data.courseDetails.displayName || '');
            setCourseDescription(data.courseDetails.description || '');
          }
          
          try {
            const savedSchedule = localStorage.getItem(`datingroute_schedule_${course.roomId}`);
            if (savedSchedule) {
              setSchedule(JSON.parse(savedSchedule));
            } else {
              setSchedule(null);
            }
          } catch { setSchedule(null); }

          // Use live places from the room (latest state)
          if (data.coursePlaces && data.coursePlaces.length > 0) {
            setCoursePlaces(data.coursePlaces);
          } else {
            setCoursePlaces(course.places);
          }

          setDirections(null);
          setRoutePath(null);
          setIsRouteCreated(false);
          return;
        }
      } catch { /* room may have expired, fall through */ }
    }

    // Fallback: just load the places without a room (legacy/expired room)
    // Create a new room for this course
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: currentUser.id, expiresInDays: 30 }),
      });
      if (!res.ok) throw new Error('방 생성 실패');
      const data = await res.json();

      setSessionMode('builder');
      setSessionId(data.room.id);
      setInviteCode(data.inviteCode);
      setNickname(currentUser.nickname);
      setMembers([{
        id: currentUser.id,
        roomId: data.room.id,
        userId: currentUser.id,
        joinedAt: new Date().toISOString(),
        isOwner: true,
        nickname: currentUser.nickname,
      }]);
      setIsOwner(true);
      setCoursePlaces(course.places);

      // Sync places to the new room's live course
      if (course.places.length > 0) {
        skipNextSSERef.current = true;
        await fetch(`/api/sessions/${data.room.id}/places`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set', places: course.places, userId: currentUser.id }),
        });
      }

      setDirections(null);
      setRoutePath(null);
      setIsRouteCreated(false);
    } catch (err) {
      console.error(err);
      showToastMsg('경로 불러오기에 실패했습니다.');
    }
  }, [currentUser, showToastMsg]);

  /** Join a room by invite code */
  const handleJoinByInviteCode = useCallback(async (code: string) => {
    if (!currentUser) return;

    const res = await fetch('/api/sessions/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: code, userId: currentUser.id }),
    });
    if (!res.ok) {
      const err = await res.json();
      showToastMsg(err.error || '유효하지 않은 초대코드입니다.');
      throw new Error(err.error || '세션 참여 실패');
    }
    const data = await res.json();

    setSessionMode('builder');
    setSessionId(data.room.id);
    setInviteCode(data.room.inviteCode);
    setNickname(currentUser.nickname);
    setMembers(data.room.members || []);
    setIsOwner(false);
    setPendingInviteCode(null);

    // Load live places from room
    try {
      const placesRes = await fetch(`/api/sessions/${data.room.id}?userId=${currentUser.id}`);
      if (placesRes.ok) {
        const placesData = await placesRes.json();
        
        if (placesData.courseDetails) {
          setCourseName(placesData.courseDetails.displayName || '');
          setCourseDescription(placesData.courseDetails.description || '');
        }

        try {
          const savedSchedule = localStorage.getItem(`datingroute_schedule_${data.room.id}`);
          if (savedSchedule) {
            setSchedule(JSON.parse(savedSchedule));
          } else {
            setSchedule(null);
          }
        } catch { setSchedule(null); }

        if (placesData.coursePlaces?.length > 0) {
          setCoursePlaces(placesData.coursePlaces);
          setActiveTab('route');
        }
      }
    } catch { /* ignore */ }

    showToastMsg('🎉 경로에 참여했습니다!');
  }, [currentUser, showToastMsg]);

  /** Create invite code for current room (already created with room, just display it) */
  const handleCreateInviteCode = useCallback(() => {
    // The invite code was already created when the room was created
    // Just show it
    if (inviteCode) {
      showToastMsg(`초대코드: ${inviteCode}`);
    }
  }, [inviteCode, showToastMsg]);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem('datingroute_user');
    handleGoToDashboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (schedule && sessionId) {
      localStorage.setItem(`datingroute_schedule_${sessionId}`, JSON.stringify(schedule));
    }
  }, [schedule, sessionId]);

  const handleGoToDashboard = useCallback(() => {
    setSessionMode(null);
    setSessionId(null);
    setInviteCode(null);
    setNickname('');
    setMembers([]);
    setIsOwner(false);
    setCoursePlaces([]);
    setDirections(null);
    setRoutePath(null);
    setIsRouteCreated(false);
    setSchedule(null);
  }, []);

  const handleSessionInvalidatedLogout = useCallback(() => {
    setSessionInvalidated(false);
    setCurrentUser(null);
    localStorage.removeItem('datingroute_user');
    handleGoToDashboard();
  }, [handleGoToDashboard]);

  // ──── Directions ────
  const fetchDirections = useCallback(async (places: CoursePlace[]) => {
    const validPlaces = places.filter((p) => (p.day ?? 0) !== 0);
    if (validPlaces.length < 2) {
      setDirections(null);
      setRoutePath(null);
      return;
    }

    const byDay: Record<number, CoursePlace[]> = {};
    validPlaces.forEach(p => {
      const d = p.day ?? 1;
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(p);
    });

    let totalDist = 0;
    let totalDur = 0;
    const allLegs: any[] = [];
    const newRoutePath: Record<number, Array<[number, number]>> = {};
    let globalLegIndex = 0;

    for (const d of Object.keys(byDay)) {
      const day = Number(d);
      const dPlaces = byDay[day];
      if (dPlaces.length < 2) continue;

      try {
        const coords = dPlaces.map((p) => {
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

        if (!res.ok || data.error || !data._fullPath) throw new Error(data.error || 'API Error');

        totalDist += data._totalDistance || 0;
        totalDur += data._totalDuration || 0;
        data._parsedLegs?.forEach((leg: any, i: number) => {
          allLegs.push({ ...leg, index: globalLegIndex++, fromId: dPlaces[i].id, toId: dPlaces[i+1].id });
        });
        newRoutePath[day] = data._fullPath;
      } catch {
        // Fallback: straight-line distance
        let dayDist = 0;
        const dPath: Array<[number, number]> = [];
        const coords = dPlaces.map((p) => {
          const { lng, lat } = katechToWgs84(p.mapx, p.mapy);
          dPath.push([lng, lat]);
          return { lng, lat };
        });

        for (let i = 0; i < coords.length - 1; i++) {
          const dist = getStraightLineDistance(coords[i].lat, coords[i].lng, coords[i + 1].lat, coords[i + 1].lng);
          dayDist += dist;
          allLegs.push({ index: globalLegIndex++, distance: dist, duration: (dist / 40000) * 3600000, name: '', fromId: dPlaces[i].id, toId: dPlaces[i+1].id });
        }
        totalDist += dayDist;
        totalDur += (dayDist / 40000) * 3600000;
        newRoutePath[day] = dPath;
      }
    }

    setDirections({ totalDistance: totalDist, totalDuration: totalDur, legs: allLegs, fullPath: [] });
    setRoutePath(newRoutePath as any);
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
    async (place: Place & { day?: number }) => {
      let isDuplicate = false;
      let newPlace: CoursePlace | null = null;
      const cleanTitle = stripHtml(place.title);
      const targetDay = place.day ?? 0;

      setCoursePlaces((prev) => {
        if (prev.some((p) => stripHtml(p.title) === cleanTitle && (p.day ?? 0) === targetDay)) {
          isDuplicate = true;
          return prev;
        }

        newPlace = {
          ...place,
          id: Math.random().toString(36).substring(2, 9),
          order: prev.length,
          memo: '',
          day: targetDay,
        };

        return [...prev, newPlace];
      });

      if (isDuplicate) {
        showToastMsg('이미 코스에 추가된 장소입니다');
        return;
      }

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
    [showToastMsg, sessionId, currentUser?.id]
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
      <div className="session-invalidated-overlay">
        <div className="session-invalidated-card">
          <div className="session-invalidated-icon">⚠️</div>
          <div className="session-invalidated-title">다른 기기에서 로그인됨</div>
          <div className="session-invalidated-text">
            동일한 계정으로 다른 기기에서 로그인되어<br />현재 세션이 종료되었습니다.
          </div>
          <button className="session-invalidated-btn" onClick={handleSessionInvalidatedLogout}>
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
      localStorage.setItem('datingroute_user', JSON.stringify(u));
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
      />

      {/* Session Bar */}
      <SessionBar
        inviteCode={inviteCode}
        nickname={nickname}
        members={members}
        isConnected={isConnected}
        courseName={courseName}
        onUpdateCourseName={(name) => handleUpdateCourseName(name, courseDescription)}
        onCopyInviteCode={handleCopyInviteCode}
        onCopyInviteLink={handleCopyInviteLink}
        onDisconnect={handleGoToDashboard}
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
                const storageCount = coursePlaces.filter((p) => (p.day ?? 0) === 0).length;
                return storageCount > 0 ? (
                  <span className="sidebar-tab-badge">{storageCount}</span>
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
          className={`resize-handle ${isDraggingRef.current ? 'dragging' : ''}`}
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

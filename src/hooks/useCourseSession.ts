import { useState, useCallback, useRef, useEffect } from 'react';
import { User, RoomMember, CoursePlace, DateSchedule, Course } from '@/lib/types';
import { useSessionSync } from '@/lib/useSessionSync';
import { decodeCourseFromUrl } from '@/lib/courseStorage';

type SessionMode = 'builder' | null;

interface UseCourseSessionProps {
  setActiveTab: (tab: 'search' | 'ai' | 'route') => void;
  showToastMsg: (msg: string) => void;
  clearDirections: () => void;
  setIsRouteCreated: (val: boolean) => void;
}

export function useCourseSession({ setActiveTab, showToastMsg, clearDirections, setIsRouteCreated }: UseCourseSessionProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [coursePlaces, setCoursePlaces] = useState<CoursePlace[]>([]);
  
  const [schedule, setSchedule] = useState<DateSchedule | null>(null);
  const [courseName, setCourseName] = useState<string>('');
  const [courseDescription, setCourseDescription] = useState<string>('');

  const [sessionMode, setSessionMode] = useState<SessionMode | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>('');
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const [sessionInvalidated, setSessionInvalidated] = useState(false);

  const skipNextSSERef = useRef(false);
  // 항상 최신 coursePlaces를 참조하기 위한 ref (stale closure 방지)
  const coursePlacesRef = useRef<CoursePlace[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const currentUserRef = useRef<User | null>(null);

  // ref를 항상 최신 상태와 동기화
  useEffect(() => { coursePlacesRef.current = coursePlaces; }, [coursePlaces]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

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

  useEffect(() => {
    if (!currentUser?.sessionToken) return;
    
    const handleFocus = () => validateSession();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') validateSession();
    });

    const interval = setInterval(validateSession, 5 * 60 * 1000);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
      clearInterval(interval);
    };
  }, [validateSession, currentUser?.sessionToken]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const invite = params.get('invite');
      if (invite) {
        setPendingInviteCode(invite.toUpperCase());
        window.history.replaceState({}, '', window.location.pathname);
      }

      const shared = params.get('shared');
      if (shared) {
        const decoded = decodeCourseFromUrl(shared);
        if (decoded) {
          setCoursePlaces(decoded.places);
          setActiveTab('route');
          showToastMsg(`"${decoded.name}" 공유 코스를 불러왔습니다!`);
          window.history.replaceState({}, '', window.location.pathname);
        }
      }

      let userRaw = sessionStorage.getItem('datingroute_user');
      
      // Migration from localStorage to sessionStorage
      if (!userRaw) {
        userRaw = localStorage.getItem('datingroute_user');
        if (userRaw) {
          sessionStorage.setItem('datingroute_user', userRaw);
          localStorage.removeItem('datingroute_user');
        }
      }

      if (userRaw) {
        try {
          setCurrentUser(JSON.parse(userRaw));
        } catch { /* ignore */ }
      }
    }
    setIsInitializing(false);
  }, [setActiveTab, showToastMsg]);

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
      clearDirections();
      setIsRouteCreated(false);
      setCourseName('');
      setCourseDescription('');
      setSchedule(null);
    } catch (err) {
      console.error(err);
      showToastMsg('경로 생성에 실패했습니다.');
    }
  }, [currentUser, showToastMsg, clearDirections, setIsRouteCreated]);

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

  const handleLoadCourseFromDashboard = useCallback(async (course: Course) => {
    if (!currentUser) return;

    if (course.roomId) {
      try {
        const res = await fetch(`/api/sessions/${course.roomId}?userId=${currentUser.id}`);
        if (res.ok) {
          const data = await res.json();
          setSessionMode('builder');
          setSessionId(course.roomId);
          setInviteCode(data.room?.inviteCode || data.room?.invite_code || null);
          setNickname(currentUser.nickname);
          const uniqueMembers = (data.room?.members || []).filter((v: any, i: number, a: any[]) => a.findIndex(t => (t.userId === v.userId)) === i);
          setMembers(uniqueMembers);
          setIsOwner(data.room?.ownerId === currentUser.id);

          if (data.courseDetails) {
            setCourseName(data.courseDetails.displayName || '');
            setCourseDescription(data.courseDetails.description || '');
            setSchedule(data.courseDetails.schedule ?? null);
          }

          if (data.coursePlaces && data.coursePlaces.length > 0) {
            setCoursePlaces(data.coursePlaces);
          } else {
            setCoursePlaces(course.places);
          }

          clearDirections();
          setIsRouteCreated(false);
          return;
        }
      } catch { /* ignore */ }
    }

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

      if (course.places.length > 0) {
        skipNextSSERef.current = true;
        await fetch(`/api/sessions/${data.room.id}/places`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set', places: course.places, userId: currentUser.id }),
        });
      }

      clearDirections();
      setIsRouteCreated(false);
    } catch (err) {
      console.error(err);
      showToastMsg('경로 불러오기에 실패했습니다.');
    }
  }, [currentUser, showToastMsg, clearDirections, setIsRouteCreated]);

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
    const uniqueMembers = (data.room.members || []).filter((v: any, i: number, a: any[]) => a.findIndex(t => (t.userId === v.userId)) === i);
    setMembers(uniqueMembers);
    setIsOwner(false);
    setPendingInviteCode(null);

    try {
      const placesRes = await fetch(`/api/sessions/${data.room.id}?userId=${currentUser.id}`);
      if (placesRes.ok) {
        const placesData = await placesRes.json();
        if (placesData.courseDetails) {
          setCourseName(placesData.courseDetails.displayName || '');
          setCourseDescription(placesData.courseDetails.description || '');
          setSchedule(placesData.courseDetails.schedule ?? null);
        }
        if (placesData.coursePlaces?.length > 0) {
          setCoursePlaces(placesData.coursePlaces);
          setActiveTab('route');
        }
      }
    } catch { /* ignore */ }

    showToastMsg('🎉 경로에 참여했습니다!');
  }, [currentUser, showToastMsg, setActiveTab]);

  const handleCreateInviteCode = useCallback(() => {
    if (inviteCode) {
      showToastMsg(`초대코드: ${inviteCode}`);
    }
  }, [inviteCode, showToastMsg]);

  const handleGoToDashboard = useCallback(async () => {
    // 대시보드로 나가기 전에 현재 보관함 포함 모든 장소를 DB에 확실히 저장합니다.
    // 개별 POST가 완료되지 않았거나 실패했더라도 이 PUT이 최종 상태를 보장합니다.
    const sid = sessionIdRef.current;
    const user = currentUserRef.current;
    const places = coursePlacesRef.current;
    if (sid && user?.id && places.length > 0) {
      try {
        await fetch(`/api/sessions/${sid}/places`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set', places, userId: user.id }),
        });
      } catch { /* ignore network errors */ }
    }

    setSessionMode(null);
    setSessionId(null);
    setInviteCode(null);
    setNickname('');
    setMembers([]);
    setIsOwner(false);
    setCoursePlaces([]);
    clearDirections();
    setIsRouteCreated(false);
    setSchedule(null);
  }, [clearDirections, setIsRouteCreated]);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    sessionStorage.removeItem('datingroute_user');
    localStorage.removeItem('datingroute_user'); // Just in case
    handleGoToDashboard();
  }, [handleGoToDashboard]);



  useEffect(() => {
    if (schedule !== undefined && sessionId) {
      fetch(`/api/sessions/${sessionId}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule }),
      }).catch(() => {/* ignore */});
    }
  }, [schedule, sessionId]);

  const handleSessionInvalidatedLogout = useCallback(() => {
    setSessionInvalidated(false);
    setCurrentUser(null);
    sessionStorage.removeItem('datingroute_user');
    localStorage.removeItem('datingroute_user');
    handleGoToDashboard();
  }, [handleGoToDashboard]);

  return {
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
  };
}

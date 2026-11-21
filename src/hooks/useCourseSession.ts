'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  Course,
  CoursePlace,
  DateSchedule,
  Place,
  PlacesChangedData,
  PlaceUpdatableFields,
  RoomMember,
  User,
} from '@/lib/types';
import { useSessionSync, type RemoteEventMeta } from '@/lib/useSessionSync';
import { decodeCourseFromUrl } from '@/lib/courseStorage';
import { apiFetch, newPlaceId } from '@/lib/api';
import { diffPlaces, isStructuralChange, structureKey, type PlaceOps } from '@/lib/placeOps';
import { stripHtml } from '@/lib/utils';

type SessionMode = 'builder' | null;

/** Something to turn into a new course once the user is signed in */
type PendingImport =
  | { kind: 'share'; shareId: string }
  | { kind: 'legacy'; name: string; places: CoursePlace[] };

export type NewPlaceInput = Place & { day?: number; stayMinutes?: number | null };

interface UseCourseSessionProps {
  setActiveTab: (tab: 'search' | 'ai' | 'route') => void;
  showToastMsg: (msg: string) => void;
  clearDirections: () => void;
  setIsRouteCreated: (val: boolean) => void;
}

interface InviteAcceptResponse {
  friend: { userId: string; nickname: string } | null;
  roomId: string | null;
  joinedRoom: boolean;
  ownInvite: boolean;
}

interface RoomResponse {
  room: { id: string; inviteCode: string; ownerId: string; members?: RoomMember[] };
  coursePlaces: CoursePlace[];
  courseDetails: { displayName: string; description: string; schedule: DateSchedule | null } | null;
}

/** Reads ?invite= / ?copy= / ?shared= once on the client (the server render has no URL params). */
function readLaunchParams(): { invite: string | null; pendingImport: PendingImport | null; hadParams: boolean } {
  if (typeof window === 'undefined') return { invite: null, pendingImport: null, hadParams: false };
  const params = new URLSearchParams(window.location.search);
  const invite = params.get('invite');
  const shared = params.get('shared');
  const copy = params.get('copy');
  let pendingImport: PendingImport | null = null;
  if (copy && /^[A-Za-z0-9_-]{6,32}$/.test(copy)) {
    pendingImport = { kind: 'share', shareId: copy };
  } else if (shared) {
    const decoded = decodeCourseFromUrl(shared);
    if (decoded) pendingImport = { kind: 'legacy', name: decoded.name || '공유받은 코스', places: decoded.places };
  }
  return { invite: invite ? invite.toUpperCase().slice(0, 12) : null, pendingImport, hadParams: !!(invite || shared || copy) };
}

function describeRemoteChange(data: PlacesChangedData, meta: RemoteEventMeta): string | null {
  const who = meta.sender ? `${meta.sender}님이` : '누군가';
  const first = data.titles?.[0] ? `'${stripHtml(data.titles[0])}'` : '';
  const more = (data.count ?? 0) > 1 ? ` 외 ${(data.count ?? 1) - 1}곳` : '';
  switch (data.action) {
    case 'added': return `${who} ${first}${more}을(를) 담았어요`;
    case 'removed': return `${who} ${first || '장소'}${more}을(를) 뺐어요`;
    case 'reordered': return `${who} 코스 순서를 바꿨어요`;
    case 'reacted': return first ? `${who} ${first}에 반응했어요` : null;
    case 'updated': return first ? `${who} ${first} 정보를 수정했어요` : `${who} 장소 정보를 수정했어요`;
    default: return null;
  }
}

export function useCourseSession({ setActiveTab, showToastMsg, clearDirections, setIsRouteCreated }: UseCourseSessionProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [coursePlaces, setCoursePlacesState] = useState<CoursePlace[]>([]);

  const [schedule, setSchedule] = useState<DateSchedule | null>(null);
  const [courseName, setCourseName] = useState<string>('');
  const [courseDescription, setCourseDescription] = useState<string>('');

  const [sessionMode, setSessionMode] = useState<SessionMode>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [launch] = useState(readLaunchParams);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(launch.invite);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(launch.pendingImport);
  const [sessionInvalidated, setSessionInvalidated] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  /** Bumped when a connection is added so lists of 함께하는 사람 reload */
  const [connectionsVersion, setConnectionsVersion] = useState(0);
  /** Leaves the open course when the host stops sharing it with this user (set below) */
  const removedFromRoomRef = useRef<() => void>(() => {});

  // Refs always hold the latest values for async callbacks (avoids stale closures)
  const coursePlacesRef = useRef<CoursePlace[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const currentUserRef = useRef<User | null>(null);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  /** Sets places in state and ref together so back-to-back edits diff against the latest list. */
  const commitPlaces = useCallback((list: CoursePlace[]) => {
    coursePlacesRef.current = list;
    setCoursePlacesState(list);
  }, []);

  /* ─────────── Session validity ─────────── */

  // 세션은 httpOnly 쿠키로 유지됩니다. 401이면 로그아웃됐거나 세션이 만료된 것입니다.
  const validateSession = useCallback(async () => {
    if (!currentUserRef.current) return;
    try {
      const res = await fetch('/api/auth/me');
      if (res.status === 401) setSessionInvalidated(true);
    } catch { /* ignore network errors */ }
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    const handleFocus = () => validateSession();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') validateSession();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const interval = setInterval(validateSession, 5 * 60 * 1000);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [validateSession, currentUser?.id]);

  /* ─────────── Initial load: URL params + cookie session ─────────── */

  useEffect(() => {
    if (launch.hadParams) window.history.replaceState({}, '', window.location.pathname);

    // Older builds kept the user (with a raw session token) in web storage; clear it.
    sessionStorage.removeItem('datingroute_user');
    localStorage.removeItem('datingroute_user');

    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.user) setCurrentUser(data.user); })
      .catch(() => { /* treat as logged out */ })
      .finally(() => setIsInitializing(false));
  }, [launch.hadParams]);

  /* ─────────── Place operations (optimistic, queued) ─────────── */

  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingOpsRef = useRef(0);
  const remoteDirtyRef = useRef(false);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetchPlaces = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    if (pendingOpsRef.current > 0) {
      remoteDirtyRef.current = true;
      return;
    }
    try {
      const data = await apiFetch<{ places: CoursePlace[] }>(`/api/sessions/${sid}/places`);
      // Our own edits started meanwhile: their result will trigger another refetch
      if (sessionIdRef.current !== sid) return;
      if (pendingOpsRef.current > 0) {
        remoteDirtyRef.current = true;
        return;
      }
      if (structureKey(coursePlacesRef.current) !== structureKey(data.places)) setIsRouteCreated(false);
      commitPlaces(data.places);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) setSessionInvalidated(true);
      else if (status === 403) removedFromRoomRef.current();
    }
  }, [commitPlaces, setIsRouteCreated]);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = setTimeout(() => {
      refetchTimerRef.current = null;
      refetchPlaces();
    }, 200);
  }, [refetchPlaces]);

  const sendOps = useCallback(async (sid: string, ops: PlaceOps) => {
    const base = `/api/sessions/${sid}/places`;
    if (ops.removedIds.length > 0) {
      await apiFetch(`${base}?ids=${ops.removedIds.map(encodeURIComponent).join(',')}`, { method: 'DELETE' });
    }
    if (ops.added.length > 0) {
      await apiFetch(base, { method: 'POST', json: { places: ops.added, order: ops.order } });
    } else if (ops.order) {
      await apiFetch(base, { method: 'PUT', json: { order: ops.order } });
    }
    for (const patch of ops.patches) {
      await apiFetch(base, { method: 'PATCH', json: patch });
    }
    for (const r of ops.reactions) {
      await apiFetch(base, { method: 'PATCH', json: { id: r.id, reaction: r.emoji } });
    }
  }, []);

  const enqueue = useCallback((task: () => Promise<void>) => {
    pendingOpsRef.current += 1;
    queueRef.current = queueRef.current
      .then(task)
      .catch((err) => {
        console.error('Place sync failed:', err);
        const status = (err as { status?: number }).status;
        if (status === 401) {
          setSessionInvalidated(true);
          return;
        }
        if (status === 403) {
          removedFromRoomRef.current();
          return;
        }
        remoteDirtyRef.current = true;
        showToastMsg('변경 사항을 저장하지 못해 최신 상태로 다시 불러왔어요.');
      })
      .finally(() => {
        pendingOpsRef.current -= 1;
        if (pendingOpsRef.current === 0 && remoteDirtyRef.current) {
          remoteDirtyRef.current = false;
          scheduleRefetch();
        }
      });
  }, [scheduleRefetch, showToastMsg]);

  /**
   * The single entry point for local place edits: updates the UI immediately, then sends
   * only the differences (add / remove / patch / reaction / reorder) to the server.
   */
  const applyPlaces = useCallback((next: CoursePlace[]) => {
    const prev = coursePlacesRef.current;
    const normalized = next.map((p, i) => (p.order === i ? p : { ...p, order: i }));
    const ops = diffPlaces(prev, normalized, currentUserRef.current?.id ?? null);
    commitPlaces(normalized);
    if (isStructuralChange(ops)) setIsRouteCreated(false);

    const sid = sessionIdRef.current;
    const hasOps = ops.added.length || ops.removedIds.length || ops.patches.length || ops.reactions.length || ops.order;
    if (sid && hasOps) enqueue(() => sendOps(sid, ops));
  }, [commitPlaces, enqueue, sendOps, setIsRouteCreated]);

  /** Adds places (deduplicated by title within the same day). Returns how many were added. */
  const addPlaces = useCallback((inputs: NewPlaceInput[], options: { day?: number; silent?: boolean } = {}) => {
    const prev = coursePlacesRef.current;
    const user = currentUserRef.current;
    const toAdd: CoursePlace[] = [];
    for (const input of inputs) {
      const day = options.day ?? input.day ?? 0;
      const title = stripHtml(input.title);
      const duplicate = [...prev, ...toAdd].some((p) => stripHtml(p.title) === title && (p.day ?? 0) === day);
      if (duplicate) continue;
      toAdd.push({
        id: newPlaceId(),
        title,
        category: input.category || '',
        address: input.address || '',
        roadAddress: input.roadAddress || '',
        mapx: Number(input.mapx) || 0,
        mapy: Number(input.mapy) || 0,
        link: input.link || '',
        description: input.description || '',
        order: 0,
        memo: '',
        day,
        reactions: {},
        addedBy: user?.nickname || '',
        stayMinutes: input.stayMinutes ?? null,
      });
    }
    if (toAdd.length === 0) {
      if (!options.silent) showToastMsg('이미 코스에 추가된 장소입니다');
      return 0;
    }
    applyPlaces([...prev, ...toAdd]);
    if (!options.silent) {
      const where = (options.day ?? inputs[0]?.day ?? 0) > 0 ? `Day ${options.day ?? inputs[0]?.day}에` : '보관함에';
      showToastMsg(toAdd.length === 1 ? `"${toAdd[0].title}" ${where} 담았어요` : `${toAdd.length}곳을 ${where} 담았어요`);
    }
    return toAdd.length;
  }, [applyPlaces, showToastMsg]);

  const removePlace = useCallback((id: string) => {
    applyPlaces(coursePlacesRef.current.filter((p) => p.id !== id));
  }, [applyPlaces]);

  const updatePlace = useCallback((id: string, fields: PlaceUpdatableFields) => {
    applyPlaces(coursePlacesRef.current.map((p) => (p.id === id ? { ...p, ...fields } : p)));
  }, [applyPlaces]);

  const setReaction = useCallback((id: string, emoji: string | null) => {
    const uid = currentUserRef.current?.id;
    if (!uid) return;
    applyPlaces(coursePlacesRef.current.map((p) => {
      if (p.id !== id) return p;
      const reactions = { ...(p.reactions || {}) };
      if (emoji) reactions[uid] = emoji;
      else delete reactions[uid];
      return { ...p, reactions };
    }));
  }, [applyPlaces]);

  /** Replaces a place in the same position and day (used by "비슷한 곳"). */
  const replacePlace = useCallback((id: string, input: NewPlaceInput) => {
    const list = coursePlacesRef.current;
    const old = list.find((p) => p.id === id);
    if (!old) return;
    const replacement: CoursePlace = {
      ...old,
      id: newPlaceId(),
      title: stripHtml(input.title),
      category: input.category || '',
      address: input.address || '',
      roadAddress: input.roadAddress || '',
      mapx: Number(input.mapx) || 0,
      mapy: Number(input.mapy) || 0,
      link: input.link || '',
      description: input.description || '',
      memo: '',
      reactions: {},
      stayMinutes: null,
      cost: null,
      visitedAt: null,
      rating: null,
      review: '',
      photoUrl: null,
      addedBy: currentUserRef.current?.nickname || '',
    };
    applyPlaces(list.map((p) => (p.id === id ? replacement : p)));
    showToastMsg(`"${stripHtml(old.title)}" → "${replacement.title}"로 바꿨어요`);
  }, [applyPlaces, showToastMsg]);

  const uploadPhoto = useCallback(async (placeId: string, file: Blob | null) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    const url = `/api/sessions/${sid}/places/${placeId}/photo`;
    try {
      let photoUrl: string | null = null;
      if (file) {
        const form = new FormData();
        form.append('photo', file, 'photo.jpg');
        const data = await apiFetch<{ photoUrl: string | null }>(url, { method: 'POST', body: form });
        photoUrl = data.photoUrl;
      } else {
        await apiFetch(url, { method: 'DELETE' });
      }
      commitPlaces(coursePlacesRef.current.map((p) => (p.id === placeId ? { ...p, photoUrl } : p)));
    } catch (err) {
      showToastMsg((err as Error).message || '사진을 저장하지 못했어요.');
    }
  }, [commitPlaces, showToastMsg]);

  /* ─────────── Realtime ─────────── */

  const { isConnected, onlineUserIds } = useSessionSync({
    sessionId,
    enabled: sessionMode === 'builder' && !!sessionId,
    me: currentUser ? { userId: currentUser.id, nickname: currentUser.nickname } : null,
    onPlacesChanged: (data, meta) => {
      const message = describeRemoteChange(data, meta);
      if (message) showToastMsg(message);
      scheduleRefetch();
    },
    onCourseUpdated: (data, meta) => {
      const who = meta.sender ? `${meta.sender}님이` : '누군가';
      if ('schedule' in data) {
        setSchedule(data.schedule ?? null);
        showToastMsg(`${who} 일정을 바꿨어요`);
      }
      if (typeof data.displayName === 'string') {
        setCourseName(data.displayName);
        setCourseDescription(data.description ?? '');
        showToastMsg(`${who} 코스 이름을 바꿨어요`);
      }
    },
    onMemberJoined: (member) => {
      setMembers((prev) => (prev.some((m) => m.userId === member.userId) ? prev : [...prev, member]));
      showToastMsg(`🎉 ${member.nickname}님이 참여했어요!`);
    },
    onMemberRemoved: (data) => {
      if (data.userId === currentUserRef.current?.id) {
        removedFromRoomRef.current();
        return;
      }
      setMembers((prev) => prev.filter((m) => m.userId !== data.userId));
      if (data.nickname) showToastMsg(`${data.nickname}님이 이 코스에서 빠졌어요`);
    },
    onConnected: () => scheduleRefetch(),
  });

  // Catch up after the tab was in the background
  useEffect(() => {
    if (!sessionId) return;
    const onVisible = () => { if (document.visibilityState === 'visible') scheduleRefetch(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [sessionId, scheduleRefetch]);

  /* ─────────── Rooms ─────────── */

  const resetRoomState = useCallback(() => {
    setSessionMode(null);
    setSessionId(null);
    sessionIdRef.current = null;
    setMembers([]);
    setIsOwner(false);
    commitPlaces([]);
    setCourseName('');
    setCourseDescription('');
    setSchedule(null);
    clearDirections();
    setIsRouteCreated(false);
  }, [clearDirections, commitPlaces, setIsRouteCreated]);

  useEffect(() => {
    removedFromRoomRef.current = () => {
      if (!sessionIdRef.current) return;
      resetRoomState();
      showToastMsg('코스 공유가 해제됐거나 코스가 삭제되어 대시보드로 돌아왔어요.');
    };
  }, [resetRoomState, showToastMsg]);

  /** Loads a room the user belongs to and switches to the builder. */
  const enterRoom = useCallback(async (roomId: string): Promise<boolean> => {
    const user = currentUserRef.current;
    if (!user) return false;
    try {
      const data = await apiFetch<RoomResponse>(`/api/sessions/${roomId}`);
      sessionIdRef.current = roomId;
      setSessionId(roomId);
      setSessionMode('builder');
      setMembers(data.room.members || []);
      setIsOwner(data.room.ownerId === user.id);
      setCourseName(data.courseDetails?.displayName || '');
      setCourseDescription(data.courseDetails?.description || '');
      setSchedule(data.courseDetails?.schedule ?? null);
      commitPlaces(data.coursePlaces || []);
      clearDirections();
      setIsRouteCreated(false);
      return true;
    } catch (err) {
      showToastMsg((err as Error).message || '경로를 불러오지 못했어요.');
      return false;
    }
  }, [clearDirections, commitPlaces, setIsRouteCreated, showToastMsg]);

  const createRoomAndEnter = useCallback(async (body: Record<string, unknown>) => {
    setIsEntering(true);
    try {
      const data = await apiFetch<{ room: { id: string } }>('/api/sessions', { method: 'POST', json: { expiresInDays: 30, ...body } });
      return await enterRoom(data.room.id);
    } catch (err) {
      showToastMsg((err as Error).message || '경로를 만들지 못했어요.');
      return false;
    } finally {
      setIsEntering(false);
    }
  }, [enterRoom, showToastMsg]);

  const handleCreateNewRoute = useCallback(async () => {
    if (await createRoomAndEnter({})) setActiveTab('search');
  }, [createRoomAndEnter, setActiveTab]);

  const handleLoadCourseFromDashboard = useCallback(async (course: Course) => {
    if (course.isLive && course.roomId) {
      setIsEntering(true);
      const ok = await enterRoom(course.roomId);
      setIsEntering(false);
      if (ok) setActiveTab('route');
      return;
    }
    // A saved snapshot: start a new room from a copy of it
    if (await createRoomAndEnter({ fromCourseId: course.id })) setActiveTab('route');
  }, [createRoomAndEnter, enterRoom, setActiveTab]);

  /** Redeems an invite link / code: connects with the inviter and, if it carries a course, opens it. */
  const handleRedeemInvite = useCallback(async (code: string) => {
    setIsEntering(true);
    try {
      const data = await apiFetch<InviteAcceptResponse>('/api/invites/accept', { method: 'POST', json: { code } });
      setPendingInviteCode(null);
      if (data.friend) setConnectionsVersion((v) => v + 1);
      if (data.roomId) {
        if (await enterRoom(data.roomId)) {
          setActiveTab('route');
          if (data.ownInvite) showToastMsg('내가 만든 초대 링크예요. 함께할 사람에게 보내주세요.');
          else if (data.joinedRoom) showToastMsg(data.friend ? `🎉 ${data.friend.nickname}님의 코스에 함께해요!` : '🎉 코스에 참여했어요!');
        }
      } else if (data.ownInvite) {
        showToastMsg('내가 만든 초대 링크예요. 함께할 사람에게 보내주세요.');
      } else if (data.friend) {
        showToastMsg(`🤝 ${data.friend.nickname}님과 연결됐어요! 앞으로 만드는 코스는 자동으로 함께 편집해요.`);
      }
    } catch (err) {
      setPendingInviteCode(null);
      showToastMsg((err as Error).message || '유효하지 않은 초대코드예요.');
      throw err;
    } finally {
      setIsEntering(false);
    }
  }, [enterRoom, setActiveTab, showToastMsg]);

  /** Host only: share the open course with a connected person, or take someone out of it. */
  const setMemberEnabled = useCallback(async (userId: string, enabled: boolean) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      const data = await apiFetch<{ members: RoomMember[] }>(`/api/sessions/${sid}/members`, { method: 'PUT', json: { userId, enabled } });
      setMembers(data.members);
    } catch (err) {
      showToastMsg((err as Error).message || '함께할 사람을 바꾸지 못했어요.');
    }
  }, [showToastMsg]);

  // Invite links and shared courses continue automatically once the user is signed in
  const autoActionRef = useRef(false);
  useEffect(() => {
    if (!currentUser || sessionMode !== null || autoActionRef.current) return;
    if (pendingInviteCode) {
      autoActionRef.current = true;
      const code = pendingInviteCode;
      // Started from a microtask so the effect itself doesn't set state synchronously
      Promise.resolve()
        .then(() => handleRedeemInvite(code))
        .catch(() => { /* toast shown */ })
        .finally(() => { autoActionRef.current = false; });
    } else if (pendingImport) {
      autoActionRef.current = true;
      const body = pendingImport.kind === 'share'
        ? { fromShareId: pendingImport.shareId }
        : { importCourse: { name: pendingImport.name, places: pendingImport.places } };
      Promise.resolve()
        .then(() => createRoomAndEnter(body))
        .then((ok) => {
          setPendingImport(null);
          if (ok) {
            setActiveTab('route');
            showToastMsg('공유받은 코스로 새 경로를 만들었어요!');
          }
        })
        .finally(() => { autoActionRef.current = false; });
    }
  }, [currentUser, sessionMode, pendingInviteCode, pendingImport, handleRedeemInvite, createRoomAndEnter, setActiveTab, showToastMsg]);

  const handleUpdateCourseName = useCallback(async (displayName: string, description: string) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      await apiFetch(`/api/sessions/${sid}/name`, { method: 'PATCH', json: { displayName, description } });
      setCourseName(displayName);
      setCourseDescription(description);
      showToastMsg('경로 이름이 저장되었습니다.');
    } catch (err) {
      showToastMsg((err as Error).message || '경로 이름 저장 중 오류가 발생했습니다.');
    }
  }, [showToastMsg]);

  /** Schedule changes are saved explicitly (never from an effect), so joining a room can't overwrite it. */
  const handleScheduleChange = useCallback((next: DateSchedule | null) => {
    setSchedule(next);
    const sid = sessionIdRef.current;
    if (!sid) return;
    apiFetch(`/api/sessions/${sid}/schedule`, { method: 'PUT', json: { schedule: next } })
      .catch(() => showToastMsg('일정을 저장하지 못했어요.'));
  }, [showToastMsg]);

  const handleGoToDashboard = useCallback(async () => {
    // Let queued edits finish before leaving the room
    await queueRef.current.catch(() => { /* already reported */ });
    resetRoomState();
  }, [resetRoomState]);

  const handleLogout = useCallback(async () => {
    await handleGoToDashboard();
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => { /* ignore */ });
    setCurrentUser(null);
  }, [handleGoToDashboard]);

  const handleSessionInvalidatedLogout = useCallback(() => {
    setSessionInvalidated(false);
    setCurrentUser(null);
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => { /* ignore */ });
    resetRoomState();
  }, [resetRoomState]);

  return {
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
    connectionsVersion,
    pendingInviteCode,
    pendingImport,
    sessionInvalidated,
    isConnected,
    applyPlaces,
    addPlaces,
    removePlace,
    updatePlace,
    setReaction,
    replacePlace,
    uploadPhoto,
    handleScheduleChange,
    handleCreateNewRoute,
    handleUpdateCourseName,
    handleLoadCourseFromDashboard,
    handleRedeemInvite,
    setMemberEnabled,
    handleGoToDashboard,
    handleLogout,
    handleSessionInvalidatedLogout,
  };
}

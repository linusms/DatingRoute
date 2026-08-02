'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { Session, SessionMode, SessionMember, CoursePlace } from './types';

/* ─────────── Context Shape ─────────── */

interface SessionState {
  mode: SessionMode;
  sessionId: string | null;
  inviteCode: string | null;
  nickname: string;
  memberId: string | null;
  members: SessionMember[];
  isOwner: boolean;
  isConnected: boolean;
}

interface SessionActions {
  createSession: (ownerName: string, isPersonal: boolean) => Promise<Session>;
  joinSession: (inviteCode: string, nickname: string) => Promise<Session>;
  setDevMode: () => void;
  disconnect: () => void;
  refreshSession: () => Promise<void>;
}

interface SessionContextValue {
  state: SessionState;
  actions: SessionActions;
}

const defaultState: SessionState = {
  mode: 'dev',
  sessionId: null,
  inviteCode: null,
  nickname: '',
  memberId: null,
  members: [],
  isOwner: false,
  isConnected: false,
};

const SessionContext = createContext<SessionContextValue | null>(null);

/* ─────────── Session persistence ─────────── */

const SESSION_STORAGE_KEY = 'datingroute_session';

interface PersistedSession {
  mode: SessionMode;
  sessionId: string;
  inviteCode: string;
  nickname: string;
  memberId: string;
  isOwner: boolean;
}

function persistSession(data: PersistedSession): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

function loadPersistedSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearPersistedSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch { /* ignore */ }
}

/* ─────────── Provider ─────────── */

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>(defaultState);
  const initializedRef = useRef(false);

  // Try to restore session on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const persisted = loadPersistedSession();
    if (persisted && persisted.mode !== 'dev') {
      // Validate session still exists
      fetch(`/api/sessions/${persisted.sessionId}`)
        .then((res) => {
          if (!res.ok) throw new Error('Session expired');
          return res.json();
        })
        .then((data) => {
          setState({
            mode: persisted.mode,
            sessionId: persisted.sessionId,
            inviteCode: persisted.inviteCode,
            nickname: persisted.nickname,
            memberId: persisted.memberId,
            members: data.session.members || [],
            isOwner: persisted.isOwner,
            isConnected: false,
          });
        })
        .catch(() => {
          clearPersistedSession();
          // Session expired — stay at mode selection
        });
    }
  }, []);

  const handleCreateSession = useCallback(
    async (ownerName: string, isPersonal: boolean): Promise<Session> => {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerName, isPersonal }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '세션 생성 실패');
      }

      const data = await res.json();
      const session: Session = data.session;
      const memberId: string = data.memberId;

      const mode: SessionMode = isPersonal ? 'personal' : 'invite';

      setState({
        mode,
        sessionId: session.id,
        inviteCode: session.inviteCode,
        nickname: ownerName,
        memberId,
        members: session.members,
        isOwner: true,
        isConnected: false,
      });

      persistSession({
        mode,
        sessionId: session.id,
        inviteCode: session.inviteCode,
        nickname: ownerName,
        memberId,
        isOwner: true,
      });

      return session;
    },
    []
  );

  const handleJoinSession = useCallback(
    async (inviteCode: string, nickname: string): Promise<Session> => {
      const res = await fetch('/api/sessions/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode, nickname }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '세션 참여 실패');
      }

      const data = await res.json();
      const session: Session = data.session;
      const memberId: string = data.memberId;

      setState({
        mode: 'invite',
        sessionId: session.id,
        inviteCode: session.inviteCode,
        nickname,
        memberId,
        members: session.members,
        isOwner: false,
        isConnected: false,
      });

      persistSession({
        mode: 'invite',
        sessionId: session.id,
        inviteCode: session.inviteCode,
        nickname,
        memberId,
        isOwner: false,
      });

      return session;
    },
    []
  );

  const setDevMode = useCallback(() => {
    setState({
      ...defaultState,
      mode: 'dev',
    });
    clearPersistedSession();
  }, []);

  const disconnect = useCallback(() => {
    setState(defaultState);
    clearPersistedSession();
  }, []);

  const refreshSession = useCallback(async () => {
    if (!state.sessionId) return;
    try {
      const res = await fetch(`/api/sessions/${state.sessionId}`);
      if (!res.ok) return;
      const data = await res.json();
      setState((prev) => ({
        ...prev,
        members: data.session.members || prev.members,
      }));
    } catch { /* ignore */ }
  }, [state.sessionId]);

  const actions: SessionActions = {
    createSession: handleCreateSession,
    joinSession: handleJoinSession,
    setDevMode,
    disconnect,
    refreshSession,
  };

  return (
    <SessionContext.Provider value={{ state, actions }}>
      {children}
    </SessionContext.Provider>
  );
}

/* ─────────── Hook ─────────── */

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return ctx;
}

/* ─────────── Helper: update members from SSE ─────────── */

export function useSessionMemberUpdate() {
  const { state } = useSession();
  const [, setTick] = useState(0);

  const updateMembers = useCallback((members: SessionMember[]) => {
    // Force re-render with updated members
    // In a real app, this would be done via context setter
    setTick((t) => t + 1);
    void members; // consumed by SSE handler
  }, []);

  return { state, updateMembers };
}

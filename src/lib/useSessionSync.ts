'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { ROOM_EVENT, type CourseUpdatedData, type MemberRemovedData, type PlacesChangedData, type RoomMember } from './types';
import { supabase } from './supabaseClient';
import { CLIENT_ID } from './api';

export interface RemoteEventMeta {
  sender: string;   // nickname
  senderId: string;
}

interface UseSessionSyncOptions {
  sessionId: string | null;
  enabled: boolean;
  /** Presence identity; tracked so other members can see who is online */
  me: { userId: string; nickname: string } | null;
  onPlacesChanged?: (data: PlacesChangedData, meta: RemoteEventMeta) => void;
  onCourseUpdated?: (data: CourseUpdatedData, meta: RemoteEventMeta) => void;
  onMemberJoined?: (member: RoomMember) => void;
  onMemberRemoved?: (data: MemberRemovedData) => void;
  /** Called on every (re)subscribe; use it to refetch anything missed while disconnected */
  onConnected?: () => void;
}

interface BroadcastPayload {
  type?: string;
  data?: unknown;
  sender?: string;
  senderId?: string;
  clientId?: string | null;
}

/**
 * Subscribes to the room's Supabase Realtime channel `session-<roomId>`:
 * broadcast events from the server (see broadcastRoomEvent in db.ts) and presence for online members.
 */
export function useSessionSync({
  sessionId,
  enabled,
  me,
  onPlacesChanged,
  onCourseUpdated,
  onMemberJoined,
  onMemberRemoved,
  onConnected,
}: UseSessionSyncOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  const callbacksRef = useRef({ onPlacesChanged, onCourseUpdated, onMemberJoined, onMemberRemoved, onConnected });
  useEffect(() => {
    callbacksRef.current = { onPlacesChanged, onCourseUpdated, onMemberJoined, onMemberRemoved, onConnected };
  });

  const userId = me?.userId ?? null;
  const nickname = me?.nickname ?? '';

  useEffect(() => {
    if (!sessionId || !enabled) return;

    const channel: RealtimeChannel = supabase.channel(`session-${sessionId}`, {
      config: { presence: { key: userId || CLIENT_ID } },
    });

    channel
      .on('broadcast', { event: ROOM_EVENT }, ({ payload }) => {
        const { type, data, sender, senderId, clientId } = (payload ?? {}) as BroadcastPayload;
        if (!type || clientId === CLIENT_ID) return;
        const meta: RemoteEventMeta = { sender: sender || '', senderId: senderId || '' };
        const cbs = callbacksRef.current;
        switch (type) {
          case 'places_changed':
            cbs.onPlacesChanged?.((data ?? {}) as PlacesChangedData, meta);
            break;
          case 'course_updated':
            cbs.onCourseUpdated?.((data ?? {}) as CourseUpdatedData, meta);
            break;
          case 'member_joined': {
            const member = (data as { member?: RoomMember } | undefined)?.member;
            if (member) cbs.onMemberJoined?.(member);
            break;
          }
          case 'member_removed': {
            const removed = data as MemberRemovedData | undefined;
            if (removed?.userId) cbs.onMemberRemoved?.(removed);
            break;
          }
        }
      })
      .on('presence', { event: 'sync' }, () => {
        setOnlineUserIds(Object.keys(channel.presenceState()));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          if (userId) channel.track({ userId, nickname }).catch(() => { /* presence is best-effort */ });
          callbacksRef.current.onConnected?.();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      setIsConnected(false);
      setOnlineUserIds([]);
    };
  }, [sessionId, enabled, userId, nickname]);

  return { isConnected, onlineUserIds };
}

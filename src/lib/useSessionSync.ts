'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { CoursePlace, RoomMember } from './types';
import { supabase } from './supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseSessionSyncOptions {
  sessionId: string | null;
  enabled: boolean;
  onPlaceAdded?: (place: CoursePlace, allPlaces: CoursePlace[]) => void;
  onPlaceRemoved?: (placeId: string, allPlaces: CoursePlace[]) => void;
  onPlacesReordered?: (allPlaces: CoursePlace[]) => void;
  onCourseSaved?: (course: any) => void;
  onCourseDeleted?: (courseId: string) => void;
  onMemberJoined?: (member: RoomMember) => void;
  onConnected?: (data: any) => void;
}

export function useSessionSync({
  sessionId,
  enabled,
  onPlaceAdded,
  onPlaceRemoved,
  onPlacesReordered,
  onCourseSaved,
  onCourseDeleted,
  onMemberJoined,
  onConnected,
}: UseSessionSyncOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const callbacksRef = useRef({
    onPlaceAdded,
    onPlaceRemoved,
    onPlacesReordered,
    onCourseSaved,
    onCourseDeleted,
    onMemberJoined,
    onConnected,
  });
  
  callbacksRef.current = {
    onPlaceAdded,
    onPlaceRemoved,
    onPlacesReordered,
    onCourseSaved,
    onCourseDeleted,
    onMemberJoined,
    onConnected,
  };

  const connect = useCallback(() => {
    if (!sessionId || !enabled) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase.channel(`session-${sessionId}`);
    channelRef.current = channel;

    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events', filter: `room_id=eq.${sessionId}` },
        (payload) => {
          const { type, data } = payload.new;
          const cbs = callbacksRef.current;

          switch (type) {
            case 'place_added':
              cbs.onPlaceAdded?.(data.place, data.allPlaces);
              break;
            case 'place_removed':
              cbs.onPlaceRemoved?.(data.placeId, data.allPlaces);
              break;
            case 'places_reordered':
              cbs.onPlacesReordered?.(data.allPlaces);
              break;
            case 'course_saved':
              cbs.onCourseSaved?.(data.course);
              break;
            case 'course_deleted':
              cbs.onCourseDeleted?.(data.courseId);
              break;
            case 'member_joined':
              cbs.onMemberJoined?.(data.member);
              break;
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          callbacksRef.current.onConnected?.(null);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false);
        }
      });
  }, [sessionId, enabled]);

  useEffect(() => {
    if (sessionId && enabled) {
      connect();
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
    };
  }, [sessionId, enabled, connect]);

  return { isConnected };
}

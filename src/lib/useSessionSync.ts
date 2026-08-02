'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { CoursePlace, SSEEvent, SessionMember } from './types';

interface UseSessionSyncOptions {
  sessionId: string | null;
  enabled: boolean;
  onPlaceAdded?: (place: CoursePlace, allPlaces: CoursePlace[]) => void;
  onPlaceRemoved?: (placeId: string, allPlaces: CoursePlace[]) => void;
  onPlacesReordered?: (allPlaces: CoursePlace[]) => void;
  onCourseSaved?: (course: any) => void;
  onCourseDeleted?: (courseId: string) => void;
  onMemberJoined?: (member: SessionMember) => void;
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
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Store latest callbacks in refs to avoid reconnection on callback changes
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

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/sessions/${sessionId}/events`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const parsed: SSEEvent = JSON.parse(event.data);
        const cbs = callbacksRef.current;

        switch (parsed.type) {
          case 'connected':
            setIsConnected(true);
            cbs.onConnected?.(parsed.data);
            break;

          case 'place_added':
            cbs.onPlaceAdded?.(
              (parsed.data as any).place,
              (parsed.data as any).allPlaces
            );
            break;

          case 'place_removed':
            cbs.onPlaceRemoved?.(
              (parsed.data as any).placeId,
              (parsed.data as any).allPlaces
            );
            break;

          case 'places_reordered':
            cbs.onPlacesReordered?.((parsed.data as any).allPlaces);
            break;

          case 'course_saved':
            cbs.onCourseSaved?.((parsed.data as any).course);
            break;

          case 'course_deleted':
            cbs.onCourseDeleted?.((parsed.data as any).courseId);
            break;

          case 'member_joined':
            cbs.onMemberJoined?.((parsed.data as any).member);
            break;
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      es.close();
      eventSourceRef.current = null;

      // Auto-reconnect after 3 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };
  }, [sessionId, enabled]);

  // Connect/disconnect based on sessionId and enabled
  useEffect(() => {
    if (sessionId && enabled) {
      connect();
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      setIsConnected(false);
    };
  }, [sessionId, enabled, connect]);

  return { isConnected };
}

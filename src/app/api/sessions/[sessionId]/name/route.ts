import { NextRequest, NextResponse } from 'next/server';
import { broadcastRoomEvent, updateLiveCourseName } from '@/lib/db';
import { eventSender, requireRoomMember } from '@/lib/session';
import type { CourseUpdatedData } from '@/lib/types';

type RouteContext = { params: Promise<{ sessionId: string }> };

/** PATCH /api/sessions/[sessionId]/name - Update live course display name (shared by all collaborators) */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const auth = await requireRoomMember(request, sessionId);
    if (!auth.ok) return auth.response;

    const { displayName, description } = await request.json();
    if (typeof displayName !== 'string') {
      return NextResponse.json({ error: '이름이 필요합니다.' }, { status: 400 });
    }

    const data: CourseUpdatedData = {
      displayName: displayName.trim().slice(0, 100),
      description: typeof description === 'string' ? description.trim().slice(0, 500) : '',
    };
    const success = await updateLiveCourseName(sessionId, data.displayName!, data.description!);
    if (!success) {
      return NextResponse.json({ error: '이름 업데이트 실패' }, { status: 500 });
    }

    await broadcastRoomEvent(sessionId, 'course_updated', data, eventSender(request, auth.user));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Session name update error:', error);
    return NextResponse.json({ error: '이름 업데이트 실패' }, { status: 500 });
  }
}

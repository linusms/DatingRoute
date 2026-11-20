export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { broadcastRoomEvent, getLiveCourseDetails, saveLiveSchedule } from '@/lib/db';
import { eventSender, requireRoomMember } from '@/lib/session';
import type { CourseUpdatedData } from '@/lib/types';

type RouteContext = { params: Promise<{ sessionId: string }> };

/** GET /api/sessions/[sessionId]/schedule - load schedule */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const auth = await requireRoomMember(request, sessionId);
    if (!auth.ok) return auth.response;
    const details = await getLiveCourseDetails(sessionId);
    return NextResponse.json({ schedule: details?.schedule ?? null });
  } catch (error) {
    console.error('Schedule load error:', error);
    return NextResponse.json({ error: '스케줄 로드 실패' }, { status: 500 });
  }
}

/** PUT /api/sessions/[sessionId]/schedule - save schedule (null clears it) and notify other members */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const auth = await requireRoomMember(request, sessionId);
    if (!auth.ok) return auth.response;
    const { schedule } = await request.json();
    const saved = await saveLiveSchedule(sessionId, schedule);
    const data: CourseUpdatedData = { schedule: saved };
    await broadcastRoomEvent(sessionId, 'course_updated', data, eventSender(request, auth.user));
    return NextResponse.json({ ok: true, schedule: saved });
  } catch (error) {
    console.error('Schedule save error:', error);
    return NextResponse.json({ error: '스케줄 저장 실패' }, { status: 500 });
  }
}

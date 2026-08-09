export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { saveLiveSchedule, getLiveCourseDetails } from '@/lib/db';

type RouteContext = { params: Promise<{ sessionId: string }> };

/** GET /api/sessions/[sessionId]/schedule - load schedule */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const details = await getLiveCourseDetails(sessionId);
    return NextResponse.json({ schedule: details?.schedule ?? null });
  } catch (error: any) {
    console.error('Schedule load error:', error);
    return NextResponse.json({ error: '스케줄 로드 실패' }, { status: 500 });
  }
}

/** PUT /api/sessions/[sessionId]/schedule - save schedule */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const { schedule } = await request.json();
    await saveLiveSchedule(sessionId, schedule);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Schedule save error:', error);
    return NextResponse.json({ error: '스케줄 저장 실패' }, { status: 500 });
  }
}

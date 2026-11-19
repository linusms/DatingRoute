export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { saveLiveAiHistory, getLiveCourseDetails } from '@/lib/db';
import { requireRoomMember } from '@/lib/session';

type RouteContext = { params: Promise<{ sessionId: string }> };

/** GET /api/sessions/[sessionId]/ai-history - load AI recommendation history */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const auth = await requireRoomMember(request, sessionId);
    if (!auth.ok) return auth.response;
    const details = await getLiveCourseDetails(sessionId);
    return NextResponse.json({ aiHistory: details?.aiHistory ?? null });
  } catch (error: any) {
    console.error('AI history load error:', error);
    return NextResponse.json({ error: 'AI 히스토리 로드 실패' }, { status: 500 });
  }
}

/** PUT /api/sessions/[sessionId]/ai-history - save AI recommendation history */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const auth = await requireRoomMember(request, sessionId);
    if (!auth.ok) return auth.response;
    const { aiHistory } = await request.json();
    await saveLiveAiHistory(sessionId, aiHistory);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('AI history save error:', error);
    return NextResponse.json({ error: 'AI 히스토리 저장 실패' }, { status: 500 });
  }
}

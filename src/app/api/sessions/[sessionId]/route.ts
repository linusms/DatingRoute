export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionById, deleteSession, getLivePlaces } from '@/lib/db';

type RouteContext = { params: Promise<{ sessionId: string }> };

// GET /api/sessions/[sessionId] — Get session detail with live places
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { sessionId } = await context.params;
    const session = await getSessionById(sessionId);

    if (!session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
    }

    const livePlaces = await getLivePlaces(sessionId);

    return NextResponse.json({ session, livePlaces });
  } catch (error: any) {
    console.error('Session detail error:', error);
    return NextResponse.json({ error: '세션 조회 실패' }, { status: 500 });
  }
}

// DELETE /api/sessions/[sessionId] — Delete session
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { sessionId } = await context.params;
    await deleteSession(sessionId);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Session delete error:', error);
    return NextResponse.json({ error: '세션 삭제 실패' }, { status: 500 });
  }
}

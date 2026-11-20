import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateShareId } from '@/lib/db';
import { requireRoomMember } from '@/lib/session';

type RouteContext = { params: Promise<{ sessionId: string }> };

/** POST /api/sessions/[sessionId]/share - get (or create) the read-only share link id for this course */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const auth = await requireRoomMember(request, sessionId);
    if (!auth.ok) return auth.response;
    const shareId = await getOrCreateShareId(sessionId);
    return NextResponse.json({ shareId, path: `/s/${shareId}` });
  } catch (error) {
    console.error('Share link error:', error);
    return NextResponse.json({ error: '공유 링크 생성 실패' }, { status: 500 });
  }
}

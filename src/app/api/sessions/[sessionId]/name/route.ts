import { NextRequest, NextResponse } from 'next/server';
import { updateLiveCourseName } from '@/lib/db';

type RouteContext = { params: Promise<{ sessionId: string }> };

/** PATCH /api/sessions/[sessionId]/name - Update live course display name (shared by all collaborators) */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID가 필요합니다.' }, { status: 400 });
    }

    const body = await request.json();
    const { displayName, description } = body;

    if (typeof displayName !== 'string') {
      return NextResponse.json({ error: '이름이 필요합니다.' }, { status: 400 });
    }

    const success = await updateLiveCourseName(sessionId, displayName.trim(), description?.trim() || '');
    if (!success) {
      return NextResponse.json({ error: '이름 업데이트 실패' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Session name update error:', error);
    return NextResponse.json({ error: '이름 업데이트 실패' }, { status: 500 });
  }
}

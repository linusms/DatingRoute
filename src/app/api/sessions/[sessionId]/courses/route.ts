export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { saveCourseForUser, broadcastSSE } from '@/lib/db';

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const { name, description, userId, nickname } = await request.json();

    if (!name || !name.trim() || !userId) {
      return NextResponse.json({ error: '이름과 userId가 필요합니다.' }, { status: 400 });
    }

    // Save to the personal account
    const course = await saveCourseForUser(
      userId,
      sessionId,
      name.trim(),
      description?.trim() || ''
    );

    // Broadcast that a course was saved by someone (optional, just for UI toast)
    await broadcastSSE(sessionId, 'course_saved', { course, savedBy: nickname }, nickname);

    return NextResponse.json({ course }, { status: 201 });
  } catch (error: any) {
    console.error('Course save error:', error);
    return NextResponse.json({ error: '코스 저장 실패' }, { status: 500 });
  }
}

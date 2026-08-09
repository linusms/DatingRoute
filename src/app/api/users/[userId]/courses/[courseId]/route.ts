import { NextRequest, NextResponse } from 'next/server';
import { updateCourse } from '@/lib/db';

type RouteContext = { params: Promise<{ userId: string; courseId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId, courseId } = await context.params;

    if (!userId || !courseId) {
      return NextResponse.json({ error: '유저 ID와 코스 ID가 필요합니다.' }, { status: 400 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: '코스 이름이 필요합니다.' }, { status: 400 });
    }

    const success = await updateCourse(courseId, userId, name.trim(), description?.trim() || '');

    if (!success) {
      return NextResponse.json({ error: '코스 업데이트 실패 (권한 없음 또는 존재하지 않는 코스)' }, { status: 403 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    console.error('Course update error:', error);
    return NextResponse.json({ error: '코스 업데이트 실패' }, { status: 500 });
  }
}

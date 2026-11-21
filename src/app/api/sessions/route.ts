import { NextRequest, NextResponse } from 'next/server';
import { createRoom, getOwnedSavedCourse, getSharedCourse } from '@/lib/db';
import { requireUser } from '@/lib/session';
import type { CoursePlace } from '@/lib/types';

/**
 * POST /api/sessions - create a room (with its live course).
 * Optional sources fill the new course:
 *   { fromCourseId }  a saved course the user owns
 *   { fromShareId }   a public share link ("이 코스로 시작하기")
 *   { importCourse: { name, places } }  a legacy ?shared= link decoded in the browser
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const expiresInDays = Math.min(365, Math.max(1, Number(body.expiresInDays) || 30));

    let content = {};
    if (typeof body.fromCourseId === 'string') {
      const saved = await getOwnedSavedCourse(auth.user.id, body.fromCourseId);
      if (!saved) return NextResponse.json({ error: '코스를 찾을 수 없습니다.' }, { status: 404 });
      content = saved;
    } else if (typeof body.fromShareId === 'string') {
      const shared = await getSharedCourse(body.fromShareId);
      if (!shared) return NextResponse.json({ error: '공유 링크가 만료되었거나 잘못되었습니다.' }, { status: 404 });
      content = {
        displayName: shared.name,
        description: shared.description,
        schedule: shared.schedule,
        places: shared.places,
      };
    } else if (body.importCourse && Array.isArray(body.importCourse.places)) {
      content = {
        displayName: typeof body.importCourse.name === 'string' ? body.importCourse.name : '',
        places: (body.importCourse.places as Partial<CoursePlace>[]).slice(0, 100),
      };
    }

    const result = await createRoom(auth.user.id, expiresInDays, content);
    return NextResponse.json({ room: result.room, inviteCode: result.inviteCode }, { status: 201 });
  } catch (error) {
    console.error('Room create error:', error);
    return NextResponse.json({ error: '방 생성 실패' }, { status: 500 });
  }
}

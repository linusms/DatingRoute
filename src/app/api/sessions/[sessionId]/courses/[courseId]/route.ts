import { NextRequest, NextResponse } from 'next/server';
import {
  getCourseById as getCourse,
  updateCourse,
  deleteCourseDb,
  broadcastSSE,
} from '@/lib/db';

type RouteContext = { params: Promise<{ sessionId: string; courseId: string }> };

// GET /api/sessions/[sessionId]/courses/[courseId]
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { courseId } = await context.params;
    const course = getCourse(courseId);

    if (!course) {
      return NextResponse.json({ error: '코스를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ course });
  } catch (error: any) {
    console.error('Course detail error:', error);
    return NextResponse.json({ error: '코스 조회 실패' }, { status: 500 });
  }
}

// PUT /api/sessions/[sessionId]/courses/[courseId] — Update course
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { sessionId, courseId } = await context.params;
    const body = await request.json();
    const { name, description, places, addedBy } = body;

    const updated = updateCourse(courseId, { name, description, places }, addedBy || '');

    if (!updated) {
      return NextResponse.json({ error: '코스를 찾을 수 없습니다.' }, { status: 404 });
    }

    broadcastSSE(sessionId, 'course_saved', { course: updated }, addedBy || '');

    return NextResponse.json({ course: updated });
  } catch (error: any) {
    console.error('Course update error:', error);
    return NextResponse.json({ error: '코스 수정 실패' }, { status: 500 });
  }
}

// DELETE /api/sessions/[sessionId]/courses/[courseId]
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { sessionId, courseId } = await context.params;
    deleteCourseDb(courseId);
    broadcastSSE(sessionId, 'course_deleted', { courseId }, '');
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Course delete error:', error);
    return NextResponse.json({ error: '코스 삭제 실패' }, { status: 500 });
  }
}

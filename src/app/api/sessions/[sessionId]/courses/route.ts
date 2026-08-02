export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createCourse, getCoursesBySession, broadcastSSE } from '@/lib/db';

type RouteContext = { params: Promise<{ sessionId: string }> };

// GET /api/sessions/[sessionId]/courses — List courses for a session
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { sessionId } = await context.params;
    const courses = await getCoursesBySession(sessionId);
    // Filter out the __live__ course from the list
    const savedCourses = courses.filter((c) => c.name !== '__live__');
    return NextResponse.json({ courses: savedCourses });
  } catch (error: any) {
    console.error('Courses list error:', error);
    return NextResponse.json({ error: '코스 목록 조회 실패' }, { status: 500 });
  }
}

// POST /api/sessions/[sessionId]/courses — Save a new course
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { sessionId } = await context.params;
    const body = await request.json();
    const { name, description, places, addedBy } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: '코스 이름을 입력해주세요.' }, { status: 400 });
    }

    const course = await createCourse(
      sessionId,
      name.trim(),
      description?.trim() || '',
      places || [],
      addedBy || ''
    );

    await broadcastSSE(sessionId, 'course_saved', { course }, addedBy || '');



    return NextResponse.json({ course }, { status: 201 });
  } catch (error: any) {
    console.error('Course create error:', error);
    return NextResponse.json({ error: '코스 저장 실패' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getRoomById, getLivePlaces, getLiveCourseDetails } from '@/lib/db';
import { requireRoomMember } from '@/lib/session';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const auth = await requireRoomMember(request, sessionId);
    if (!auth.ok) return auth.response;

    const room = await getRoomById(sessionId);
    if (!room) {
      return NextResponse.json({ error: '방을 찾을 수 없습니다.' }, { status: 404 });
    }

    const [coursePlaces, courseDetails] = await Promise.all([
      getLivePlaces(sessionId),
      getLiveCourseDetails(sessionId),
    ]);

    return NextResponse.json({ room, coursePlaces, courseDetails });
  } catch (error) {
    console.error('Room fetch error:', error);
    return NextResponse.json({ error: '서버 에러' }, { status: 500 });
  }
}

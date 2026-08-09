export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getRoomById, getLivePlaces, getLiveCourseDetails } from '@/lib/db';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const room = await getRoomById(sessionId);

    if (!room) {
      return NextResponse.json({ error: '방을 찾을 수 없습니다.' }, { status: 404 });
    }
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if(!userId) {
      return NextResponse.json({ error: 'userId 쿼리가 필요합니다.' }, { status: 400 });
    }

    const livePlaces = await getLivePlaces(sessionId, userId);
    const courseDetails = await getLiveCourseDetails(sessionId);

    return NextResponse.json({ 
      room, 
      coursePlaces: livePlaces,
      courseDetails
    });
  } catch (error: any) {
    console.error('Room fetch error:', error);
    return NextResponse.json({ error: '서버 에러' }, { status: 500 });
  }
}

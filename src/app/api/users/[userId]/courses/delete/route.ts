export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { broadcastRoomEvent, deleteCourse } from '@/lib/db';
import { eventSender, requireSelf } from '@/lib/session';
import type { MemberRemovedData } from '@/lib/types';

type RouteContext = { params: Promise<{ userId: string }> };

/** DELETE ?id=<courseId> - delete a course (or leave a course someone else created) */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const auth = await requireSelf(request, userId);
    if (!auth.ok) return auth.response;
    const courseId = request.nextUrl.searchParams.get('id');
    if (!courseId) {
      return NextResponse.json({ error: '코스 ID가 필요합니다.' }, { status: 400 });
    }

    const result = await deleteCourse(courseId, userId);
    if (result && result.removedUserIds.length > 0) {
      // The course was deleted by its creator: send everyone who still has it open back to the dashboard
      const sender = eventSender(request, auth.user);
      await Promise.all(result.removedUserIds.map((id) => {
        const data: MemberRemovedData = { userId: id };
        return broadcastRoomEvent(result.roomId, 'member_removed', data, sender);
      }));
    }
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Course delete error:', error);
    return NextResponse.json({ error: '코스 삭제 실패' }, { status: 500 });
  }
}

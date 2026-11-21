import { NextRequest, NextResponse } from 'next/server';
import { broadcastRoomEvent, disconnectUsers, getUserById, isUuid, setConnectionAutoShare } from '@/lib/db';
import { eventSender, requireUser } from '@/lib/session';
import type { MemberRemovedData } from '@/lib/types';

type RouteContext = { params: Promise<{ friendId: string }> };

/** PATCH { autoShare } - whether new courses include this person automatically */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { friendId } = await context.params;
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    if (!isUuid(friendId)) return NextResponse.json({ error: '잘못된 요청이에요.' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    if (typeof body.autoShare !== 'boolean') {
      return NextResponse.json({ error: 'autoShare 값이 필요해요.' }, { status: 400 });
    }
    const ok = await setConnectionAutoShare(auth.user.id, friendId, body.autoShare);
    if (!ok) return NextResponse.json({ error: '연결된 사람이 아니에요.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Connection update error:', error);
    return NextResponse.json({ error: '설정을 저장하지 못했어요.' }, { status: 500 });
  }
}

/** DELETE - disconnect; the other person also leaves every course the user created */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { friendId } = await context.params;
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    if (!isUuid(friendId)) return NextResponse.json({ error: '잘못된 요청이에요.' }, { status: 400 });

    const friend = await getUserById(friendId);
    const roomIds = await disconnectUsers(auth.user.id, friendId);
    const data: MemberRemovedData = { userId: friendId, nickname: friend?.nickname };
    const sender = eventSender(request, auth.user);
    await Promise.all(roomIds.map((roomId) => broadcastRoomEvent(roomId, 'member_removed', data, sender)));
    return NextResponse.json({ success: true, removedFromCourses: roomIds.length });
  } catch (error) {
    console.error('Disconnect error:', error);
    return NextResponse.json({ error: '연결을 끊지 못했어요.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { broadcastRoomEvent, getRoomById, getRoomByInviteCode, joinRoom } from '@/lib/db';
import { eventSender, requireUser } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const user = auth.user;

    const { inviteCode } = await request.json();
    if (typeof inviteCode !== 'string' || !inviteCode.trim()) {
      return NextResponse.json({ error: '초대 코드가 필요합니다.' }, { status: 400 });
    }

    const found = await getRoomByInviteCode(inviteCode.trim().toUpperCase());
    if (!found) {
      return NextResponse.json({ error: '유효하지 않은 초대 코드입니다.' }, { status: 404 });
    }
    if (found.expiresAt && Date.parse(found.expiresAt) < Date.now()) {
      return NextResponse.json({ error: '만료된 초대 코드입니다.' }, { status: 410 });
    }

    const joined = await joinRoom(found.id, user.id);
    const room = (await getRoomById(found.id)) ?? found;

    if (joined) {
      const member = room.members?.find((m) => m.userId === user.id) ?? {
        id: user.id,
        roomId: room.id,
        userId: user.id,
        joinedAt: new Date().toISOString(),
        isOwner: false,
        nickname: user.nickname,
      };
      await broadcastRoomEvent(room.id, 'member_joined', { member }, eventSender(request, user));
    }

    return NextResponse.json({ room }, { status: 200 });
  } catch (error) {
    console.error('Room join error:', error);
    return NextResponse.json({ error: '방 입장 실패' }, { status: 500 });
  }
}

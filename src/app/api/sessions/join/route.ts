import { NextRequest, NextResponse } from 'next/server';
import { getRoomByInviteCode, joinRoom, getUserById, broadcastSSE } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { inviteCode, userId } = await request.json();

    if (!inviteCode || !userId) {
      return NextResponse.json({ error: '초대 코드와 유저 ID가 필요합니다.' }, { status: 400 });
    }

    const room = await getRoomByInviteCode(inviteCode.trim().toUpperCase());
    if (!room) {
      return NextResponse.json({ error: '유효하지 않은 초대 코드입니다.' }, { status: 404 });
    }

    await joinRoom(room.id, userId);

    // Broadcast member joined
    const user = await getUserById(userId);
    if (user) {
      const newMember = {
        id: Math.random().toString(36).substr(2, 9),
        roomId: room.id,
        userId: user.id,
        joinedAt: new Date().toISOString(),
        isOwner: false,
        nickname: user.nickname
      };
      await broadcastSSE(room.id, 'member_joined', { member: newMember }, userId);
      
      if (!room.members) room.members = [];
      if (!room.members.find((m: any) => m.userId === userId)) {
        room.members.push(newMember);
      }
    }

    return NextResponse.json({ room }, { status: 200 });
  } catch (error: any) {
    console.error('Room join error:', error);
    return NextResponse.json({ error: '방 입장 실패' }, { status: 500 });
  }
}

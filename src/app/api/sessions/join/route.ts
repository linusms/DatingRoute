import { NextRequest, NextResponse } from 'next/server';
import { getRoomByInviteCode, joinRoom } from '@/lib/db';

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

    return NextResponse.json({ room }, { status: 200 });
  } catch (error: any) {
    console.error('Room join error:', error);
    return NextResponse.json({ error: '방 입장 실패' }, { status: 500 });
  }
}

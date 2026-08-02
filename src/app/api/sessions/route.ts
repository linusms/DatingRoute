import { NextRequest, NextResponse } from 'next/server';
import { createRoom } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { ownerId, expiresInDays } = await request.json();

    if (!ownerId) {
      return NextResponse.json({ error: 'ownerId가 필요합니다.' }, { status: 400 });
    }

    const result = await createRoom(ownerId, expiresInDays ?? 30);

    return NextResponse.json({
      room: result.room,
      inviteCode: result.inviteCode,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Room create error:', error);
    return NextResponse.json({ error: '방 생성 실패' }, { status: 500 });
  }
}

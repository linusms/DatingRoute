import { NextRequest, NextResponse } from 'next/server';
import { createRoom } from '@/lib/db';
import { requireUser } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const { expiresInDays } = await request.json();
    const result = await createRoom(auth.user.id, expiresInDays ?? 30);

    return NextResponse.json({
      room: result.room,
      inviteCode: result.inviteCode,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Room create error:', error);
    return NextResponse.json({ error: '방 생성 실패' }, { status: 500 });
  }
}

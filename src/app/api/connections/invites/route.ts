import { NextRequest, NextResponse } from 'next/server';
import { createConnectionInvite, getRoomById } from '@/lib/db';
import { requireUser } from '@/lib/session';

/**
 * POST /api/connections/invites { roomId? } - a one-time invite link (7 days).
 * With roomId (only the course's host), accepting it also joins that course.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    let roomId: string | null = null;
    if (typeof body.roomId === 'string' && body.roomId) {
      const room = await getRoomById(body.roomId);
      if (!room) return NextResponse.json({ error: '코스를 찾을 수 없어요.' }, { status: 404 });
      if (room.ownerId !== auth.user.id) {
        return NextResponse.json({ error: '코스를 만든 사람만 초대할 수 있어요.' }, { status: 403 });
      }
      roomId = room.id;
    }

    const invite = await createConnectionInvite(auth.user.id, roomId);
    return NextResponse.json({ code: invite.code, expiresAt: invite.expiresAt, path: `/?invite=${invite.code}` }, { status: 201 });
  } catch (error) {
    console.error('Invite create error:', error);
    return NextResponse.json({ error: '초대 링크를 만들지 못했어요.' }, { status: 500 });
  }
}

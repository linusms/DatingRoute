import { NextRequest, NextResponse } from 'next/server';
import { acceptInvite, broadcastRoomEvent, getRoomById } from '@/lib/db';
import { eventSender, requireUser } from '@/lib/session';

/**
 * POST /api/invites/accept { code } - redeem a 6-character code from an invite link or the
 * dashboard: a one-time connection invite, or an old per-course invite code.
 * Returns { friend, roomId, joinedRoom, ownInvite }.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      return NextResponse.json({ error: '초대코드 6자리를 입력해주세요.' }, { status: 400 });
    }

    const result = await acceptInvite(code, auth.user.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    if (result.joinedRoom && result.roomId) {
      const room = await getRoomById(result.roomId);
      const member = room?.members?.find((m) => m.userId === auth.user.id);
      if (member) await broadcastRoomEvent(result.roomId, 'member_joined', { member }, eventSender(request, auth.user));
    }

    return NextResponse.json({
      friend: result.friend,
      roomId: result.roomId,
      joinedRoom: result.joinedRoom,
      ownInvite: result.ownInvite,
    });
  } catch (error) {
    console.error('Invite accept error:', error);
    return NextResponse.json({ error: '초대를 수락하지 못했어요.' }, { status: 500 });
  }
}

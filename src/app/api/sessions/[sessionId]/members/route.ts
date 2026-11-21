import { NextRequest, NextResponse } from 'next/server';
import { areConnected, broadcastRoomEvent, getRoomById, isUuid, joinRoom, removeRoomMember } from '@/lib/db';
import { eventSender, requireUser } from '@/lib/session';
import type { MemberRemovedData } from '@/lib/types';

type RouteContext = { params: Promise<{ sessionId: string }> };

/**
 * PUT { userId, enabled } - the course's host shares the course with a connected person
 * (enabled: true) or takes someone out of it (enabled: false). Returns the updated member list.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const room = await getRoomById(sessionId);
    if (!room) return NextResponse.json({ error: '코스를 찾을 수 없어요.' }, { status: 404 });
    if (room.ownerId !== auth.user.id) {
      return NextResponse.json({ error: '코스를 만든 사람만 함께할 사람을 바꿀 수 있어요.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const userId = body.userId;
    if (!isUuid(userId) || typeof body.enabled !== 'boolean') {
      return NextResponse.json({ error: '잘못된 요청이에요.' }, { status: 400 });
    }
    if (userId === room.ownerId) {
      return NextResponse.json({ error: '코스를 만든 사람은 뺄 수 없어요.' }, { status: 400 });
    }

    const sender = eventSender(request, auth.user);
    if (body.enabled) {
      if (!(await areConnected(auth.user.id, userId))) {
        return NextResponse.json({ error: '연결된 사람만 추가할 수 있어요.' }, { status: 403 });
      }
      if (await joinRoom(sessionId, userId)) {
        const updated = await getRoomById(sessionId);
        const member = updated?.members?.find((m) => m.userId === userId);
        if (member) await broadcastRoomEvent(sessionId, 'member_joined', { member }, sender);
        return NextResponse.json({ members: updated?.members ?? [] });
      }
    } else {
      const removed = await removeRoomMember(sessionId, userId);
      if (removed) {
        const nickname = room.members?.find((m) => m.userId === userId)?.nickname;
        const data: MemberRemovedData = { userId, nickname };
        await broadcastRoomEvent(sessionId, 'member_removed', data, sender);
      }
    }

    const latest = await getRoomById(sessionId);
    return NextResponse.json({ members: latest?.members ?? [] });
  } catch (error) {
    console.error('Member update error:', error);
    return NextResponse.json({ error: '함께할 사람을 바꾸지 못했어요.' }, { status: 500 });
  }
}

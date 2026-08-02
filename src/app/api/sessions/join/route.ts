import { NextRequest, NextResponse } from 'next/server';
import { getSessionByInviteCode, joinSession, broadcastSSE } from '@/lib/db';

// POST /api/sessions/join — Join a session via invite code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inviteCode, nickname } = body;

    if (!inviteCode || typeof inviteCode !== 'string') {
      return NextResponse.json({ error: '초대코드를 입력해주세요.' }, { status: 400 });
    }

    if (!nickname || typeof nickname !== 'string' || nickname.trim().length === 0) {
      return NextResponse.json({ error: '닉네임을 입력해주세요.' }, { status: 400 });
    }

    const code = inviteCode.trim().toUpperCase();
    const session = await getSessionByInviteCode(code);

    if (!session) {
      return NextResponse.json(
        { error: '유효하지 않거나 만료된 초대코드입니다.' },
        { status: 404 }
      );
    }

    // Check if nickname already exists in session
    const existing = session.members.find(
      (m) => m.nickname.toLowerCase() === nickname.trim().toLowerCase()
    );
    if (existing) {
      // Return existing member info instead of creating duplicate
      return NextResponse.json({
        session,
        memberId: existing.id,
        isRejoining: true,
      });
    }

    const member = await joinSession(session.id, nickname.trim());

    await broadcastSSE(session.id, 'member_joined', {
      member: {
        id: member.id,
        nickname: member.nickname,
        joinedAt: member.joinedAt,
        isOwner: false,
      },
    }, nickname.trim());

    // Refresh session to include new member
    const updatedSession = await getSessionByInviteCode(code);

    return NextResponse.json({
      session: updatedSession,
      memberId: member.id,
      isRejoining: false,
    });
  } catch (error: any) {
    console.error('Session join error:', error);
    return NextResponse.json({ error: '세션 참여 실패' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createGuestUser, isInviteUsable } from '@/lib/db';
import { getUserAgent, setSessionCookie } from '@/lib/session';
import { validateNickname } from '@/lib/validation';

/**
 * POST /api/auth/guest - join with a nickname only.
 * Guests can only be created with a valid invite code, so this is not an open sign-up endpoint.
 */
export async function POST(request: NextRequest) {
  try {
    const { nickname, inviteCode } = await request.json();
    const nicknameError = validateNickname(nickname);
    if (nicknameError) return NextResponse.json({ error: nicknameError }, { status: 400 });
    if (typeof inviteCode !== 'string' || !(await isInviteUsable(inviteCode.trim().toUpperCase()))) {
      return NextResponse.json({ error: '초대 링크가 만료됐거나 이미 사용됐어요. 새 링크를 받아주세요.' }, { status: 400 });
    }

    const result = await createGuestUser(nickname.trim(), getUserAgent(request));
    if (!result) {
      return NextResponse.json({ error: '게스트 계정을 만들지 못했습니다.' }, { status: 500 });
    }
    const response = NextResponse.json({ user: result.user }, { status: 201 });
    setSessionCookie(response, result.sessionToken);
    return response;
  } catch (error) {
    console.error('Guest API error:', error);
    return NextResponse.json({ error: '서버 에러가 발생했습니다.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { upgradeGuest } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { validateNickname, validatePassword } from '@/lib/validation';

/** POST /api/auth/upgrade - a guest sets a password (and optionally a new nickname) to keep the account */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    if (!auth.user.isGuest) {
      return NextResponse.json({ error: '게스트 계정만 전환할 수 있습니다.' }, { status: 400 });
    }

    const { nickname, password } = await request.json();
    const trimmed = typeof nickname === 'string' ? nickname.trim() : '';
    const wantsNickname = !!trimmed && trimmed !== auth.user.nickname;
    const nicknameError = wantsNickname ? validateNickname(trimmed) : null;
    const passwordError = validatePassword(password);
    if (nicknameError || passwordError) {
      return NextResponse.json({ error: nicknameError || passwordError }, { status: 400 });
    }

    const result = await upgradeGuest(auth.user.id, wantsNickname ? trimmed : null, password);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 409 });
    return NextResponse.json({ user: result.user });
  } catch (error) {
    console.error('Upgrade API error:', error);
    return NextResponse.json({ error: '서버 에러가 발생했습니다.' }, { status: 500 });
  }
}

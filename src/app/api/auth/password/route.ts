import { NextRequest, NextResponse } from 'next/server';
import { changePassword, endOtherSessions } from '@/lib/db';
import { getSessionToken, requireUser } from '@/lib/session';
import { validatePassword } from '@/lib/validation';

/** POST /api/auth/password - change the logged-in user's password and sign out other devices */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const { currentPassword, newPassword } = await request.json();
    if (typeof currentPassword !== 'string') {
      return NextResponse.json({ error: '현재 비밀번호를 입력해주세요.' }, { status: 400 });
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    const ok = await changePassword(auth.user.id, currentPassword, newPassword);
    if (!ok) {
      return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 403 });
    }
    const token = getSessionToken(request);
    if (token) await endOtherSessions(auth.user.id, token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json({ error: '서버 에러가 발생했습니다.' }, { status: 500 });
  }
}

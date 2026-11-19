import { NextRequest, NextResponse } from 'next/server';
import { changePassword } from '@/lib/db';
import { requireUser } from '@/lib/session';

const MIN_PASSWORD_LENGTH = 4;
const MAX_PASSWORD_LENGTH = 128;

/** POST /api/auth/password - change the logged-in user's password */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const { currentPassword, newPassword } = await request.json();
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return NextResponse.json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' }, { status: 400 });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json({ error: `새 비밀번호는 ${MIN_PASSWORD_LENGTH}~${MAX_PASSWORD_LENGTH}자로 입력해주세요.` }, { status: 400 });
    }

    const ok = await changePassword(auth.user.id, currentPassword, newPassword);
    if (!ok) {
      return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 403 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json({ error: '서버 에러가 발생했습니다.' }, { status: 500 });
  }
}

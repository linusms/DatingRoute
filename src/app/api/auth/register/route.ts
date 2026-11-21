import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/db';
import { getUserAgent, setSessionCookie } from '@/lib/session';
import { validateNickname, validatePassword } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const { nickname, password } = await request.json();
    const nicknameError = validateNickname(nickname);
    const passwordError = validatePassword(password);
    if (nicknameError || passwordError) {
      return NextResponse.json({ error: nicknameError || passwordError }, { status: 400 });
    }

    const result = await registerUser(nickname.trim(), password, getUserAgent(request));
    if (!result) {
      return NextResponse.json({ error: '이미 존재하는 닉네임이거나 가입에 실패했습니다.' }, { status: 409 });
    }

    const response = NextResponse.json({ user: result.user }, { status: 201 });
    setSessionCookie(response, result.sessionToken);
    return response;
  } catch (error) {
    console.error('Register API error:', error);
    return NextResponse.json({ error: '서버 에러가 발생했습니다.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/db';
import { setSessionCookie } from '@/lib/session';

const MAX_NICKNAME_LENGTH = 30;
const MAX_PASSWORD_LENGTH = 128;

export async function POST(request: NextRequest) {
  try {
    const { nickname, password } = await request.json();
    if (!nickname || !password) {
      return NextResponse.json({ error: '닉네임과 비밀번호를 입력해주세요.' }, { status: 400 });
    }
    if (nickname.length > MAX_NICKNAME_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json({ error: '닉네임 또는 비밀번호가 너무 깁니다.' }, { status: 400 });
    }

    const result = await registerUser(nickname, password);
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

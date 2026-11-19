import { NextRequest, NextResponse } from 'next/server';
import { loginUser } from '@/lib/db';
import { setSessionCookie } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const { nickname, password } = await request.json();
    if (!nickname || !password) {
      return NextResponse.json({ error: '닉네임과 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    const result = await loginUser(nickname, password);
    if (!result) {
      return NextResponse.json({ error: '잘못된 닉네임이거나 비밀번호가 틀렸습니다.' }, { status: 401 });
    }

    // The session token goes only into the httpOnly cookie, never the response body
    const response = NextResponse.json({ user: result.user }, { status: 200 });
    setSessionCookie(response, result.sessionToken);
    return response;
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: '서버 에러가 발생했습니다.' }, { status: 500 });
  }
}

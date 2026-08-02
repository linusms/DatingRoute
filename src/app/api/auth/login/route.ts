import { NextRequest, NextResponse } from 'next/server';
import { loginUser } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { nickname, password } = await request.json();
    if (!nickname || !password) {
      return NextResponse.json({ error: '닉네임과 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    const user = await loginUser(nickname, password);
    if (!user) {
      return NextResponse.json({ error: '잘못된 닉네임이거나 비밀번호가 틀렸습니다.' }, { status: 401 });
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: '서버 에러가 발생했습니다.' }, { status: 500 });
  }
}

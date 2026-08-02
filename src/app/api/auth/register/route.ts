import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { nickname, password } = await request.json();
    if (!nickname || !password) {
      return NextResponse.json({ error: '닉네임과 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    const user = await registerUser(nickname, password);
    if (!user) {
      return NextResponse.json({ error: '이미 존재하는 닉네임이거나 가입에 실패했습니다.' }, { status: 409 });
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error('Register API error:', error);
    return NextResponse.json({ error: '서버 에러가 발생했습니다.' }, { status: 500 });
  }
}

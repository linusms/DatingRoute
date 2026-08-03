export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { userId, sessionToken } = await request.json();
    if (!userId || !sessionToken) {
      return NextResponse.json({ valid: false, error: 'userId와 sessionToken이 필요합니다.' }, { status: 400 });
    }

    const valid = await validateSessionToken(userId, sessionToken);
    if (!valid) {
      return NextResponse.json({ valid: false, error: '다른 기기에서 로그인되었습니다.' }, { status: 401 });
    }

    return NextResponse.json({ valid: true }, { status: 200 });
  } catch (error) {
    console.error('Validate API error:', error);
    return NextResponse.json({ valid: false, error: '서버 에러' }, { status: 500 });
  }
}

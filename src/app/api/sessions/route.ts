import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSessionById } from '@/lib/db';

// POST /api/sessions — Create a new session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ownerName, isPersonal, expiresInDays } = body;

    if (!ownerName || typeof ownerName !== 'string' || ownerName.trim().length === 0) {
      return NextResponse.json({ error: '닉네임을 입력해주세요.' }, { status: 400 });
    }

    const result = await createSession(
      ownerName.trim(),
      !!isPersonal,
      expiresInDays ?? 30
    );

    return NextResponse.json({
      session: result.session,
      memberId: result.memberId,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Session creation error:', error);
    return NextResponse.json({ error: '세션 생성 실패' }, { status: 500 });
  }
}

// GET /api/sessions?id=xxx — Get a session by ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '세션 ID가 필요합니다.' }, { status: 400 });
    }

    const session = await getSessionById(id);
    if (!session) {
      return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (error: any) {
    console.error('Session fetch error:', error);
    return NextResponse.json({ error: '세션 조회 실패' }, { status: 500 });
  }
}

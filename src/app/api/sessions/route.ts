import { NextRequest, NextResponse } from 'next/server';
import { createSession, getSessionById, getPersonalSessionByNameAndPassword } from '@/lib/db';
import { supabase } from '@/lib/supabaseClient';

// POST /api/sessions — Create a new session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ownerName, isPersonal, expiresInDays, password } = body;

    if (!ownerName || typeof ownerName !== 'string' || ownerName.trim().length === 0) {
      return NextResponse.json({ error: '닉네임을 입력해주세요.' }, { status: 400 });
    }

    const trimmedName = ownerName.trim();

    if (isPersonal) {
      if (!password || typeof password !== 'string' || password.trim().length === 0) {
        return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 });
      }

      // Check if an account (personal session) already exists for this username
      const { data: existingUser } = await supabase
        .from('sessions')
        .select('id')
        .eq('owner_name', trimmedName)
        .eq('is_personal', true)
        .limit(1)
        .maybeSingle();

      if (existingUser) {
        // User exists, try to login
        const session = await getPersonalSessionByNameAndPassword(trimmedName, password);
        if (session) {
          const memberId = session.members.find((m) => m.isOwner)?.id || session.members[0]?.id;
          return NextResponse.json({
            session,
            memberId,
          }, { status: 200 });
        } else {
          return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
        }
      }
    }

    // If no existing user, or if invite mode, create new
    const result = await createSession(
      trimmedName,
      !!isPersonal,
      expiresInDays ?? 30,
      password
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

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';

/** GET /api/auth/me - current user from the session cookie (401 if logged out or replaced by another device) */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    return NextResponse.json({ user: auth.user });
  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json({ error: '서버 에러' }, { status: 500 });
  }
}

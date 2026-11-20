export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken, requireUser, setSessionCookie } from '@/lib/session';

/** GET /api/auth/me - current user from the session cookie (401 if logged out or expired) */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    const response = NextResponse.json({ user: auth.user });
    // Sliding expiry: every visit pushes the cookie's expiry out again
    const token = getSessionToken(request);
    if (token) setSessionCookie(response, token);
    return response;
  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json({ error: '서버 에러' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/sessionCookie';

/**
 * Deny-by-default gate for API routes: anything outside /api/auth needs a session cookie.
 * This only checks presence — each route handler still validates the session (src/lib/session.ts).
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};

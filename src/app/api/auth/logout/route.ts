import { NextRequest, NextResponse } from 'next/server';
import { endSession } from '@/lib/db';
import { getSessionUser, clearSessionCookie } from '@/lib/session';

/** POST /api/auth/logout - invalidates the session on the server and clears the cookie */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  try {
    const user = await getSessionUser(request);
    if (user) await endSession(user.id);
  } catch (error) {
    console.error('Logout error:', error);
  }
  clearSessionCookie(response);
  return response;
}

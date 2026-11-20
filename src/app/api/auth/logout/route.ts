import { NextRequest, NextResponse } from 'next/server';
import { endSession } from '@/lib/db';
import { clearSessionCookie, getSessionToken } from '@/lib/session';

/** POST /api/auth/logout - ends this device's session and clears the cookie (other devices stay signed in) */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  try {
    const token = getSessionToken(request);
    if (token) await endSession(token);
  } catch (error) {
    console.error('Logout error:', error);
  }
  clearSessionCookie(response);
  return response;
}

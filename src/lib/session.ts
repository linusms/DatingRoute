import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getUserBySessionToken, isRoomMember } from './db';
import { SESSION_COOKIE } from './sessionCookie';
import type { User } from './types';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30일

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.delete(SESSION_COOKIE);
}

export async function getSessionUser(request: NextRequest): Promise<User | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getUserBySessionToken(token);
}

type AuthResult = { ok: true; user: User } | { ok: false; response: NextResponse };

/** Resolves the logged-in user from the session cookie, or a 401 response. */
export async function requireUser(request: NextRequest): Promise<AuthResult> {
  const user = await getSessionUser(request);
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) };
  }
  return { ok: true, user };
}

/** Like requireUser, but also requires membership of the room (403 otherwise). */
export async function requireRoomMember(request: NextRequest, roomId: string): Promise<AuthResult> {
  const auth = await requireUser(request);
  if (!auth.ok) return auth;
  if (!(await isRoomMember(roomId, auth.user.id))) {
    return { ok: false, response: NextResponse.json({ error: '이 경로에 참여한 사용자만 접근할 수 있습니다.' }, { status: 403 }) };
  }
  return auth;
}

/** Like requireUser, but the path's userId must be the logged-in user (403 otherwise). */
export async function requireSelf(request: NextRequest, userId: string): Promise<AuthResult> {
  const auth = await requireUser(request);
  if (!auth.ok) return auth;
  if (auth.user.id !== userId) {
    return { ok: false, response: NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 }) };
  }
  return auth;
}

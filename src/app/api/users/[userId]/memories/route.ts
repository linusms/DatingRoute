export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserMemories } from '@/lib/db';
import { requireSelf } from '@/lib/session';

type RouteContext = { params: Promise<{ userId: string }> };

/** GET /api/users/[userId]/memories - visited places with a rating, review or photo, across the user's rooms */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const auth = await requireSelf(request, userId);
    if (!auth.ok) return auth.response;
    return NextResponse.json({ memories: await getUserMemories(userId) });
  } catch (error) {
    console.error('Memories fetch error:', error);
    return NextResponse.json({ error: '추억 조회 실패' }, { status: 500 });
  }
}

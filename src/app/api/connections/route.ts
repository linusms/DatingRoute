import { NextRequest, NextResponse } from 'next/server';
import { listConnections } from '@/lib/db';
import { requireUser } from '@/lib/session';

/** GET /api/connections - people the user is connected with (함께하는 사람) */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;
    return NextResponse.json({ connections: await listConnections(auth.user.id) });
  } catch (error) {
    console.error('Connections fetch error:', error);
    return NextResponse.json({ error: '함께하는 사람 목록을 불러오지 못했어요.' }, { status: 500 });
  }
}

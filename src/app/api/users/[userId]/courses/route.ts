export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserCoursesWithCollaborative } from '@/lib/db';

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await context.params;
    
    if (!userId) {
      return NextResponse.json({ error: '유저 ID가 필요합니다.' }, { status: 400 });
    }

    const courses = await getUserCoursesWithCollaborative(userId);
    return NextResponse.json({ courses }, { status: 200 });
  } catch (error: any) {
    console.error('User courses fetch error:', error);
    return NextResponse.json({ error: '코스 목록 조회 실패' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { deleteCourse } from '@/lib/db';

type RouteContext = { params: Promise<{ userId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await context.params;
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('id');
    
    if (!userId || !courseId) {
      return NextResponse.json({ error: '유저 ID와 코스 ID가 필요합니다.' }, { status: 400 });
    }

    await deleteCourse(courseId, userId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Course delete error:', error);
    return NextResponse.json({ error: '코스 삭제 실패' }, { status: 500 });
  }
}

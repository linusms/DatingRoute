export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { addLivePlace, updateLivePlaces, deleteLivePlace, broadcastSSE } from '@/lib/db';

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const { place, userId } = await request.json();

    if (!place || !userId) {
      return NextResponse.json({ error: '데이터가 누락되었습니다.' }, { status: 400 });
    }

    const newPlace = await addLivePlace(sessionId, userId, place);
    await broadcastSSE(sessionId, 'place_added', { place: newPlace }, userId);

    return NextResponse.json({ place: newPlace }, { status: 201 });
  } catch (error: any) {
    console.error('Live place add error:', error);
    return NextResponse.json({ error: '장소 추가 실패' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const { places, userId } = await request.json();

    if (!places || !userId) {
      return NextResponse.json({ error: '데이터가 누락되었습니다.' }, { status: 400 });
    }

    await updateLivePlaces(sessionId, userId, places);
    await broadcastSSE(sessionId, 'places_reordered', { places }, userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Live places update error:', error);
    return NextResponse.json({ error: '장소 업데이트 실패' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!placeId || !userId) {
      return NextResponse.json({ error: 'placeId와 userId가 필요합니다.' }, { status: 400 });
    }

    await deleteLivePlace(sessionId, userId, placeId);
    await broadcastSSE(sessionId, 'place_removed', { id: placeId }, userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Live place delete error:', error);
    return NextResponse.json({ error: '장소 삭제 실패' }, { status: 500 });
  }
}

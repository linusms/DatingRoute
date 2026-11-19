export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { addLivePlace, updateLivePlaces, deleteLivePlace, broadcastRoomEvent } from '@/lib/db';
import { requireRoomMember } from '@/lib/session';

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const auth = await requireRoomMember(request, sessionId);
    if (!auth.ok) return auth.response;
    const userId = auth.user.id;

    const { place } = await request.json();

    if (!place) {
      return NextResponse.json({ error: '데이터가 누락되었습니다.' }, { status: 400 });
    }

    const newPlace = await addLivePlace(sessionId, userId, place);
    await broadcastRoomEvent(sessionId, 'place_added', { place: newPlace }, userId);

    return NextResponse.json({ place: newPlace }, { status: 201 });
  } catch (error: any) {
    console.error('Live place add error:', error);
    return NextResponse.json({ error: '장소 추가 실패' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const auth = await requireRoomMember(request, sessionId);
    if (!auth.ok) return auth.response;
    const userId = auth.user.id;

    const { places } = await request.json();

    if (!places) {
      return NextResponse.json({ error: '데이터가 누락되었습니다.' }, { status: 400 });
    }

    await updateLivePlaces(sessionId, userId, places);
    await broadcastRoomEvent(sessionId, 'places_reordered', { places }, userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Live places update error:', error);
    return NextResponse.json({ error: '장소 업데이트 실패' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const auth = await requireRoomMember(request, sessionId);
    if (!auth.ok) return auth.response;
    const userId = auth.user.id;

    const placeId = request.nextUrl.searchParams.get('id');

    if (!placeId) {
      return NextResponse.json({ error: 'placeId가 필요합니다.' }, { status: 400 });
    }

    await deleteLivePlace(sessionId, userId, placeId);
    await broadcastRoomEvent(sessionId, 'place_removed', { id: placeId }, userId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Live place delete error:', error);
    return NextResponse.json({ error: '장소 삭제 실패' }, { status: 500 });
  }
}

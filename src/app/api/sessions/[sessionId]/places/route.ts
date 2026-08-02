export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import {
  addLivePlace,
  removeLivePlace,
  reorderLivePlaces,
  setLivePlaces,
  getLivePlaces,
  broadcastSSE,
} from '@/lib/db';
import type { CoursePlace } from '@/lib/types';

type RouteContext = { params: Promise<{ sessionId: string }> };

// GET /api/sessions/[sessionId]/places — Get live places
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const { sessionId } = await context.params;
    const places = await getLivePlaces(sessionId);
    return NextResponse.json({ places });
  } catch (error: any) {
    console.error('Get places error:', error);
    return NextResponse.json({ error: '장소 목록 조회 실패' }, { status: 500 });
  }
}

// POST /api/sessions/[sessionId]/places — Add a place
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { sessionId } = await context.params;
    const body = await request.json();
    const { place, addedBy } = body;

    if (!place || !place.title) {
      return NextResponse.json({ error: '장소 정보가 필요합니다.' }, { status: 400 });
    }

    const updated = await addLivePlace(sessionId, place as CoursePlace, addedBy || '');

    await broadcastSSE(sessionId, 'place_added', {
      place,
      allPlaces: updated,
    }, addedBy || '');

    return NextResponse.json({ places: updated }, { status: 201 });
  } catch (error: any) {
    console.error('Add place error:', error);
    return NextResponse.json({ error: '장소 추가 실패' }, { status: 500 });
  }
}

// PUT /api/sessions/[sessionId]/places — Reorder or set places
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { sessionId } = await context.params;
    const body = await request.json();
    const { action, placeIds, places, sender } = body;

    let updated: CoursePlace[];

    if (action === 'reorder' && placeIds) {
      updated = await reorderLivePlaces(sessionId, placeIds);
      await broadcastSSE(sessionId, 'places_reordered', { allPlaces: updated }, sender || '');
    } else if (action === 'set' && places) {
      updated = await setLivePlaces(sessionId, places, sender || '');
      await broadcastSSE(sessionId, 'places_reordered', { allPlaces: updated }, sender || '');
    } else {
      return NextResponse.json({ error: 'action 필드가 필요합니다.' }, { status: 400 });
    }

    return NextResponse.json({ places: updated });
  } catch (error: any) {
    console.error('Reorder places error:', error);
    return NextResponse.json({ error: '장소 정렬 실패' }, { status: 500 });
  }
}

// DELETE /api/sessions/[sessionId]/places — Remove a place
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { sessionId } = await context.params;
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get('placeId');
    const sender = searchParams.get('sender') || '';

    if (!placeId) {
      return NextResponse.json({ error: 'placeId가 필요합니다.' }, { status: 400 });
    }

    const updated = await removeLivePlace(sessionId, placeId);

    await broadcastSSE(sessionId, 'place_removed', {
      placeId,
      allPlaces: updated,
    }, sender);

    return NextResponse.json({ places: updated });
  } catch (error: any) {
    console.error('Remove place error:', error);
    return NextResponse.json({ error: '장소 삭제 실패' }, { status: 500 });
  }
}

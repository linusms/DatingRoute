export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import {
  broadcastRoomEvent,
  deleteLivePlaces,
  getLivePlaces,
  insertLivePlaces,
  reorderLivePlaces,
  setLivePlaceReaction,
  updateLivePlace,
} from '@/lib/db';
import { eventSender, requireRoomMember } from '@/lib/session';
import type { CoursePlace, PlacesChangedData, PlaceUpdatableFields } from '@/lib/types';

type RouteContext = { params: Promise<{ sessionId: string }> };

/*
 * Place operations for a room's live course. Each request is one small operation, so
 * concurrent edits by different members don't overwrite each other. After a change the
 * server broadcasts `places_changed` and other clients refetch the list (GET).
 */

function parseOrder(value: unknown): { id: string; day: number }[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .filter((o) => o && typeof o.id === 'string')
    .slice(0, 500)
    .map((o) => ({ id: o.id as string, day: Number(o.day) || 0 }));
}

/** GET - authoritative place list (with signed photo URLs) */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const auth = await requireRoomMember(request, sessionId);
    if (!auth.ok) return auth.response;
    return NextResponse.json({ places: await getLivePlaces(sessionId) });
  } catch (error) {
    console.error('Live places fetch error:', error);
    return NextResponse.json({ error: '장소 조회 실패' }, { status: 500 });
  }
}

/** POST { places, order? } - add places (client-generated UUIDs), then optionally apply a full order */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const auth = await requireRoomMember(request, sessionId);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const input: Partial<CoursePlace>[] = Array.isArray(body.places) ? body.places : body.place ? [body.place] : [];
    if (input.length === 0) {
      return NextResponse.json({ error: '데이터가 누락되었습니다.' }, { status: 400 });
    }

    const places = await insertLivePlaces(sessionId, input, auth.user.nickname);
    const order = parseOrder(body.order);
    if (order) await reorderLivePlaces(sessionId, order);

    const data: PlacesChangedData = { action: 'added', titles: places.map((p) => p.title), count: places.length };
    await broadcastRoomEvent(sessionId, 'places_changed', data, eventSender(request, auth.user));

    return NextResponse.json({ places }, { status: 201 });
  } catch (error) {
    console.error('Live place add error:', error);
    return NextResponse.json({ error: '장소 추가 실패' }, { status: 500 });
  }
}

/** PATCH { id, fields } or { id, reaction } - update one place */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const auth = await requireRoomMember(request, sessionId);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    if (typeof body.id !== 'string') {
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    }

    let place: CoursePlace | null;
    let data: PlacesChangedData;
    if ('reaction' in body) {
      const emoji = typeof body.reaction === 'string' ? body.reaction : null;
      place = await setLivePlaceReaction(sessionId, body.id, auth.user.id, emoji);
      data = { action: 'reacted', titles: place ? [place.title] : [] };
    } else {
      const fields: PlaceUpdatableFields = body.fields && typeof body.fields === 'object' ? body.fields : {};
      place = await updateLivePlace(sessionId, body.id, fields);
      data = { action: 'updated', titles: place ? [place.title] : [] };
    }
    if (!place) {
      return NextResponse.json({ error: '장소를 찾을 수 없습니다.' }, { status: 404 });
    }

    await broadcastRoomEvent(sessionId, 'places_changed', data, eventSender(request, auth.user));
    return NextResponse.json({ place });
  } catch (error) {
    console.error('Live place update error:', error);
    return NextResponse.json({ error: '장소 수정 실패' }, { status: 500 });
  }
}

/**
 * PUT { order: [{ id, day }] } - reorder / move between days.
 * Tabs still running the previous build send { places } (the whole list). Their temporary ids
 * would turn into duplicate rows, so only the order of places that already exist is applied.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const auth = await requireRoomMember(request, sessionId);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const order = parseOrder(body.order) ?? parseOrder(body.places);
    if (!order) {
      return NextResponse.json({ error: '데이터가 누락되었습니다.' }, { status: 400 });
    }

    await reorderLivePlaces(sessionId, order);
    const data: PlacesChangedData = { action: 'reordered' };
    await broadcastRoomEvent(sessionId, 'places_changed', data, eventSender(request, auth.user));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Live places reorder error:', error);
    return NextResponse.json({ error: '장소 순서 변경 실패' }, { status: 500 });
  }
}

/** DELETE ?ids=a,b (or ?id=a) - remove places */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const auth = await requireRoomMember(request, sessionId);
    if (!auth.ok) return auth.response;

    const params = request.nextUrl.searchParams;
    const ids = (params.get('ids') || params.get('id') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    }

    const titles = await deleteLivePlaces(sessionId, ids);
    const data: PlacesChangedData = { action: 'removed', titles, count: titles.length };
    await broadcastRoomEvent(sessionId, 'places_changed', data, eventSender(request, auth.user));

    return NextResponse.json({ success: true, removed: titles.length });
  } catch (error) {
    console.error('Live place delete error:', error);
    return NextResponse.json({ error: '장소 삭제 실패' }, { status: 500 });
  }
}

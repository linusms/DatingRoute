export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { broadcastRoomEvent, setLivePlacePhoto } from '@/lib/db';
import { eventSender, requireRoomMember } from '@/lib/session';

type RouteContext = { params: Promise<{ sessionId: string; placeId: string }> };

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** POST multipart (field "photo") - set the memory photo of a place. The browser resizes before upload. */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId, placeId } = await context.params;
    const auth = await requireRoomMember(request, sessionId);
    if (!auth.ok) return auth.response;

    const form = await request.formData();
    const file = form.get('photo');
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: '사진 파일이 필요합니다.' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'JPG, PNG, WEBP 사진만 올릴 수 있습니다.' }, { status: 400 });
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: '사진은 3MB 이하만 올릴 수 있습니다.' }, { status: 413 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const photoUrl = await setLivePlacePhoto(sessionId, placeId, { bytes, contentType: file.type });
    await broadcastRoomEvent(sessionId, 'places_changed', { action: 'updated' }, eventSender(request, auth.user));
    return NextResponse.json({ photoUrl });
  } catch (error) {
    console.error('Photo upload error:', error);
    return NextResponse.json({ error: '사진 업로드 실패' }, { status: 500 });
  }
}

/** DELETE - remove the memory photo */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { sessionId, placeId } = await context.params;
    const auth = await requireRoomMember(request, sessionId);
    if (!auth.ok) return auth.response;
    await setLivePlacePhoto(sessionId, placeId, null);
    await broadcastRoomEvent(sessionId, 'places_changed', { action: 'updated' }, eventSender(request, auth.user));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Photo delete error:', error);
    return NextResponse.json({ error: '사진 삭제 실패' }, { status: 500 });
  }
}

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import type { Course, CoursePlace, Session, SessionMember } from './types';

import { supabase } from './supabaseClient';

// Helper function to generate invite code
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 for clarity
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function generateUniqueInviteCode(): Promise<string> {
  let code: string;
  let attempts = 0;
  while (true) {
    code = generateInviteCode();
    attempts++;
    if (attempts > 100) throw new Error('Cannot generate unique invite code');
    const { data } = await supabase.from('sessions').select('id').eq('invite_code', code).maybeSingle();
    if (!data) break;
  }
  return code;
}

/* ─────────── Session CRUD ─────────── */

export async function createSession(
  ownerName: string,
  isPersonal: boolean,
  expiresInDays: number = 30
): Promise<{ session: Session; memberId: string }> {
  const sessionId = uuidv4();
  const memberId = uuidv4();
  const inviteCode = await generateUniqueInviteCode();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  // Insert session
  await supabase.from('sessions').insert({
    id: sessionId,
    invite_code: inviteCode,
    owner_name: ownerName,
    created_at: now,
    expires_at: expiresAt,
    is_personal: isPersonal
  });

  // Insert member
  await supabase.from('session_members').insert({
    id: memberId,
    session_id: sessionId,
    nickname: ownerName,
    joined_at: now,
    is_owner: true
  });

  return {
    session: {
      id: sessionId,
      inviteCode,
      ownerName,
      createdAt: now,
      expiresAt,
      isPersonal,
      members: [{
        id: memberId,
        sessionId,
        nickname: ownerName,
        joinedAt: now,
        isOwner: true,
      }],
    },
    memberId,
  };
}

export async function getSessionByInviteCode(code: string): Promise<Session | null> {
  const { data: row } = await supabase
    .from('sessions')
    .select('*')
    .eq('invite_code', code)
    .maybeSingle();

  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  const members = await getSessionMembers(row.id);
  return {
    id: row.id,
    inviteCode: row.invite_code,
    ownerName: row.owner_name,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isPersonal: row.is_personal,
    members,
  };
}

export async function getSessionById(sessionId: string): Promise<Session | null> {
  const { data: row } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (!row) return null;

  const members = await getSessionMembers(row.id);
  return {
    id: row.id,
    inviteCode: row.invite_code,
    ownerName: row.owner_name,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isPersonal: row.is_personal,
    members,
  };
}

export async function getSessionMembers(sessionId: string): Promise<SessionMember[]> {
  const { data: rows } = await supabase
    .from('session_members')
    .select('*')
    .eq('session_id', sessionId);
    
  if (!rows) return [];
  return rows.map((r: any) => ({
    id: r.id,
    sessionId: r.session_id,
    nickname: r.nickname,
    joinedAt: r.joined_at,
    isOwner: r.is_owner,
  }));
}

export async function joinSession(sessionId: string, nickname: string): Promise<SessionMember> {
  const memberId = uuidv4();
  const now = new Date().toISOString();

  await supabase.from('session_members').insert({
    id: memberId,
    session_id: sessionId,
    nickname,
    joined_at: now,
    is_owner: false
  });

  return {
    id: memberId,
    sessionId,
    nickname,
    joinedAt: now,
    isOwner: false,
  };
}

export async function deleteSession(sessionId: string): Promise<void> {
  await supabase.from('sessions').delete().eq('id', sessionId);
}

/* ─────────── Course CRUD ─────────── */

export async function createCourse(
  sessionId: string,
  name: string,
  description: string,
  places: CoursePlace[],
  addedBy: string = ''
): Promise<Course> {
  const courseId = uuidv4();
  const now = new Date().toISOString();

  await supabase.from('courses').insert({
    id: courseId,
    session_id: sessionId,
    name,
    description,
    created_at: now,
    updated_at: now
  });

  if (places.length > 0) {
    const placesToInsert = places.map((p, i) => ({
      id: p.id || uuidv4(),
      course_id: courseId,
      title: p.title,
      category: p.category,
      address: p.address,
      road_address: p.roadAddress,
      mapx: p.mapx,
      mapy: p.mapy,
      link: p.link,
      description: p.description,
      memo: p.memo,
      order_index: i,
      added_by: addedBy
    }));
    await supabase.from('course_places').insert(placesToInsert);
  }

  return {
    id: courseId,
    name,
    description,
    places,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getCoursesBySession(sessionId: string): Promise<Course[]> {
  const { data: rows } = await supabase
    .from('courses')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });

  if (!rows) return [];

  const courses: Course[] = [];
  for (const r of rows) {
    const places = await getCoursePlaces(r.id);
    courses.push({
      id: r.id,
      name: r.name,
      description: r.description,
      places,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    });
  }
  return courses;
}

export async function getCourseById(courseId: string): Promise<Course | null> {
  const { data: row } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .maybeSingle();

  if (!row) return null;

  const places = await getCoursePlaces(row.id);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    places,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCoursePlaces(courseId: string): Promise<CoursePlace[]> {
  const { data: rows } = await supabase
    .from('course_places')
    .select('*')
    .eq('course_id', courseId)
    .order('order_index', { ascending: true });

  if (!rows) return [];
  return rows.map((r: any) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    address: r.address,
    roadAddress: r.road_address,
    mapx: r.mapx,
    mapy: r.mapy,
    link: r.link,
    description: r.description,
    order: r.order_index,
    memo: r.memo,
    addedBy: r.added_by,
  }));
}

export async function updateCourse(
  courseId: string,
  data: { name?: string; description?: string; places?: CoursePlace[] },
  addedBy: string = ''
): Promise<Course | null> {
  const now = new Date().toISOString();
  
  if (data.name !== undefined || data.description !== undefined) {
    const updates: any = { updated_at: now };
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    await supabase.from('courses').update(updates).eq('id', courseId);
  }

  if (data.places) {
    // Delete existing places
    await supabase.from('course_places').delete().eq('course_id', courseId);
    
    // Insert new ones
    if (data.places.length > 0) {
      const placesToInsert = data.places.map((p, i) => ({
        id: p.id || uuidv4(),
        course_id: courseId,
        title: p.title,
        category: p.category,
        address: p.address,
        road_address: p.roadAddress,
        mapx: p.mapx,
        mapy: p.mapy,
        link: p.link,
        description: p.description,
        memo: p.memo,
        order_index: i,
        added_by: (p as any).addedBy || addedBy
      }));
      await supabase.from('course_places').insert(placesToInsert);
    }
    await supabase.from('courses').update({ updated_at: now }).eq('id', courseId);
  }

  return getCourseById(courseId);
}

export async function deleteCourseDb(courseId: string): Promise<void> {
  await supabase.from('courses').delete().eq('id', courseId);
}

/* ─────────── Live Places (session-level working set) ─────────── */

const LIVE_COURSE_NAME = '__live__';

export async function getLiveCourseId(sessionId: string): Promise<string> {
  const { data: row } = await supabase
    .from('courses')
    .select('id')
    .eq('session_id', sessionId)
    .eq('name', LIVE_COURSE_NAME)
    .maybeSingle();

  if (row) return row.id;

  const courseId = uuidv4();
  const now = new Date().toISOString();
  await supabase.from('courses').insert({
    id: courseId,
    session_id: sessionId,
    name: LIVE_COURSE_NAME,
    description: '',
    created_at: now,
    updated_at: now
  });

  return courseId;
}

export async function getLivePlaces(sessionId: string): Promise<CoursePlace[]> {
  const courseId = await getLiveCourseId(sessionId);
  return getCoursePlaces(courseId);
}

export async function addLivePlace(sessionId: string, place: CoursePlace, addedBy: string = ''): Promise<CoursePlace[]> {
  const courseId = await getLiveCourseId(sessionId);

  const { data: maxRow } = await supabase
    .from('course_places')
    .select('order_index')
    .eq('course_id', courseId)
    .order('order_index', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = maxRow ? maxRow.order_index + 1 : 0;

  await supabase.from('course_places').insert({
    id: place.id || uuidv4(),
    course_id: courseId,
    title: place.title,
    category: place.category,
    address: place.address,
    road_address: place.roadAddress,
    mapx: place.mapx,
    mapy: place.mapy,
    link: place.link,
    description: place.description,
    memo: place.memo,
    order_index: nextOrder,
    added_by: addedBy
  });

  await supabase.from('courses').update({ updated_at: new Date().toISOString() }).eq('id', courseId);
  return getCoursePlaces(courseId);
}

export async function removeLivePlace(sessionId: string, placeId: string): Promise<CoursePlace[]> {
  const courseId = await getLiveCourseId(sessionId);
  await supabase.from('course_places').delete().eq('id', placeId).eq('course_id', courseId);

  // Re-index
  const remaining = await getCoursePlaces(courseId);
  for (let i = 0; i < remaining.length; i++) {
    await supabase.from('course_places').update({ order_index: i }).eq('id', remaining[i].id);
  }

  await supabase.from('courses').update({ updated_at: new Date().toISOString() }).eq('id', courseId);
  return getCoursePlaces(courseId);
}

export async function reorderLivePlaces(sessionId: string, placeIds: string[]): Promise<CoursePlace[]> {
  const courseId = await getLiveCourseId(sessionId);
  for (let i = 0; i < placeIds.length; i++) {
    await supabase.from('course_places').update({ order_index: i }).eq('id', placeIds[i]).eq('course_id', courseId);
  }
  await supabase.from('courses').update({ updated_at: new Date().toISOString() }).eq('id', courseId);
  return getCoursePlaces(courseId);
}

export async function setLivePlaces(sessionId: string, places: CoursePlace[], addedBy: string = ''): Promise<CoursePlace[]> {
  const courseId = await getLiveCourseId(sessionId);

  await supabase.from('course_places').delete().eq('course_id', courseId);

  if (places.length > 0) {
    const placesToInsert = places.map((p, i) => ({
      id: p.id || uuidv4(),
      course_id: courseId,
      title: p.title,
      category: p.category,
      address: p.address,
      road_address: p.roadAddress,
      mapx: p.mapx,
      mapy: p.mapy,
      link: p.link,
      description: p.description,
      memo: p.memo,
      order_index: i,
      added_by: (p as any).addedBy || addedBy
    }));
    await supabase.from('course_places').insert(placesToInsert);
  }

  await supabase.from('courses').update({ updated_at: new Date().toISOString() }).eq('id', courseId);
  return getCoursePlaces(courseId);
}

/* ─────────── SSE Broadcasting (via Supabase Events Table) ─────────── */

export async function broadcastSSE(
  sessionId: string,
  type: string,
  data: any,
  sender: string
): Promise<void> {
  await supabase.from('events').insert({
    session_id: sessionId,
    type,
    data,
    sender
  });
}

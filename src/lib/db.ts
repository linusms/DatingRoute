import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import type { Course, CoursePlace, User, Room, RoomMember } from './types';
import { createHash, randomBytes } from 'crypto';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder'
);

const LIVE_COURSE_NAME = '__live__';

async function hashPassword(password: string): Promise<string> {
  return createHash('sha256').update(password).digest('hex');
}

function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/* ─────────── Mapper Functions ─────────── */

function mapDbUserToUser(row: any): User {
  if (!row) return row;
  return {
    id: row.id,
    nickname: row.nickname,
    sessionToken: row.session_token,
    createdAt: row.created_at,
  } as User;
}

function mapDbRoomToRoom(row: any): Room {
  if (!row) return row;
  return {
    ...row,
    ownerId: row.owner_id,
    inviteCode: row.invite_code,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as Room;
}

function mapDbRoomMemberToRoomMember(row: any): RoomMember {
  if (!row) return row;
  return {
    ...row,
    roomId: row.room_id,
    userId: row.user_id,
    isOwner: row.is_owner,
    joinedAt: row.joined_at,
    nickname: row.user?.nickname || row.users?.nickname || row.nickname || 'Unknown',
  } as RoomMember;
}

function mapDbPlaceToCoursePlace(row: any): CoursePlace {
  return {
    ...row,
    roadAddress: row.road_address,
    order: row.order_index,
    day: row.day_index ?? 1,
  } as CoursePlace;
}

/* ─────────── Auth (Users) ─────────── */

export async function registerUser(nickname: string, password: string): Promise<User | null> {
  const hashedPassword = await hashPassword(password);
  const { data, error } = await supabase
    .from('users')
    .insert({ nickname, password: hashedPassword })
    .select('*')
    .single();

  if (error) {
    console.error('Register error:', error);
    return null; // or throw error
  }
  return mapDbUserToUser(data);
}

export async function loginUser(nickname: string, password: string): Promise<User | null> {
  const hashedPassword = await hashPassword(password);
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('nickname', nickname)
    .eq('password', hashedPassword)
    .single();

  if (error || !data) return null;

  // Generate new session token (invalidates any previous session on other devices)
  const sessionToken = generateSessionToken();
  await supabase
    .from('users')
    .update({ session_token: sessionToken })
    .eq('id', data.id);

  data.session_token = sessionToken;
  return mapDbUserToUser(data);
}

export async function validateSessionToken(userId: string, sessionToken: string): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('session_token')
    .eq('id', userId)
    .single();

  if (!data) return false;
  return data.session_token === sessionToken;
}

export async function getUserById(userId: string): Promise<User | null> {
  const { data } = await supabase.from('users').select('*').eq('id', userId).single();
  return mapDbUserToUser(data);
}

/* ─────────── Rooms (Workspaces) ─────────── */

export async function createRoom(ownerId: string, expiresInDays: number = 30): Promise<{ room: Room; inviteCode: string }> {
  const roomId = uuidv4();
  let inviteCode = '';
  
  // Generate unique invite code
  while (true) {
    inviteCode = generateInviteCode();
    const { data } = await supabase.from('rooms').select('id').eq('invite_code', inviteCode).maybeSingle();
    if (!data) break;
  }

  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  // Create room
  await supabase.from('rooms').insert({
    id: roomId,
    invite_code: inviteCode,
    owner_id: ownerId,
    expires_at: expiresAt
  });

  // Add owner to members
  await supabase.from('room_members').insert({
    room_id: roomId,
    user_id: ownerId,
    is_owner: true
  });

  // Auto-create live course for the room
  const liveCourseId = uuidv4();
  await supabase.from('courses').insert({
    id: liveCourseId,
    room_id: roomId,
    owner_id: ownerId,
    name: LIVE_COURSE_NAME,
  });

  const { data: roomData } = await supabase.from('rooms').select('*').eq('id', roomId).single();
  return { room: mapDbRoomToRoom(roomData), inviteCode };
}

export async function getRoomByInviteCode(code: string): Promise<any | null> {
  const { data } = await supabase
    .from('rooms')
    .select('*, members:room_members(*, user:users(nickname))')
    .eq('invite_code', code)
    .maybeSingle();

  if (data && data.members) {
    data.members = data.members.map(mapDbRoomMemberToRoomMember);
  }
  return data ? mapDbRoomToRoom(data) : null;
}

export async function getRoomById(roomId: string): Promise<any | null> {
  const { data } = await supabase
    .from('rooms')
    .select('*, members:room_members(*, user:users(nickname))')
    .eq('id', roomId)
    .single();
    
  if (data && data.members) {
    data.members = data.members.map(mapDbRoomMemberToRoomMember);
  }
  return data ? mapDbRoomToRoom(data) : null;
}

export async function joinRoom(roomId: string, userId: string): Promise<void> {
  // Check if already in room
  const { data: existing } = await supabase
    .from('room_members')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!existing) {
    await supabase.from('room_members').insert({
      room_id: roomId,
      user_id: userId,
      is_owner: false
    });
  }
}

/* ─────────── Live Courses (Room-based, shared) ─────────── */

/**
 * Gets or creates the live course for a room. All members of the room share the same live course.
 * The live course is identified by name='__live__' and room_id=roomId.
 */
export async function getLiveCourseId(roomId: string, ownerId: string): Promise<string> {
  // All routes now go through rooms - find the live course by room_id
  const { data: existing } = await supabase
    .from('courses')
    .select('id')
    .eq('name', LIVE_COURSE_NAME)
    .eq('room_id', roomId)
    .maybeSingle();

  if (existing) return existing.id;

  // Create live course for the room
  const courseId = uuidv4();
  const { error } = await supabase.from('courses').insert({
    id: courseId,
    room_id: roomId,
    owner_id: ownerId,
    name: LIVE_COURSE_NAME
  });
  
  if (error) console.error('Live course creation error:', error);

  return courseId;
}

export async function getLivePlaces(roomId: string, ownerId: string): Promise<CoursePlace[]> {
  const courseId = await getLiveCourseId(roomId, ownerId);
  const { data: rows } = await supabase
    .from('course_places')
    .select('*')
    .eq('course_id', courseId)
    .order('order_index', { ascending: true });
  
  return (rows || []).map(mapDbPlaceToCoursePlace);
}

export async function getLiveCourseDetails(roomId: string): Promise<{ displayName: string; description: string; id: string; schedule: any | null; aiHistory: any | null } | null> {
  const { data } = await supabase
    .from('courses')
    .select('id, display_name, description, schedule, ai_history')
    .eq('name', '__live__')
    .eq('room_id', roomId)
    .maybeSingle();
  if (data) {
    return {
      id: data.id,
      displayName: data.display_name || '',
      description: data.description || '',
      schedule: data.schedule ?? null,
      aiHistory: data.ai_history ?? null,
    };
  }
  return null;
}

export async function saveLiveSchedule(roomId: string, schedule: any): Promise<void> {
  const { error } = await supabase
    .from('courses')
    .update({ schedule: schedule, updated_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .eq('name', '__live__');
  if (error) console.error('Save schedule error:', error);
}

export async function saveLiveAiHistory(roomId: string, aiHistory: any): Promise<void> {
  const { error } = await supabase
    .from('courses')
    .update({ ai_history: aiHistory, updated_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .eq('name', '__live__');
  if (error) console.error('Save AI history error:', error);
}

export async function addLivePlace(roomId: string, ownerId: string, placeData: Partial<CoursePlace>): Promise<CoursePlace> {
  const courseId = await getLiveCourseId(roomId, ownerId);
  const newPlaceDb = {
    id: uuidv4(),
    course_id: courseId,
    title: placeData.title || '',
    category: placeData.category || '',
    address: placeData.address || '',
    road_address: placeData.roadAddress || '',
    mapx: placeData.mapx || 0,
    mapy: placeData.mapy || 0,
    link: placeData.link || '',
    description: placeData.description || '',
    memo: placeData.memo || '',
    order_index: placeData.order || 0,
    day_index: placeData.day ?? 1,
  };
  const { error } = await supabase.from('course_places').insert(newPlaceDb);
  if (error) console.error('Add live place error:', error);
  
  return mapDbPlaceToCoursePlace(newPlaceDb);
}

export async function updateLivePlaces(roomId: string, ownerId: string, places: CoursePlace[]): Promise<void> {
  const courseId = await getLiveCourseId(roomId, ownerId);

  if (places.length === 0) {
    // Delete all places for this course
    await supabase.from('course_places').delete().eq('course_id', courseId);
    return;
  }

  // Upsert all places: insert if new, update if existing.
  // This handles temporary IDs that were never saved to the DB.
  const rows = places.map((p, i) => ({
    id: p.id,
    course_id: courseId,
    title: p.title || '',
    category: p.category || '',
    address: p.address || '',
    road_address: p.roadAddress || '',
    mapx: p.mapx || 0,
    mapy: p.mapy || 0,
    link: p.link || '',
    description: p.description || '',
    memo: p.memo || '',
    order_index: i,
    day_index: p.day ?? 1,
  }));

  const { error } = await supabase
    .from('course_places')
    .upsert(rows, { onConflict: 'id' });
  if (error) console.error('Upsert live places error:', error);
}

export async function deleteLivePlace(roomId: string, ownerId: string, placeId: string): Promise<void> {
  const courseId = await getLiveCourseId(roomId, ownerId);
  await supabase.from('course_places').delete().eq('id', placeId).eq('course_id', courseId);
}

/* ─────────── User Courses (Saved + Collaborative) ─────────── */

/**
 * Retrieves all courses visible to the user:
 * 1. Saved courses owned by the user (where name != __live__)
 * 2. Live courses from rooms the user has participated in (unsaved collaborative routes)
 */
export async function getUserCoursesWithCollaborative(userId: string): Promise<Course[]> {
  // 1. Get saved courses owned by the user
  const { data: ownedCourses } = await supabase
    .from('courses')
    .select('*')
    .eq('owner_id', userId)
    .neq('name', LIVE_COURSE_NAME)
    .order('created_at', { ascending: false });

  // 2. Get rooms where the user is a member
  const { data: memberships } = await supabase
    .from('room_members')
    .select('room_id, is_owner')
    .eq('user_id', userId);

  const roomIds = (memberships || []).map(m => m.room_id);

  // 3. Get live courses from those rooms (unsaved collaborative routes)
  let liveCourses: any[] = [];
  if (roomIds.length > 0) {
    const { data: roomLiveCourses } = await supabase
      .from('courses')
      .select('*, rooms!inner(id, invite_code, owner_id)')
      .eq('name', LIVE_COURSE_NAME)
      .in('room_id', roomIds);
    liveCourses = roomLiveCourses || [];
  }

  // Combine all course IDs
  const allCourses = [...(ownedCourses || []), ...liveCourses];
  if (allCourses.length === 0) return [];

  const courseIds = allCourses.map(c => c.id);
  const { data: places } = await supabase
    .from('course_places')
    .select('*')
    .in('course_id', courseIds)
    .order('order_index', { ascending: true });

  const placesByCourse = (places || []).reduce((acc: any, p: any) => {
    if (!acc[p.course_id]) acc[p.course_id] = [];
    acc[p.course_id].push(mapDbPlaceToCoursePlace(p));
    return acc;
  }, {});

  // 4. Get member counts for collaborative rooms
  let memberCountByRoom: Record<string, number> = {};
  if (roomIds.length > 0) {
    const { data: allMembers } = await supabase
      .from('room_members')
      .select('room_id')
      .in('room_id', roomIds);
    
    (allMembers || []).forEach(m => {
      memberCountByRoom[m.room_id] = (memberCountByRoom[m.room_id] || 0) + 1;
    });
  }

  // Map owned courses
  const result: Course[] = (ownedCourses || []).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description || '',
    places: placesByCourse[c.id] || [],
    roomId: c.room_id || undefined,
    isCollaborative: false,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));

  // Map live collaborative courses (show as auto-saved routes in dashboard)
  for (const c of liveCourses) {
    const memberCount = memberCountByRoom[c.room_id] || 1;
    
    result.push({
      id: c.id,
      name: '저장되지 않은 경로',
      displayName: c.display_name || '',   // user-set label
      description: c.description || '',
      places: placesByCourse[c.id] || [],
      roomId: c.room_id,
      isLive: true,
      isCollaborative: memberCount > 1,
      memberCount,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    });
  }

  // Sort: most recently updated first
  result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return result;
}

/** @deprecated Use getUserCoursesWithCollaborative instead */
export async function getUserCourses(userId: string): Promise<Course[]> {
  return getUserCoursesWithCollaborative(userId);
}

export async function getCoursePlaces(courseId: string): Promise<CoursePlace[]> {
  const { data: rows } = await supabase
    .from('course_places')
    .select('*')
    .eq('course_id', courseId)
    .order('order_index', { ascending: true });
  
  return (rows || []).map(mapDbPlaceToCoursePlace);
}

export async function saveCourseForUser(userId: string, roomId: string, name: string, description: string): Promise<Course> {
  // 1. Get Live Course Places from the Room
  const liveCourseId = await getLiveCourseId(roomId, userId);
  const { data: places } = await supabase.from('course_places').select('*').eq('course_id', liveCourseId);

  // 2. Create new permanent Course owned by user
  const newCourseId = uuidv4();
  const newCourse = {
    id: newCourseId,
    owner_id: userId,
    room_id: roomId, // Keep room reference for collaborative re-access
    name: name,
    description: description
  };
  
  const { error: courseError } = await supabase.from('courses').insert(newCourse);
  if (courseError) console.error('Save course error:', courseError);

  // 3. Duplicate places
  if (places && places.length > 0) {
    const newPlaces = places.map((p, index) => ({
      ...p,
      id: uuidv4(),
      course_id: newCourseId,
      order_index: index
    }));
    const { error: placesError } = await supabase.from('course_places').insert(newPlaces);
    if (placesError) console.error('Save course places error:', placesError);
  }

  return newCourse as unknown as Course;
}

export async function deleteCourse(courseId: string, userId: string): Promise<void> {
  await supabase.from('courses').delete().eq('id', courseId).eq('owner_id', userId);
}

export async function updateCourse(courseId: string, userId: string, name: string, description: string): Promise<boolean> {
  const { error } = await supabase
    .from('courses')
    .update({ name, description, updated_at: new Date().toISOString() })
    .eq('id', courseId)
    .eq('owner_id', userId);
  return !error;
}

/** Update the display name and description of a live course (shared by all collaborators) */
export async function updateLiveCourseName(
  roomId: string,
  displayName: string,
  description: string
): Promise<boolean> {
  const { error } = await supabase
    .from('courses')
    .update({
      display_name: displayName,
      description,
      updated_at: new Date().toISOString(),
    })
    .eq('room_id', roomId)
    .eq('name', '__live__');
  return !error;
}

/* ─────────── Realtime Events ─────────── */

export async function broadcastSSE(roomId: string, type: string, payload: any, sender: string) {
  if (!roomId) return;
  await supabase.from('events').insert({
    room_id: roomId,
    type,
    data: payload,
    sender
  });
}

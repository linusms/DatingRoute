import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import type { Course, CoursePlace, User, Room, RoomMember } from './types';
import { createHash } from 'crypto';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder'
);

const LIVE_COURSE_NAME = '__live__';

async function hashPassword(password: string): Promise<string> {
  return createHash('sha256').update(password).digest('hex');
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
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
  return data as User;
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
  return data as User;
}

export async function getUserById(userId: string): Promise<User | null> {
  const { data } = await supabase.from('users').select('*').eq('id', userId).single();
  return data as User;
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

  const { data: roomData } = await supabase.from('rooms').select('*').eq('id', roomId).single();
  return { room: roomData as Room, inviteCode };
}

export async function getRoomByInviteCode(code: string): Promise<any | null> {
  const { data } = await supabase
    .from('rooms')
    .select('*, members:room_members(*, user:users(nickname))')
    .eq('invite_code', code)
    .maybeSingle();

  if (data && data.members) {
    data.members = data.members.map((m: any) => ({
      ...m,
      nickname: m.user?.nickname || 'Unknown'
    }));
  }
  return data;
}

export async function getRoomById(roomId: string): Promise<any | null> {
  const { data } = await supabase
    .from('rooms')
    .select('*, members:room_members(*, user:users(nickname))')
    .eq('id', roomId)
    .single();
    
  if (data && data.members) {
    data.members = data.members.map((m: any) => ({
      ...m,
      nickname: m.user?.nickname || 'Unknown'
    }));
  }
  return data;
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

/* ─────────── Live Courses ─────────── */

export async function getLiveCourseId(roomId: string, ownerId: string): Promise<string> {
  // Look for the live course for this room OR create it
  const { data: row } = await supabase
    .from('courses')
    .select('id')
    .eq('room_id', roomId)
    .eq('name', LIVE_COURSE_NAME)
    .maybeSingle();

  if (row) return row.id;

  const courseId = uuidv4();
  await supabase.from('courses').insert({
    id: courseId,
    room_id: roomId,
    owner_id: ownerId,
    name: LIVE_COURSE_NAME
  });

  return courseId;
}

export async function getLivePlaces(roomId: string, ownerId: string): Promise<CoursePlace[]> {
  const courseId = await getLiveCourseId(roomId, ownerId);
  const { data: rows } = await supabase
    .from('course_places')
    .select('*')
    .eq('course_id', courseId)
    .order('order_index', { ascending: true });
  
  return (rows || []) as CoursePlace[];
}

export async function addLivePlace(roomId: string, ownerId: string, placeData: Partial<CoursePlace>): Promise<CoursePlace> {
  const courseId = await getLiveCourseId(roomId, ownerId);
  const newPlace = {
    ...placeData,
    id: uuidv4(),
    course_id: courseId,
  };
  await supabase.from('course_places').insert(newPlace);
  return newPlace as CoursePlace;
}

export async function updateLivePlaces(roomId: string, ownerId: string, places: CoursePlace[]): Promise<void> {
  const courseId = await getLiveCourseId(roomId, ownerId);
  
  // Update order or properties
  for (let i = 0; i < places.length; i++) {
    const p = places[i];
    await supabase.from('course_places').update({
      order_index: i,
      memo: p.memo || '',
    }).eq('id', p.id);
  }
}

export async function deleteLivePlace(roomId: string, ownerId: string, placeId: string): Promise<void> {
  const courseId = await getLiveCourseId(roomId, ownerId);
  await supabase.from('course_places').delete().eq('id', placeId).eq('course_id', courseId);
}

/* ─────────── User Courses (Saved Courses) ─────────── */

export async function getUserCourses(userId: string): Promise<Course[]> {
  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .eq('owner_id', userId)
    .neq('name', LIVE_COURSE_NAME)
    .order('created_at', { ascending: false });

  if (!courses || courses.length === 0) return [];

  const courseIds = courses.map((c) => c.id);
  const { data: places } = await supabase
    .from('course_places')
    .select('*')
    .in('course_id', courseIds)
    .order('order_index', { ascending: true });

  const placesByCourse = (places || []).reduce((acc: any, p: any) => {
    if (!acc[p.course_id]) acc[p.course_id] = [];
    acc[p.course_id].push(p);
    return acc;
  }, {});

  return courses.map((c) => ({
    ...c,
    places: placesByCourse[c.id] || [],
  })) as Course[];
}

export async function getCoursePlaces(courseId: string): Promise<CoursePlace[]> {
  const { data: rows } = await supabase
    .from('course_places')
    .select('*')
    .eq('course_id', courseId)
    .order('order_index', { ascending: true });
  
  return (rows || []) as CoursePlace[];
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
    room_id: null, // Detached from room since it's a permanent snapshot
    name: name,
    description: description
  };
  
  await supabase.from('courses').insert(newCourse);

  // 3. Duplicate places
  if (places && places.length > 0) {
    const newPlaces = places.map((p, index) => ({
      ...p,
      id: uuidv4(),
      course_id: newCourseId,
      order_index: index
    }));
    await supabase.from('course_places').insert(newPlaces);
  }

  return newCourse as unknown as Course;
}

export async function deleteCourse(courseId: string, userId: string): Promise<void> {
  await supabase.from('courses').delete().eq('id', courseId).eq('owner_id', userId);
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

import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'crypto';
import {
  ROOM_EVENT,
  type Connection,
  type Course,
  type CoursePlace,
  type DateSchedule,
  type Memory,
  type PlaceUpdatableFields,
  type Room,
  type RoomMember,
  type User,
} from './types';

// 서버 전용 키(secret / service_role)로 접속합니다. RLS를 우회하므로 절대 클라이언트로 노출하면 안 됩니다.
const serverKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serverKey) {
  console.warn('[db] SUPABASE_SECRET_KEY가 설정되지 않아 공개 키로 접속합니다. RLS를 켜기 전에 반드시 설정하세요.');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  serverKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const LIVE_COURSE_NAME = '__live__';
const PHOTO_BUCKET = 'memories';
const PHOTO_URL_TTL_SECONDS = 60 * 60;
export const SESSION_MAX_AGE_DAYS = 30;
const SESSION_TOUCH_INTERVAL_MS = 60 * 60 * 1000;

/* ─────────── Password & Session Token Hashing ─────────── */

const SCRYPT_PREFIX = 'scrypt';
const SCRYPT_KEYLEN = 64;

function scryptAsync(password: string, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** Format: scrypt$<salt base64>$<key base64> */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT_KEYLEN);
  return `${SCRYPT_PREFIX}$${salt.toString('base64')}$${key.toString('base64')}`;
}

/**
 * Verifies a password against a stored hash.
 * Legacy rows hold an unsalted SHA-256 hex digest; those verify once and are flagged for rehashing.
 */
async function verifyPassword(password: string, stored: string): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (stored.startsWith(`${SCRYPT_PREFIX}$`)) {
    const [, saltB64, keyB64] = stored.split('$');
    const expected = Buffer.from(keyB64, 'base64');
    const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length);
    return { ok: actual.length === expected.length && timingSafeEqual(actual, expected), needsRehash: false };
  }

  const legacy = Buffer.from(createHash('sha256').update(password).digest('hex'));
  const storedBuf = Buffer.from(stored);
  const ok = legacy.length === storedBuf.length && timingSafeEqual(legacy, storedBuf);
  return { ok, needsRehash: ok };
}

/** The raw token lives only in the user's httpOnly cookie; the DB keeps its SHA-256 hash. */
function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(randomBytes(1)[0] % chars.length);
  return code;
}

function generateShareId(): string {
  return randomBytes(9).toString('base64url'); // 12 chars
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/* ─────────── Input sanitizing ─────────── */

function clampText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function clampInt(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function toNumber(value: unknown): number {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/* ─────────── Mapper Functions ─────────── */

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapDbUserToUser(row: any): User {
  return {
    id: row.id,
    nickname: row.nickname,
    createdAt: row.created_at,
    isGuest: !!row.is_guest,
  };
}

function mapDbRoomToRoom(row: any): Room & { members?: RoomMember[] } {
  const room: Room & { members?: RoomMember[] } = {
    id: row.id,
    ownerId: row.owner_id,
    inviteCode: row.invite_code,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
  if (Array.isArray(row.members)) {
    // 마이그레이션 이전의 중복 멤버 행은 화면에 한 번만 보이게 합니다.
    const seen = new Set<string>();
    room.members = row.members
      .map(mapDbRoomMemberToRoomMember)
      .filter((m: RoomMember) => (seen.has(m.userId) ? false : (seen.add(m.userId), true)));
  }
  return room;
}

function mapDbRoomMemberToRoomMember(row: any): RoomMember {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    isOwner: row.is_owner,
    joinedAt: row.joined_at,
    nickname: row.user?.nickname || row.users?.nickname || row.nickname || 'Unknown',
  };
}

function mapDbPlaceToCoursePlace(row: any): CoursePlace {
  return {
    id: row.id,
    title: row.title ?? '',
    category: row.category ?? '',
    address: row.address ?? '',
    roadAddress: row.road_address ?? '',
    mapx: row.mapx ?? 0,
    mapy: row.mapy ?? 0,
    link: row.link ?? '',
    description: row.description ?? '',
    memo: row.memo ?? '',
    order: row.order_index ?? 0,
    day: row.day_index ?? 0,
    isHold: !!row.is_hold,
    reactions: row.reactions || {},
    addedBy: row.added_by ?? '',
    stayMinutes: row.stay_minutes ?? null,
    cost: row.cost ?? null,
    visitedAt: row.visited_at ?? null,
    rating: row.rating ?? null,
    review: row.review ?? '',
    photoUrl: null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Columns written when a place is created (ids are validated separately). */
function placeToInsertRow(p: Partial<CoursePlace>, courseId: string, orderIndex: number, addedBy: string) {
  return {
    id: isUuid(p.id) ? p.id : randomUUID(),
    course_id: courseId,
    title: clampText(p.title, 200),
    category: clampText(p.category, 100),
    address: clampText(p.address, 300),
    road_address: clampText(p.roadAddress, 300),
    mapx: toNumber(p.mapx),
    mapy: toNumber(p.mapy),
    link: clampText(p.link, 500),
    description: clampText(p.description, 1000),
    memo: clampText(p.memo, 1000),
    order_index: orderIndex,
    day_index: clampInt(p.day, 0, 60) ?? 0,
    is_hold: !!p.isHold,
    added_by: clampText(p.addedBy || addedBy, 60),
    reactions: {},
    stay_minutes: clampInt(p.stayMinutes, 0, 1440),
    cost: clampInt(p.cost, 0, 100_000_000),
  };
}

/** Maps PATCH fields to DB columns; unknown fields are dropped. */
function placeFieldsToRow(fields: PlaceUpdatableFields): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ('memo' in fields) row.memo = clampText(fields.memo, 1000);
  if ('isHold' in fields) row.is_hold = !!fields.isHold;
  if ('stayMinutes' in fields) row.stay_minutes = clampInt(fields.stayMinutes, 0, 1440);
  if ('cost' in fields) row.cost = clampInt(fields.cost, 0, 100_000_000);
  if ('visitedAt' in fields) {
    const v = fields.visitedAt;
    row.visited_at = v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null;
  }
  if ('rating' in fields) row.rating = clampInt(fields.rating, 1, 5);
  if ('review' in fields) row.review = clampText(fields.review, 500);
  return row;
}

/* ─────────── Auth (Users & Sessions) ─────────── */

const USER_COLUMNS = 'id, nickname, created_at, is_guest';

/** Issues a new session (one row per device in user_sessions). */
async function startSession(userId: string, userAgent = ''): Promise<string> {
  const sessionToken = generateSessionToken();
  const { error } = await supabase.from('user_sessions').insert({
    user_id: userId,
    token_hash: hashSessionToken(sessionToken),
    user_agent: userAgent.slice(0, 300),
  });
  if (error) throw new Error(`Session start failed: ${error.message}`);
  return sessionToken;
}

export async function registerUser(nickname: string, password: string, userAgent?: string): Promise<{ user: User; sessionToken: string } | null> {
  const hashedPassword = await hashPassword(password);
  const { data, error } = await supabase
    .from('users')
    .insert({ nickname, password: hashedPassword })
    .select(USER_COLUMNS)
    .single();

  if (error) {
    console.error('Register error:', error);
    return null;
  }
  const sessionToken = await startSession(data.id, userAgent);
  return { user: mapDbUserToUser(data), sessionToken };
}

export async function loginUser(nickname: string, password: string, userAgent?: string): Promise<{ user: User; sessionToken: string } | null> {
  const { data, error } = await supabase
    .from('users')
    .select(`${USER_COLUMNS}, password`)
    .eq('nickname', nickname)
    .maybeSingle();

  if (error || !data) return null;

  const { ok, needsRehash } = await verifyPassword(password, data.password);
  if (!ok) return null;

  if (needsRehash) {
    await supabase.from('users').update({ password: await hashPassword(password) }).eq('id', data.id);
  }

  const sessionToken = await startSession(data.id, userAgent);
  return { user: mapDbUserToUser(data), sessionToken };
}

/**
 * Guest accounts have only a nickname. Their password column holds a random hash nobody knows,
 * so they can only sign in through the cookie until they set a password (upgradeGuest).
 */
export async function createGuestUser(nickname: string, userAgent?: string): Promise<{ user: User; sessionToken: string } | null> {
  const unusablePassword = await hashPassword(randomBytes(32).toString('base64url'));
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? nickname : `${nickname}#${1000 + (randomBytes(2).readUInt16BE(0) % 9000)}`;
    const { data, error } = await supabase
      .from('users')
      .insert({ nickname: candidate, password: unusablePassword, is_guest: true })
      .select(USER_COLUMNS)
      .single();
    if (!error && data) {
      const sessionToken = await startSession(data.id, userAgent);
      return { user: mapDbUserToUser(data), sessionToken };
    }
    if (error?.code !== '23505') {
      console.error('Guest create error:', error);
      return null;
    }
  }
  return null;
}

/** Turns a guest into a regular account. Returns an error message, or null on success. */
export async function upgradeGuest(userId: string, nickname: string | null, password: string): Promise<{ user?: User; error?: string }> {
  const update: Record<string, unknown> = { password: await hashPassword(password), is_guest: false };
  if (nickname) update.nickname = nickname;
  const { data, error } = await supabase
    .from('users')
    .update(update)
    .eq('id', userId)
    .eq('is_guest', true)
    .select(USER_COLUMNS)
    .maybeSingle();
  if (error?.code === '23505') return { error: '이미 사용 중인 닉네임입니다.' };
  if (error || !data) return { error: '계정 전환에 실패했습니다.' };
  return { user: mapDbUserToUser(data) };
}

export async function getUserBySessionToken(sessionToken: string): Promise<User | null> {
  const tokenHash = hashSessionToken(sessionToken);
  const { data } = await supabase
    .from('user_sessions')
    .select(`id, last_seen_at, user:users(${USER_COLUMNS})`)
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (!data?.user) return null;

  const lastSeen = Date.parse(data.last_seen_at);
  const age = Date.now() - lastSeen;
  if (age > SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000) {
    await supabase.from('user_sessions').delete().eq('id', data.id);
    return null;
  }
  if (age > SESSION_TOUCH_INTERVAL_MS) {
    await supabase.from('user_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', data.id);
  }
  return mapDbUserToUser(data.user);
}

/** Ends only the session behind this token (other devices stay signed in). */
export async function endSession(sessionToken: string): Promise<void> {
  await supabase.from('user_sessions').delete().eq('token_hash', hashSessionToken(sessionToken));
}

/** Signs the user out everywhere except the device holding keepToken. */
export async function endOtherSessions(userId: string, keepToken: string): Promise<void> {
  await supabase
    .from('user_sessions')
    .delete()
    .eq('user_id', userId)
    .neq('token_hash', hashSessionToken(keepToken));
}

/** Returns false when the current password is wrong. */
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
  const { data } = await supabase.from('users').select('password').eq('id', userId).single();
  if (!data) return false;

  const { ok } = await verifyPassword(currentPassword, data.password);
  if (!ok) return false;

  const { error } = await supabase.from('users').update({ password: await hashPassword(newPassword) }).eq('id', userId);
  return !error;
}

export async function getUserById(userId: string): Promise<User | null> {
  const { data } = await supabase.from('users').select(USER_COLUMNS).eq('id', userId).maybeSingle();
  return data ? mapDbUserToUser(data) : null;
}

/* ─────────── Rooms (Workspaces) ─────────── */

interface NewRoomContent {
  displayName?: string;
  description?: string;
  schedule?: DateSchedule | null;
  places?: Partial<CoursePlace>[];
}

/** Creates a room with its live course, optionally pre-filled (copying a course or a shared link). */
export async function createRoom(ownerId: string, expiresInDays = 30, content: NewRoomContent = {}): Promise<{ room: Room; inviteCode: string }> {
  const roomId = randomUUID();
  let inviteCode = '';
  for (let attempt = 0; attempt < 10; attempt++) {
    inviteCode = generateInviteCode();
    const { data } = await supabase.from('rooms').select('id').eq('invite_code', inviteCode).maybeSingle();
    if (!data) break;
  }

  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const { error: roomError } = await supabase.from('rooms').insert({
    id: roomId,
    invite_code: inviteCode,
    owner_id: ownerId,
    expires_at: expiresAt,
  });
  if (roomError) throw new Error(`Room create failed: ${roomError.message}`);

  // The owner plus everyone they share new courses with automatically (함께하는 사람)
  const { data: autoShare } = await supabase
    .from('user_connections')
    .select('friend_id')
    .eq('user_id', ownerId)
    .eq('auto_share', true);
  const memberRows = [
    { room_id: roomId, user_id: ownerId, is_owner: true },
    ...(autoShare || []).map((c) => ({ room_id: roomId, user_id: c.friend_id as string, is_owner: false })),
  ];
  const { error: memberError } = await supabase.from('room_members').insert(memberRows);
  if (memberError) throw new Error(`Room members insert failed: ${memberError.message}`);

  const liveCourseId = randomUUID();
  await supabase.from('courses').insert({
    id: liveCourseId,
    room_id: roomId,
    owner_id: ownerId,
    name: LIVE_COURSE_NAME,
    display_name: clampText(content.displayName, 100),
    description: clampText(content.description, 500),
    schedule: content.schedule ?? null,
  });

  if (content.places && content.places.length > 0) {
    const owner = await getUserById(ownerId);
    const rows = content.places.map((p, i) =>
      placeToInsertRow({ ...p, id: undefined }, liveCourseId, i, owner?.nickname || '')
    );
    const { error } = await supabase.from('course_places').insert(rows);
    if (error) console.error('Room places copy error:', error);
  }

  const { data: roomData } = await supabase.from('rooms').select('*').eq('id', roomId).single();
  return { room: mapDbRoomToRoom(roomData), inviteCode };
}

export async function getRoomByInviteCode(code: string) {
  const { data } = await supabase
    .from('rooms')
    .select('*, members:room_members(*, user:users(nickname))')
    .eq('invite_code', code)
    .maybeSingle();
  return data ? mapDbRoomToRoom(data) : null;
}

export async function getRoomById(roomId: string) {
  const { data } = await supabase
    .from('rooms')
    .select('*, members:room_members(*, user:users(nickname))')
    .eq('id', roomId)
    .maybeSingle();
  return data ? mapDbRoomToRoom(data) : null;
}

export async function isRoomMember(roomId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('room_members')
    .select('id')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .limit(1);
  return !!data && data.length > 0;
}

/** Returns true when the user was newly added. */
export async function joinRoom(roomId: string, userId: string): Promise<boolean> {
  if (await isRoomMember(roomId, userId)) return false;
  const { error } = await supabase.from('room_members').insert({ room_id: roomId, user_id: userId, is_owner: false });
  // 23505: (room_id, user_id) 유니크 제약 — 동시에 두 번 참여한 경우라 무시합니다.
  if (error && error.code !== '23505') throw new Error(`Join failed: ${error.message}`);
  return !error;
}

/** Removes a non-owner member. Returns true when someone was removed. */
export async function removeRoomMember(roomId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('room_members')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .eq('is_owner', false)
    .select('id');
  if (error) throw new Error(`Member remove failed: ${error.message}`);
  return !!data && data.length > 0;
}

/* ─────────── Connections (함께하는 사람) ─────────── */

const CONNECTION_INVITE_TTL_DAYS = 7;

export async function listConnections(userId: string): Promise<Connection[]> {
  const { data, error } = await supabase
    .from('user_connections')
    .select('friend_id, auto_share, created_at, friend:users!user_connections_friend_fkey(nickname, is_guest)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Connections fetch failed: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data || []).map((r: any) => {
    const friend = Array.isArray(r.friend) ? r.friend[0] : r.friend;
    return {
      userId: r.friend_id,
      nickname: friend?.nickname || 'Unknown',
      isGuest: !!friend?.is_guest,
      autoShare: !!r.auto_share,
      connectedAt: r.created_at,
    };
  });
}

export async function areConnected(userId: string, friendId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_connections')
    .select('id')
    .eq('user_id', userId)
    .eq('friend_id', friendId)
    .limit(1);
  return !!data && data.length > 0;
}

/** Connects two users both ways. Existing connections keep their settings. */
async function connectUsers(a: string, b: string, autoShare: boolean): Promise<void> {
  if (a === b) return;
  const { error } = await supabase.from('user_connections').upsert(
    [
      { user_id: a, friend_id: b, auto_share: autoShare },
      { user_id: b, friend_id: a, auto_share: autoShare },
    ],
    { onConflict: 'user_id,friend_id', ignoreDuplicates: true }
  );
  if (error) throw new Error(`Connect failed: ${error.message}`);
}

export async function setConnectionAutoShare(userId: string, friendId: string, autoShare: boolean): Promise<boolean> {
  const { data } = await supabase
    .from('user_connections')
    .update({ auto_share: autoShare })
    .eq('user_id', userId)
    .eq('friend_id', friendId)
    .select('id');
  return !!data && data.length > 0;
}

/**
 * Removes the connection both ways and takes the other person out of every course the user owns.
 * Returns the affected room ids so the caller can notify open clients.
 */
export async function disconnectUsers(userId: string, friendId: string): Promise<string[]> {
  if (!isUuid(userId) || !isUuid(friendId)) return [];
  await supabase
    .from('user_connections')
    .delete()
    .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);

  const { data: owned } = await supabase.from('rooms').select('id').eq('owner_id', userId);
  const ownedIds = (owned || []).map((r) => r.id as string);
  if (ownedIds.length === 0) return [];
  const { data: removed } = await supabase
    .from('room_members')
    .delete()
    .eq('user_id', friendId)
    .eq('is_owner', false)
    .in('room_id', ownedIds)
    .select('room_id');
  return Array.from(new Set((removed || []).map((r) => r.room_id as string)));
}

/** A one-time invite link (7 days). With roomId, accepting it also joins that course. */
export async function createConnectionInvite(inviterId: string, roomId: string | null): Promise<{ code: string; expiresAt: string }> {
  await supabase.from('connection_invites').delete().eq('inviter_id', inviterId).lt('expires_at', new Date().toISOString());

  let code = '';
  for (let attempt = 0; attempt < 10; attempt++) {
    code = generateInviteCode();
    // Course codes and invite codes share one input box, so a code must be unique across both
    const [{ data: invite }, { data: room }] = await Promise.all([
      supabase.from('connection_invites').select('code').eq('code', code).maybeSingle(),
      supabase.from('rooms').select('id').eq('invite_code', code).maybeSingle(),
    ]);
    if (!invite && !room) break;
  }
  const expiresAt = new Date(Date.now() + CONNECTION_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from('connection_invites').insert({
    code,
    inviter_id: inviterId,
    room_id: roomId,
    expires_at: expiresAt,
  });
  if (error) throw new Error(`Invite create failed: ${error.message}`);
  return { code, expiresAt };
}

/** Whether a code can still be redeemed (used to allow guest sign-up from an invite link). */
export async function isInviteUsable(code: string): Promise<boolean> {
  const { data: invite } = await supabase
    .from('connection_invites')
    .select('used_by, expires_at')
    .eq('code', code)
    .maybeSingle();
  if (invite) return !invite.used_by && Date.parse(invite.expires_at) > Date.now();
  const { data: room } = await supabase.from('rooms').select('expires_at').eq('invite_code', code).maybeSingle();
  return !!room && (!room.expires_at || Date.parse(room.expires_at) > Date.now());
}

export type AcceptInviteResult =
  | {
      ok: true;
      /** The inviter (or the course owner for an old per-course code); null when it was the user's own link */
      friend: { userId: string; nickname: string } | null;
      roomId: string | null;
      joinedRoom: boolean;
      ownInvite: boolean;
    }
  | { ok: false; status: number; error: string };

/**
 * Redeems an invite code: a one-time connection invite (connects both users and, when the invite
 * carries a course, joins it), or an old per-course code (joins the course and connects with its
 * owner with automatic sharing off, because those codes could be passed around).
 */
export async function acceptInvite(code: string, userId: string): Promise<AcceptInviteResult> {
  const { data: invite } = await supabase.from('connection_invites').select('*').eq('code', code).maybeSingle();
  if (invite) {
    if (invite.inviter_id === userId) {
      return { ok: true, friend: null, roomId: invite.room_id, joinedRoom: false, ownInvite: true };
    }
    if (invite.used_by && invite.used_by !== userId) {
      return { ok: false, status: 410, error: '이미 사용된 초대 링크예요. 새 링크를 받아주세요.' };
    }
    if (!invite.used_by) {
      if (Date.parse(invite.expires_at) < Date.now()) {
        return { ok: false, status: 410, error: '만료된 초대 링크예요. 새 링크를 받아주세요.' };
      }
      // Claim it in one conditional update so two people can't both use it
      const { data: claimed } = await supabase
        .from('connection_invites')
        .update({ used_by: userId, used_at: new Date().toISOString() })
        .eq('code', code)
        .is('used_by', null)
        .select('code');
      if (!claimed || claimed.length === 0) {
        return { ok: false, status: 410, error: '이미 사용된 초대 링크예요. 새 링크를 받아주세요.' };
      }
    }
    await connectUsers(invite.inviter_id, userId, true);
    const inviter = await getUserById(invite.inviter_id);
    let roomId: string | null = null;
    let joinedRoom = false;
    if (invite.room_id && (await isRoomMember(invite.room_id, invite.inviter_id))) {
      roomId = invite.room_id;
      joinedRoom = await joinRoom(invite.room_id, userId);
    }
    return {
      ok: true,
      friend: inviter ? { userId: inviter.id, nickname: inviter.nickname } : null,
      roomId,
      joinedRoom,
      ownInvite: false,
    };
  }

  const { data: room } = await supabase.from('rooms').select('id, owner_id, expires_at').eq('invite_code', code).maybeSingle();
  if (!room) return { ok: false, status: 404, error: '유효하지 않은 초대코드예요.' };
  if (room.expires_at && Date.parse(room.expires_at) < Date.now()) {
    return { ok: false, status: 410, error: '만료된 초대코드예요.' };
  }
  const joinedRoom = await joinRoom(room.id, userId);
  const own = room.owner_id === userId;
  if (!own) {
    // Joining the course is what matters here; a failed connection shouldn't undo it
    await connectUsers(room.owner_id, userId, false).catch((err) => console.error('Connect after join failed:', err));
  }
  const owner = own ? null : await getUserById(room.owner_id);
  return {
    ok: true,
    friend: owner ? { userId: owner.id, nickname: owner.nickname } : null,
    roomId: room.id,
    joinedRoom,
    ownInvite: own,
  };
}

/* ─────────── Live Courses (Room-based, shared) ─────────── */

/**
 * Gets or creates the live course for a room. All members of the room share the same live course.
 * The live course is identified by name='__live__' and room_id=roomId.
 */
export async function getLiveCourseId(roomId: string): Promise<string> {
  const { data: existing } = await supabase
    .from('courses')
    .select('id')
    .eq('name', LIVE_COURSE_NAME)
    .eq('room_id', roomId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: room } = await supabase.from('rooms').select('owner_id').eq('id', roomId).single();
  const courseId = randomUUID();
  const { error } = await supabase.from('courses').insert({
    id: courseId,
    room_id: roomId,
    owner_id: room?.owner_id,
    name: LIVE_COURSE_NAME,
  });
  if (error) console.error('Live course creation error:', error);
  return courseId;
}

async function touchLiveCourse(courseId: string) {
  await supabase.from('courses').update({ updated_at: new Date().toISOString() }).eq('id', courseId);
}

async function signPhotoUrls(rows: { id: string; photo_path?: string | null }[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const withPhoto = rows.filter((r) => r.photo_path);
  if (withPhoto.length === 0) return urls;
  const { data } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(withPhoto.map((r) => r.photo_path as string), PHOTO_URL_TTL_SECONDS);
  (data || []).forEach((item, i) => {
    if (item.signedUrl) urls.set(withPhoto[i].id, item.signedUrl);
  });
  return urls;
}

export async function getLivePlaces(roomId: string): Promise<CoursePlace[]> {
  const courseId = await getLiveCourseId(roomId);
  const { data: rows } = await supabase
    .from('course_places')
    .select('*')
    .eq('course_id', courseId)
    .order('order_index', { ascending: true });

  const list = rows || [];
  const photoUrls = await signPhotoUrls(list);
  return list.map((row) => ({ ...mapDbPlaceToCoursePlace(row), photoUrl: photoUrls.get(row.id) ?? null }));
}

export async function getLiveCourseDetails(roomId: string): Promise<{ displayName: string; description: string; id: string; schedule: DateSchedule | null; aiHistory: unknown | null } | null> {
  const { data } = await supabase
    .from('courses')
    .select('id, display_name, description, schedule, ai_history')
    .eq('name', LIVE_COURSE_NAME)
    .eq('room_id', roomId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    displayName: data.display_name || '',
    description: data.description || '',
    schedule: data.schedule ?? null,
    aiHistory: data.ai_history ?? null,
  };
}

function sanitizeSchedule(value: unknown): DateSchedule | null {
  if (!value || typeof value !== 'object') return null;
  const s = value as Record<string, unknown>;
  const date = /^\d{4}-\d{2}-\d{2}$/;
  const time = /^\d{2}:\d{2}$/;
  if (typeof s.startDate !== 'string' || !date.test(s.startDate)) return null;
  const endDate = typeof s.endDate === 'string' && date.test(s.endDate) ? s.endDate : s.startDate;
  return {
    startDate: s.startDate,
    endDate: endDate < s.startDate ? s.startDate : endDate,
    startTime: typeof s.startTime === 'string' && time.test(s.startTime) ? s.startTime : '12:00',
    endTime: typeof s.endTime === 'string' && time.test(s.endTime) ? s.endTime : '22:00',
  };
}

/** Returns the schedule as stored (sanitized). */
export async function saveLiveSchedule(roomId: string, schedule: unknown): Promise<DateSchedule | null> {
  const clean = sanitizeSchedule(schedule);
  const { error } = await supabase
    .from('courses')
    .update({ schedule: clean, updated_at: new Date().toISOString() })
    .eq('room_id', roomId)
    .eq('name', LIVE_COURSE_NAME);
  if (error) console.error('Save schedule error:', error);
  return clean;
}

export async function saveLiveAiHistory(roomId: string, aiHistory: unknown): Promise<void> {
  const { error } = await supabase
    .from('courses')
    .update({ ai_history: aiHistory })
    .eq('room_id', roomId)
    .eq('name', LIVE_COURSE_NAME);
  if (error) console.error('Save AI history error:', error);
}

/**
 * Inserts places with client-generated ids. Re-sending the same id is a no-op (safe retries),
 * and an id that already belongs to another course is ignored rather than overwritten.
 */
export async function insertLivePlaces(roomId: string, places: Partial<CoursePlace>[], addedBy: string): Promise<CoursePlace[]> {
  if (places.length === 0) return [];
  const courseId = await getLiveCourseId(roomId);
  const rows = places.slice(0, 50).map((p, i) => placeToInsertRow(p, courseId, typeof p.order === 'number' ? p.order : i, addedBy));
  const { error } = await supabase.from('course_places').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw new Error(`Insert places failed: ${error.message}`);
  await touchLiveCourse(courseId);
  return rows.map(mapDbPlaceToCoursePlace);
}

export async function deleteLivePlaces(roomId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const courseId = await getLiveCourseId(roomId);
  const { data, error } = await supabase
    .from('course_places')
    .delete()
    .eq('course_id', courseId)
    .in('id', ids.slice(0, 200))
    .select('title, photo_path');
  if (error) throw new Error(`Delete places failed: ${error.message}`);
  const photoPaths = (data || []).map((r) => r.photo_path).filter(Boolean) as string[];
  if (photoPaths.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(photoPaths);
  await touchLiveCourse(courseId);
  return (data || []).map((r) => r.title);
}

export async function updateLivePlace(roomId: string, placeId: string, fields: PlaceUpdatableFields): Promise<CoursePlace | null> {
  const row = placeFieldsToRow(fields);
  if (Object.keys(row).length === 0) return null;
  const courseId = await getLiveCourseId(roomId);
  const { data, error } = await supabase
    .from('course_places')
    .update(row)
    .eq('course_id', courseId)
    .eq('id', placeId)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`Update place failed: ${error.message}`);
  return data ? mapDbPlaceToCoursePlace(data) : null;
}

const ALLOWED_REACTIONS = new Set(['❤️', '👍', '🤔', '❌']);

/** Sets (or clears, with null) one user's reaction without touching the others'. */
export async function setLivePlaceReaction(roomId: string, placeId: string, userId: string, emoji: string | null): Promise<CoursePlace | null> {
  if (emoji !== null && !ALLOWED_REACTIONS.has(emoji)) return null;
  const courseId = await getLiveCourseId(roomId);
  const { data: current } = await supabase
    .from('course_places')
    .select('reactions')
    .eq('course_id', courseId)
    .eq('id', placeId)
    .maybeSingle();
  if (!current) return null;
  const reactions: Record<string, string> = { ...(current.reactions || {}) };
  if (emoji) reactions[userId] = emoji;
  else delete reactions[userId];
  const { data, error } = await supabase
    .from('course_places')
    .update({ reactions })
    .eq('course_id', courseId)
    .eq('id', placeId)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`Reaction failed: ${error.message}`);
  return data ? mapDbPlaceToCoursePlace(data) : null;
}

/**
 * Applies a full ordering (and day assignment). Ids that are not in this course are skipped,
 * so a stale client can neither resurrect deleted places nor touch another course's rows.
 */
export async function reorderLivePlaces(roomId: string, order: { id: string; day: number }[]): Promise<void> {
  const courseId = await getLiveCourseId(roomId);
  const { data: existing } = await supabase.from('course_places').select('id').eq('course_id', courseId);
  const known = new Set((existing || []).map((r) => r.id));
  const rows = order
    .filter((o) => known.has(o.id))
    .map((o, i) => ({ id: o.id, course_id: courseId, order_index: i, day_index: clampInt(o.day, 0, 60) ?? 0 }));
  if (rows.length === 0) return;
  const { error } = await supabase.from('course_places').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`Reorder failed: ${error.message}`);
  await touchLiveCourse(courseId);
}

/** Uploads (replacing) the memory photo of a place. Returns a signed URL. */
export async function setLivePlacePhoto(roomId: string, placeId: string, file: { bytes: Uint8Array; contentType: string } | null): Promise<string | null> {
  const courseId = await getLiveCourseId(roomId);
  const { data: current } = await supabase
    .from('course_places')
    .select('photo_path')
    .eq('course_id', courseId)
    .eq('id', placeId)
    .maybeSingle();
  if (!current) throw new Error('Place not found');

  let newPath: string | null = null;
  if (file) {
    const ext = file.contentType === 'image/png' ? 'png' : file.contentType === 'image/webp' ? 'webp' : 'jpg';
    newPath = `${roomId}/${placeId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(newPath, file.bytes, { contentType: file.contentType, upsert: false });
    if (error) throw new Error(`Photo upload failed: ${error.message}`);
  }

  const { error: updateError } = await supabase
    .from('course_places')
    .update({ photo_path: newPath })
    .eq('course_id', courseId)
    .eq('id', placeId);
  if (updateError) throw new Error(`Photo save failed: ${updateError.message}`);
  if (current.photo_path) await supabase.storage.from(PHOTO_BUCKET).remove([current.photo_path]);

  if (!newPath) return null;
  const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(newPath, PHOTO_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

/* ─────────── Sharing (read-only public links) ─────────── */

export async function getOrCreateShareId(roomId: string): Promise<string> {
  const { data } = await supabase
    .from('courses')
    .select('id, share_id')
    .eq('room_id', roomId)
    .eq('name', LIVE_COURSE_NAME)
    .maybeSingle();
  if (data?.share_id) return data.share_id;
  const courseId = data?.id ?? (await getLiveCourseId(roomId));

  for (let attempt = 0; attempt < 5; attempt++) {
    const shareId = generateShareId();
    const { error } = await supabase.from('courses').update({ share_id: shareId }).eq('id', courseId).is('share_id', null);
    if (!error) {
      const { data: after } = await supabase.from('courses').select('share_id').eq('id', courseId).single();
      if (after?.share_id) return after.share_id;
    } else if (error.code !== '23505') {
      throw new Error(`Share id failed: ${error.message}`);
    }
  }
  throw new Error('Share id failed');
}

export interface SharedCourse {
  shareId: string;
  name: string;
  description: string;
  schedule: DateSchedule | null;
  places: CoursePlace[];
  updatedAt: string;
}

/** Public view of a course: no memos, reactions, reviews or photos. */
export async function getSharedCourse(shareId: string): Promise<SharedCourse | null> {
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(shareId)) return null;
  const { data: course } = await supabase
    .from('courses')
    .select('id, display_name, description, schedule, updated_at')
    .eq('share_id', shareId)
    .maybeSingle();
  if (!course) return null;

  const { data: rows } = await supabase
    .from('course_places')
    .select('id, title, category, address, road_address, mapx, mapy, link, order_index, day_index, stay_minutes')
    .eq('course_id', course.id)
    .order('order_index', { ascending: true });

  const places = (rows || []).map((r) => ({
    ...mapDbPlaceToCoursePlace(r),
    memo: '',
    reactions: {},
    review: '',
  }));

  return {
    shareId,
    name: course.display_name || '데이트 코스',
    description: course.description || '',
    schedule: course.schedule ?? null,
    places,
    updatedAt: course.updated_at,
  };
}

/* ─────────── User Courses (Saved + Collaborative) ─────────── */

/**
 * Retrieves all courses visible to the user:
 * 1. Saved courses owned by the user (where name != __live__)
 * 2. Live courses from rooms the user has participated in (unsaved collaborative routes)
 */
export async function getUserCoursesWithCollaborative(userId: string): Promise<Course[]> {
  const { data: ownedCourses } = await supabase
    .from('courses')
    .select('*')
    .eq('owner_id', userId)
    .neq('name', LIVE_COURSE_NAME)
    .order('created_at', { ascending: false });

  const { data: memberships } = await supabase
    .from('room_members')
    .select('room_id')
    .eq('user_id', userId);

  const roomIds = Array.from(new Set((memberships || []).map((m) => m.room_id)));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let liveCourses: any[] = [];
  if (roomIds.length > 0) {
    const { data: roomLiveCourses } = await supabase
      .from('courses')
      .select('*')
      .eq('name', LIVE_COURSE_NAME)
      .in('room_id', roomIds);
    liveCourses = roomLiveCourses || [];
  }

  const allCourses = [...(ownedCourses || []), ...liveCourses];
  if (allCourses.length === 0) return [];

  const courseIds = allCourses.map((c) => c.id);
  const { data: places } = await supabase
    .from('course_places')
    .select('*')
    .in('course_id', courseIds)
    .order('order_index', { ascending: true });

  const placesByCourse: Record<string, CoursePlace[]> = {};
  for (const p of places || []) {
    (placesByCourse[p.course_id] ||= []).push(mapDbPlaceToCoursePlace(p));
  }

  const memberCountByRoom: Record<string, number> = {};
  if (roomIds.length > 0) {
    const { data: allMembers } = await supabase
      .from('room_members')
      .select('room_id, user_id')
      .in('room_id', roomIds);
    const unique = new Set<string>();
    for (const m of allMembers || []) {
      const key = `${m.room_id}-${m.user_id}`;
      if (unique.has(key)) continue;
      unique.add(key);
      memberCountByRoom[m.room_id] = (memberCountByRoom[m.room_id] || 0) + 1;
    }
  }

  const result: Course[] = (ownedCourses || []).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description || '',
    places: placesByCourse[c.id] || [],
    roomId: c.room_id || undefined,
    schedule: c.schedule ?? undefined,
    isCollaborative: false,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));

  const otherOwnerIds = Array.from(new Set(liveCourses.map((c) => c.owner_id).filter((id) => id && id !== userId)));
  const ownerNicknames = new Map<string, string>();
  if (otherOwnerIds.length > 0) {
    const { data: owners } = await supabase.from('users').select('id, nickname').in('id', otherOwnerIds);
    for (const o of owners || []) ownerNicknames.set(o.id, o.nickname);
  }

  for (const c of liveCourses) {
    const memberCount = memberCountByRoom[c.room_id] || 1;
    const isMine = c.owner_id === userId;
    result.push({
      id: c.id,
      name: '저장되지 않은 경로',
      displayName: c.display_name || '',
      description: c.description || '',
      places: placesByCourse[c.id] || [],
      roomId: c.room_id,
      schedule: c.schedule ?? undefined,
      isLive: true,
      isCollaborative: memberCount > 1,
      memberCount,
      isMine,
      ownerNickname: isMine ? undefined : ownerNicknames.get(c.owner_id),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    });
  }

  result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return result;
}

/** A saved (non-live) course owned by the user, used to start a new room from it. */
export async function getOwnedSavedCourse(userId: string, courseId: string): Promise<NewRoomContent | null> {
  const { data: course } = await supabase
    .from('courses')
    .select('id, name, description, schedule')
    .eq('id', courseId)
    .eq('owner_id', userId)
    .neq('name', LIVE_COURSE_NAME)
    .maybeSingle();
  if (!course) return null;
  const { data: rows } = await supabase
    .from('course_places')
    .select('*')
    .eq('course_id', course.id)
    .order('order_index', { ascending: true });
  return {
    displayName: course.name,
    description: course.description || '',
    schedule: course.schedule ?? null,
    places: (rows || []).map(mapDbPlaceToCoursePlace),
  };
}

/**
 * Removes a course from the user's dashboard.
 * - Saved snapshots are deleted.
 * - A live course deleted by the person who created it is deleted for everyone.
 * - Anyone else just leaves it (and it is deleted once nobody is left).
 * Returns the room and the members who lost access, so open clients can be told.
 */
export async function deleteCourse(courseId: string, userId: string): Promise<{ roomId: string; removedUserIds: string[] } | null> {
  const { data: course } = await supabase.from('courses').select('id, name, room_id, owner_id').eq('id', courseId).maybeSingle();
  if (!course) return null;

  if (course.name !== LIVE_COURSE_NAME) {
    if (course.owner_id === userId) await supabase.from('courses').delete().eq('id', courseId);
    return null;
  }
  if (!course.room_id) return null;
  const roomId = course.room_id as string;

  const deleteRoom = async () => {
    const { data: photos } = await supabase.from('course_places').select('photo_path').eq('course_id', courseId).not('photo_path', 'is', null);
    const paths = (photos || []).map((p) => p.photo_path).filter(Boolean) as string[];
    if (paths.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(paths);
    await supabase.from('rooms').delete().eq('id', roomId);
  };

  const { data: room } = await supabase.from('rooms').select('owner_id').eq('id', roomId).maybeSingle();
  if (room?.owner_id === userId) {
    const { data: others } = await supabase.from('room_members').select('user_id').eq('room_id', roomId).neq('user_id', userId);
    await deleteRoom();
    return { roomId, removedUserIds: Array.from(new Set((others || []).map((m) => m.user_id as string))) };
  }

  await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', userId);
  const { count } = await supabase
    .from('room_members')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId);
  if ((count ?? 0) === 0) await deleteRoom();
  return null;
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
export async function updateLiveCourseName(roomId: string, displayName: string, description: string): Promise<boolean> {
  const { error } = await supabase
    .from('courses')
    .update({
      display_name: displayName.slice(0, 100),
      description: description.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq('room_id', roomId)
    .eq('name', LIVE_COURSE_NAME);
  return !error;
}

/* ─────────── Memories ─────────── */

export async function getUserMemories(userId: string): Promise<Memory[]> {
  const { data: memberships } = await supabase.from('room_members').select('room_id').eq('user_id', userId);
  const roomIds = Array.from(new Set((memberships || []).map((m) => m.room_id)));
  if (roomIds.length === 0) return [];

  const { data: courses } = await supabase
    .from('courses')
    .select('id, room_id, display_name')
    .eq('name', LIVE_COURSE_NAME)
    .in('room_id', roomIds);
  if (!courses || courses.length === 0) return [];
  const courseById = new Map(courses.map((c) => [c.id, c]));

  const { data: rows } = await supabase
    .from('course_places')
    .select('id, course_id, title, address, road_address, day_index, visited_at, rating, review, photo_path')
    .in('course_id', courses.map((c) => c.id))
    .or('rating.not.is.null,photo_path.not.is.null,review.neq.')
    .order('visited_at', { ascending: false, nullsFirst: false })
    .limit(200);

  const list = rows || [];
  const photoUrls = await signPhotoUrls(list);
  return list.map((r) => {
    const course = courseById.get(r.course_id);
    return {
      roomId: course?.room_id ?? '',
      courseName: course?.display_name || '이름 없는 코스',
      placeId: r.id,
      title: r.title,
      address: r.road_address || r.address || '',
      day: r.day_index ?? 0,
      visitedAt: r.visited_at,
      rating: r.rating,
      review: r.review || '',
      photoUrl: photoUrls.get(r.id) ?? null,
    };
  });
}

/* ─────────── Realtime Events ─────────── */

export interface EventSender {
  userId: string;
  nickname: string;
  clientId?: string | null;
}

/**
 * Sends a room event over Supabase Realtime Broadcast (REST, no subscription needed).
 * Clients listen on channel `session-<roomId>` and ignore events carrying their own clientId.
 */
export async function broadcastRoomEvent(roomId: string, type: string, data: unknown, sender: EventSender) {
  if (!roomId) return;
  const channel = supabase.channel(`session-${roomId}`);
  try {
    const result = await channel.httpSend(ROOM_EVENT, {
      type,
      data,
      sender: sender.nickname,
      senderId: sender.userId,
      clientId: sender.clientId ?? null,
    });
    if (!result.success) console.error('Broadcast error:', result.status, result.error);
  } catch (err) {
    console.error('Broadcast error:', err);
  } finally {
    await supabase.removeChannel(channel);
  }
}

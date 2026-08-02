import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import type { Course, CoursePlace, Session, SessionMember } from './types';

/* ─────────── DB Singleton ─────────── */

let _db: Database.Database | null = null;

function getDbPath(): string {
  // Store DB file in project root /data directory
  return path.join(process.cwd(), 'data', 'datingroute.db');
}

export function getDb(): Database.Database {
  if (_db) return _db;

  const dbPath = getDbPath();

  // Ensure the data directory exists
  const fs = require('fs');
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  initSchema(_db);
  return _db;
}

/* ─────────── Schema ─────────── */

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      invite_code TEXT UNIQUE NOT NULL,
      owner_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      is_personal INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS session_members (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      nickname TEXT NOT NULL DEFAULT '',
      joined_at TEXT NOT NULL,
      is_owner INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS course_places (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      road_address TEXT NOT NULL DEFAULT '',
      mapx REAL NOT NULL DEFAULT 0,
      mapy REAL NOT NULL DEFAULT 0,
      link TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      memo TEXT NOT NULL DEFAULT '',
      order_index INTEGER NOT NULL DEFAULT 0,
      added_by TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_courses_session ON courses(session_id);
    CREATE INDEX IF NOT EXISTS idx_places_course ON course_places(course_id);
    CREATE INDEX IF NOT EXISTS idx_members_session ON session_members(session_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_invite ON sessions(invite_code);
  `);
}

/* ─────────── Invite Code Generation ─────────── */

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 for clarity
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateUniqueInviteCode(db: Database.Database): string {
  const check = db.prepare('SELECT 1 FROM sessions WHERE invite_code = ?');
  let code: string;
  let attempts = 0;
  do {
    code = generateInviteCode();
    attempts++;
    if (attempts > 100) throw new Error('Cannot generate unique invite code');
  } while (check.get(code));
  return code;
}

/* ─────────── Session CRUD ─────────── */

export function createSession(
  ownerName: string,
  isPersonal: boolean,
  expiresInDays: number = 30
): { session: Session; memberId: string } {
  const db = getDb();
  const sessionId = uuidv4();
  const memberId = uuidv4();
  const inviteCode = generateUniqueInviteCode(db);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const insertSession = db.prepare(`
    INSERT INTO sessions (id, invite_code, owner_name, created_at, expires_at, is_personal)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMember = db.prepare(`
    INSERT INTO session_members (id, session_id, nickname, joined_at, is_owner)
    VALUES (?, ?, ?, ?, 1)
  `);

  db.transaction(() => {
    insertSession.run(sessionId, inviteCode, ownerName, now, expiresAt, isPersonal ? 1 : 0);
    insertMember.run(memberId, sessionId, ownerName, now);
  })();

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

export function getSessionByInviteCode(code: string): Session | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sessions WHERE invite_code = ?').get(code) as any;
  if (!row) return null;

  // Check expiry
  if (new Date(row.expires_at) < new Date()) return null;

  const members = getSessionMembers(row.id);
  return {
    id: row.id,
    inviteCode: row.invite_code,
    ownerName: row.owner_name,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isPersonal: !!row.is_personal,
    members,
  };
}

export function getSessionById(sessionId: string): Session | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as any;
  if (!row) return null;

  const members = getSessionMembers(row.id);
  return {
    id: row.id,
    inviteCode: row.invite_code,
    ownerName: row.owner_name,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isPersonal: !!row.is_personal,
    members,
  };
}

export function getSessionMembers(sessionId: string): SessionMember[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM session_members WHERE session_id = ?').all(sessionId) as any[];
  return rows.map((r) => ({
    id: r.id,
    sessionId: r.session_id,
    nickname: r.nickname,
    joinedAt: r.joined_at,
    isOwner: !!r.is_owner,
  }));
}

export function joinSession(sessionId: string, nickname: string): SessionMember {
  const db = getDb();
  const memberId = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO session_members (id, session_id, nickname, joined_at, is_owner)
    VALUES (?, ?, ?, ?, 0)
  `).run(memberId, sessionId, nickname, now);

  return {
    id: memberId,
    sessionId,
    nickname,
    joinedAt: now,
    isOwner: false,
  };
}

export function deleteSession(sessionId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

/* ─────────── Course CRUD ─────────── */

export function createCourse(
  sessionId: string,
  name: string,
  description: string,
  places: CoursePlace[],
  addedBy: string = ''
): Course {
  const db = getDb();
  const courseId = uuidv4();
  const now = new Date().toISOString();

  const insertCourse = db.prepare(`
    INSERT INTO courses (id, session_id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertPlace = db.prepare(`
    INSERT INTO course_places (id, course_id, title, category, address, road_address, mapx, mapy, link, description, memo, order_index, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    insertCourse.run(courseId, sessionId, name, description, now, now);
    places.forEach((p, i) => {
      insertPlace.run(
        p.id || uuidv4(), courseId,
        p.title, p.category, p.address, p.roadAddress,
        p.mapx, p.mapy, p.link, p.description, p.memo,
        i, addedBy
      );
    });
  })();

  return {
    id: courseId,
    name,
    description,
    places,
    createdAt: now,
    updatedAt: now,
  };
}

export function getCoursesBySession(sessionId: string): Course[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM courses WHERE session_id = ? ORDER BY created_at DESC').all(sessionId) as any[];

  return rows.map((r) => {
    const places = getCoursePlaces(r.id);
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      places,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

export function getCourseById(courseId: string): Course | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId) as any;
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    places: getCoursePlaces(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getCoursePlaces(courseId: string): CoursePlace[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM course_places WHERE course_id = ? ORDER BY order_index'
  ).all(courseId) as any[];

  return rows.map((r) => ({
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

export function updateCourse(
  courseId: string,
  data: { name?: string; description?: string; places?: CoursePlace[] },
  addedBy: string = ''
): Course | null {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId) as any;
  if (!existing) return null;

  db.transaction(() => {
    if (data.name !== undefined || data.description !== undefined) {
      db.prepare(`
        UPDATE courses SET name = ?, description = ?, updated_at = ? WHERE id = ?
      `).run(
        data.name ?? existing.name,
        data.description ?? existing.description,
        now, courseId
      );
    }

    if (data.places) {
      db.prepare('DELETE FROM course_places WHERE course_id = ?').run(courseId);
      const insertPlace = db.prepare(`
        INSERT INTO course_places (id, course_id, title, category, address, road_address, mapx, mapy, link, description, memo, order_index, added_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      data.places.forEach((p, i) => {
        insertPlace.run(
          p.id || uuidv4(), courseId,
          p.title, p.category, p.address, p.roadAddress,
          p.mapx, p.mapy, p.link, p.description, p.memo,
          i, (p as any).addedBy || addedBy
        );
      });

      db.prepare('UPDATE courses SET updated_at = ? WHERE id = ?').run(now, courseId);
    }
  })();

  return getCourseById(courseId);
}

export function deleteCourseDb(courseId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM courses WHERE id = ?').run(courseId);
}

/* ─────────── Live Places (session-level working set) ─────────── */
// These are the "current" places being worked on in a session,
// stored as a special course named "__live__"

const LIVE_COURSE_NAME = '__live__';

export function getLiveCourseId(sessionId: string): string {
  const db = getDb();
  const row = db.prepare(
    "SELECT id FROM courses WHERE session_id = ? AND name = ?"
  ).get(sessionId, LIVE_COURSE_NAME) as any;

  if (row) return row.id;

  // Create live course if it doesn't exist
  const courseId = uuidv4();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO courses (id, session_id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, '', ?, ?)
  `).run(courseId, sessionId, LIVE_COURSE_NAME, now, now);

  return courseId;
}

export function getLivePlaces(sessionId: string): CoursePlace[] {
  const courseId = getLiveCourseId(sessionId);
  return getCoursePlaces(courseId);
}

export function addLivePlace(sessionId: string, place: CoursePlace, addedBy: string = ''): CoursePlace[] {
  const db = getDb();
  const courseId = getLiveCourseId(sessionId);

  // Get current max order
  const maxRow = db.prepare(
    'SELECT MAX(order_index) as mx FROM course_places WHERE course_id = ?'
  ).get(courseId) as any;
  const nextOrder = (maxRow?.mx ?? -1) + 1;

  db.prepare(`
    INSERT INTO course_places (id, course_id, title, category, address, road_address, mapx, mapy, link, description, memo, order_index, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    place.id || uuidv4(), courseId,
    place.title, place.category, place.address, place.roadAddress,
    place.mapx, place.mapy, place.link, place.description, place.memo,
    nextOrder, addedBy
  );

  db.prepare('UPDATE courses SET updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), courseId);

  return getCoursePlaces(courseId);
}

export function removeLivePlace(sessionId: string, placeId: string): CoursePlace[] {
  const db = getDb();
  const courseId = getLiveCourseId(sessionId);

  db.prepare('DELETE FROM course_places WHERE id = ? AND course_id = ?')
    .run(placeId, courseId);

  // Re-index remaining places
  const remaining = getCoursePlaces(courseId);
  const updateOrder = db.prepare('UPDATE course_places SET order_index = ? WHERE id = ?');
  db.transaction(() => {
    remaining.forEach((p, i) => {
      updateOrder.run(i, p.id);
    });
  })();

  db.prepare('UPDATE courses SET updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), courseId);

  return getCoursePlaces(courseId);
}

export function reorderLivePlaces(sessionId: string, placeIds: string[]): CoursePlace[] {
  const db = getDb();
  const courseId = getLiveCourseId(sessionId);

  const updateOrder = db.prepare('UPDATE course_places SET order_index = ? WHERE id = ? AND course_id = ?');
  db.transaction(() => {
    placeIds.forEach((id, i) => {
      updateOrder.run(i, id, courseId);
    });
  })();

  db.prepare('UPDATE courses SET updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), courseId);

  return getCoursePlaces(courseId);
}

export function setLivePlaces(sessionId: string, places: CoursePlace[], addedBy: string = ''): CoursePlace[] {
  const db = getDb();
  const courseId = getLiveCourseId(sessionId);

  const insertPlace = db.prepare(`
    INSERT INTO course_places (id, course_id, title, category, address, road_address, mapx, mapy, link, description, memo, order_index, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    db.prepare('DELETE FROM course_places WHERE course_id = ?').run(courseId);
    places.forEach((p, i) => {
      insertPlace.run(
        p.id || uuidv4(), courseId,
        p.title, p.category, p.address, p.roadAddress,
        p.mapx, p.mapy, p.link, p.description, p.memo,
        i, (p as any).addedBy || addedBy
      );
    });
  })();

  db.prepare('UPDATE courses SET updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), courseId);

  return getCoursePlaces(courseId);
}

/* ─────────── SSE Broadcasting ─────────── */

type SSEController = ReadableStreamDefaultController;

const sessionListeners = new Map<string, Set<SSEController>>();

export function addSSEListener(sessionId: string, controller: SSEController): void {
  if (!sessionListeners.has(sessionId)) {
    sessionListeners.set(sessionId, new Set());
  }
  sessionListeners.get(sessionId)!.add(controller);
}

export function removeSSEListener(sessionId: string, controller: SSEController): void {
  const listeners = sessionListeners.get(sessionId);
  if (listeners) {
    listeners.delete(controller);
    if (listeners.size === 0) {
      sessionListeners.delete(sessionId);
    }
  }
}

export function broadcastSSE(
  sessionId: string,
  type: string,
  data: unknown,
  sender: string
): void {
  const listeners = sessionListeners.get(sessionId);
  if (!listeners || listeners.size === 0) return;

  const event = JSON.stringify({
    type,
    data,
    timestamp: new Date().toISOString(),
    sender,
  });

  const message = `data: ${event}\n\n`;
  const encoder = new TextEncoder();

  for (const controller of listeners) {
    try {
      controller.enqueue(encoder.encode(message));
    } catch {
      // Controller closed, remove it
      listeners.delete(controller);
    }
  }
}

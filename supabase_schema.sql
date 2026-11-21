-- Supabase SQL Schema for DatingRoute (v3: rooms, per-device sessions, guests, share links, memories, connections)
-- 새 프로젝트를 처음 만들 때만 실행하세요. 운영 DB를 바꿀 때는 supabase_migration_v2.sql, supabase_migration_v3.sql을 차례로 쓰세요.
-- ⚠️ 주의: 기존 테이블과 데이터가 모두 삭제됩니다.

DROP PUBLICATION IF EXISTS supabase_realtime;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS connection_invites CASCADE;
DROP TABLE IF EXISTS user_connections CASCADE;
DROP TABLE IF EXISTS course_places CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS room_members CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS session_members CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;

-- 1. 유저 (Global Account)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,  -- scrypt$<salt>$<key> (구버전 SHA-256 hex는 로그인 시 자동 변환)
  is_guest BOOLEAN NOT NULL DEFAULT FALSE,  -- 닉네임만으로 초대 링크에 참여한 계정
  session_token TEXT,  -- (사용 안 함) v1 단일 기기 세션. user_sessions로 대체됨
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 기기별 로그인 세션
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,  -- 세션 토큰의 SHA-256 (원본은 httpOnly 쿠키에만 존재)
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 협업 방 (Rooms)
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  invite_code TEXT UNIQUE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 4. 방 참여자 (Room Members)
CREATE TABLE room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_owner BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT room_members_room_user_key UNIQUE (room_id, user_id)
);

-- 5. 코스 (Courses)
-- 방마다 함께 편집하는 라이브 코스(name='__live__')가 하나 있고, 예전 저장본(name<>'__live__')도 남아 있을 수 있습니다.
CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  schedule JSONB,    -- 일정 기간 설정
  ai_history JSONB,  -- AI 추천 검색 히스토리
  share_id TEXT UNIQUE,  -- 읽기 전용 공유 링크 /s/<share_id>
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. 코스 내 장소들 (Course Places)
CREATE TABLE course_places (
  id TEXT PRIMARY KEY,  -- 클라이언트가 만든 UUID
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  road_address TEXT NOT NULL DEFAULT '',
  mapx FLOAT8 NOT NULL DEFAULT 0,
  mapy FLOAT8 NOT NULL DEFAULT 0,
  link TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  memo TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  day_index INTEGER NOT NULL DEFAULT 1,  -- 0 = 보관함, N = Day N
  added_by TEXT NOT NULL DEFAULT '',     -- 유저 닉네임
  reactions JSONB DEFAULT '{}'::jsonb,   -- { userId: emoji }
  is_hold BOOLEAN NOT NULL DEFAULT FALSE,
  stay_minutes INTEGER CHECK (stay_minutes IS NULL OR stay_minutes BETWEEN 0 AND 1440),
  cost INTEGER CHECK (cost IS NULL OR cost >= 0),
  visited_at TIMESTAMPTZ,
  rating SMALLINT CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  review TEXT NOT NULL DEFAULT '',
  photo_path TEXT  -- storage 버킷 'memories' 안의 경로
);

-- 7. 함께하는 사람 (사용자 연결). 한 쌍마다 양방향 두 행
CREATE TABLE user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  friend_id UUID NOT NULL,
  auto_share BOOLEAN NOT NULL DEFAULT TRUE,  -- user_id가 새 코스를 만들 때 friend_id를 자동으로 참여시킴
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_connections_user_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT user_connections_friend_fkey FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT user_connections_pair_key UNIQUE (user_id, friend_id),
  CONSTRAINT user_connections_not_self CHECK (user_id <> friend_id)
);

-- 8. 연결용 1회용 초대 링크 (/?invite=<code>, 7일). room_id가 있으면 그 코스에도 참여
CREATE TABLE connection_invites (
  code TEXT PRIMARY KEY,
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_by UUID REFERENCES users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX idx_rooms_invite ON rooms(invite_code);
CREATE INDEX idx_room_members_room ON room_members(room_id);
CREATE INDEX idx_courses_owner ON courses(owner_id);
CREATE INDEX idx_courses_room ON courses(room_id);
CREATE INDEX idx_places_course ON course_places(course_id);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_users_session_token ON users(session_token);
CREATE INDEX idx_user_connections_friend ON user_connections(friend_id);
CREATE INDEX idx_connection_invites_inviter ON connection_invites(inviter_id);

-- 실시간 동기화는 Broadcast 채널(session-<roomId>)을 쓰므로 테이블을 발행하지 않습니다.
CREATE PUBLICATION supabase_realtime;

-- 보안: RLS를 켜고 정책을 두지 않아 공개 키(anon/authenticated)로는 접근할 수 없게 합니다.
-- 서버는 RLS를 우회하는 secret 키(SUPABASE_SECRET_KEY)로만 접속합니다.
ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_connections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

-- 추억 사진 저장소 (비공개, 정책 없음 = secret 키로만 접근)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('memories', 'memories', FALSE, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

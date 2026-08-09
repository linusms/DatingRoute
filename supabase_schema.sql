-- Supabase SQL Schema for DatingRoute (V2: Global Auth & Rooms)
-- 기존 테이블들이 있다면 모두 지우고 이 코드를 실행하세요.
-- ⚠️ 주의: 기존 데이터가 모두 삭제됩니다.

DROP PUBLICATION IF EXISTS supabase_realtime;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS course_places CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS room_members CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS session_members CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;

-- 1. 유저 (Global Account)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  session_token TEXT,  -- 단일 기기 로그인 강제용
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 협업 방 (Rooms - 기존 sessions 대체)
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  invite_code TEXT UNIQUE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 3. 방 참여자 (Room Members)
CREATE TABLE room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_owner BOOLEAN NOT NULL DEFAULT FALSE
);

-- 4. 저장된 코스 (Courses)
-- 이제 방(room_id)이 아니라 유저(owner_id)에 영구 종속됩니다.
-- 단, 현재 실시간 작업 중인 임시 코스(__live__)를 구별하기 위해 room_id를 nullable로 둡니다.
CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE, -- __live__ 코스용
  name TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  schedule JSONB,  -- 일정 기간 설정 (다기기 동기화)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. 코스 내 장소들 (Course Places)
CREATE TABLE course_places (
  id TEXT PRIMARY KEY,
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
  day_index INTEGER NOT NULL DEFAULT 1,
  added_by TEXT NOT NULL DEFAULT '' -- 유저 닉네임
);

-- 6. 실시간 이벤트 (Realtime Events)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  sender TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_rooms_invite ON rooms(invite_code);
CREATE INDEX idx_room_members_room ON room_members(room_id);
CREATE INDEX idx_courses_owner ON courses(owner_id);
CREATE INDEX idx_courses_room ON courses(room_id);
CREATE INDEX idx_places_course ON course_places(course_id);
CREATE INDEX idx_events_room ON events(room_id);

-- 실시간 통신(Realtime)을 위해 테이블 설정 활성화
CREATE PUBLICATION supabase_realtime;
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE courses;
ALTER PUBLICATION supabase_realtime ADD TABLE course_places;
ALTER PUBLICATION supabase_realtime ADD TABLE events;

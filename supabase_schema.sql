-- Supabase SQL Schema for DatingRoute
-- 이 코드를 복사해서 Supabase 대시보드의 SQL Editor에 붙여넣고 실행(Run)하세요.

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  invite_code TEXT UNIQUE NOT NULL,
  owner_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_personal BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE session_members (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL DEFAULT '',
  joined_at TIMESTAMPTZ NOT NULL,
  is_owner BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

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
  added_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  sender TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_courses_session ON courses(session_id);
CREATE INDEX idx_places_course ON course_places(course_id);
CREATE INDEX idx_members_session ON session_members(session_id);
CREATE INDEX idx_sessions_invite ON sessions(invite_code);
CREATE INDEX idx_events_session ON events(session_id);

-- 실시간 통신(Realtime)을 위해 테이블 설정 활성화
-- 이 설정이 있어야 브라우저에서 변경 사항을 실시간으로 수신할 수 있습니다.
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE session_members;
ALTER PUBLICATION supabase_realtime ADD TABLE courses;
ALTER PUBLICATION supabase_realtime ADD TABLE course_places;
ALTER PUBLICATION supabase_realtime ADD TABLE events;

-- DatingRoute v2 마이그레이션 (1~5단계 기능)
--
-- 실행 순서: supabase_security_migration.sql(0단계)을 먼저 실행한 뒤 이 파일을 실행하고,
--            그다음에 새 코드를 배포하세요. 새 코드는 아래 테이블·컬럼이 없으면 동작하지 않습니다.
-- 여러 번 실행해도 안전합니다(IF NOT EXISTS / ON CONFLICT).
-- 이전 코드(main)도 이 스키마에서 그대로 동작하므로, 코드만 되돌릴 때는 SQL을 되돌릴 필요가 없습니다.
-- 지우는 데이터: 중복된 room_members 행, 더 이상 쓰지 않는 events 테이블.

BEGIN;

-- 1. 방 참여자 중복 정리 + 중복 방지 제약
--    같은 (room_id, user_id) 중 호스트 행 > 먼저 참여한 행 > id가 작은 행을 남깁니다.
DELETE FROM public.room_members a
USING public.room_members b
WHERE a.room_id = b.room_id
  AND a.user_id = b.user_id
  AND a.id <> b.id
  AND (
    (b.is_owner AND NOT a.is_owner)
    OR (a.is_owner = b.is_owner AND (b.joined_at < a.joined_at OR (b.joined_at = a.joined_at AND b.id < a.id)))
  );

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'room_members_room_user_key') THEN
    ALTER TABLE public.room_members ADD CONSTRAINT room_members_room_user_key UNIQUE (room_id, user_id);
  END IF;
END $$;

-- 2. 쓰지 않는 실시간 이벤트 테이블 제거 (실시간 동기화는 Broadcast 채널을 씁니다)
DROP TABLE IF EXISTS public.events CASCADE;

-- 3. 게스트 계정 (닉네임만으로 초대 링크 참여)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. 기기별 로그인 세션 (여러 기기 동시 로그인)
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,          -- 세션 토큰의 SHA-256 (원본은 httpOnly 쿠키에만)
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id);

-- 지금 로그인해 있는 사용자가 배포 후에도 로그인 상태를 유지하도록 옮겨 둡니다.
-- users.session_token 컬럼은 이전 코드 호환을 위해 남겨 둡니다(새 코드는 쓰지 않음).
INSERT INTO public.user_sessions (user_id, token_hash)
SELECT id, session_token FROM public.users WHERE session_token IS NOT NULL
ON CONFLICT (token_hash) DO NOTHING;

-- 5. 읽기 전용 공유 링크
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS share_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_share_id ON public.courses(share_id);

-- 6. 장소별 보류·체류 시간·비용·방문 기록·추억
ALTER TABLE public.course_places ADD COLUMN IF NOT EXISTS is_hold BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.course_places ADD COLUMN IF NOT EXISTS stay_minutes INTEGER;
ALTER TABLE public.course_places ADD COLUMN IF NOT EXISTS cost INTEGER;
ALTER TABLE public.course_places ADD COLUMN IF NOT EXISTS visited_at TIMESTAMPTZ;
ALTER TABLE public.course_places ADD COLUMN IF NOT EXISTS rating SMALLINT;
ALTER TABLE public.course_places ADD COLUMN IF NOT EXISTS review TEXT NOT NULL DEFAULT '';
ALTER TABLE public.course_places ADD COLUMN IF NOT EXISTS photo_path TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_places_rating_range') THEN
    ALTER TABLE public.course_places ADD CONSTRAINT course_places_rating_range CHECK (rating IS NULL OR rating BETWEEN 1 AND 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_places_stay_range') THEN
    ALTER TABLE public.course_places ADD CONSTRAINT course_places_stay_range CHECK (stay_minutes IS NULL OR stay_minutes BETWEEN 0 AND 1440);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'course_places_cost_range') THEN
    ALTER TABLE public.course_places ADD CONSTRAINT course_places_cost_range CHECK (cost IS NULL OR cost >= 0);
  END IF;
END $$;

-- 7. 보안: 새 테이블도 공개 키로는 접근할 수 없게 (서버는 secret 키로만 접속)
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_sessions FROM anon, authenticated;

-- 8. 추억 사진 저장소 (비공개 버킷, 정책 없음 = 서버의 secret 키로만 읽고 씀, 3MB 제한)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('memories', 'memories', FALSE, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

COMMIT;

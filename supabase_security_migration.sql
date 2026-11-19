-- DatingRoute 0단계 보안 마이그레이션 (기존 DB에 1회 실행, 데이터는 유지됩니다)
--
-- ⚠️ 적용 순서를 꼭 지키세요. 순서가 바뀌면 앱이 DB에 접근하지 못합니다.
--   1) 서버 환경변수 SUPABASE_SECRET_KEY 설정 (.env.local, Vercel)
--      Supabase 대시보드 > Project Settings > API Keys 의 secret 키(sb_secret_...) 또는 service_role 키
--   2) 새 코드 배포 (서버는 secret 키로 접속, 실시간 동기화는 Broadcast 채널 사용)
--   3) 이 SQL을 Supabase SQL Editor에서 실행
--
-- 실행 후 모든 사용자는 한 번 다시 로그인해야 합니다. (기존 평문 세션 토큰 무효화)

-- 1. 모든 public 테이블에 RLS 활성화.
--    정책(policy)을 만들지 않으므로 공개 키(anon/authenticated)로는 아무것도 읽거나 쓸 수 없고,
--    RLS를 우회하는 서버의 secret 키만 접근할 수 있습니다.
ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events        ENABLE ROW LEVEL SECURITY;

-- 2. 공개 키 역할의 테이블 권한 회수 (RLS와 별개의 이중 방어)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
-- 앞으로 SQL Editor에서 만드는 테이블에도 기본 권한이 부여되지 않도록
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;

-- 3. 실시간 동기화는 Broadcast 채널로 바뀌었으므로 postgres_changes 발행 대상에서 테이블 제외
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'rooms', 'room_members', 'courses', 'course_places', 'events'] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- 4. 기존 세션 토큰 무효화. 공개 저장소의 DB 백업에 평문 토큰이 노출됐고,
--    이제는 토큰의 SHA-256 해시만 저장합니다.
UPDATE public.users SET session_token = NULL;

-- 5. 세션 토큰 조회용 인덱스 (모든 API 요청마다 조회)
CREATE INDEX IF NOT EXISTS idx_users_session_token ON public.users(session_token);

-- 참고: public.events 테이블은 더 이상 쓰지 않습니다. 1단계 정리 때 삭제할 예정입니다.
-- 참고: users.password 의 기존 SHA-256 해시는 각 사용자가 다음에 로그인할 때 scrypt로 자동 변환됩니다.

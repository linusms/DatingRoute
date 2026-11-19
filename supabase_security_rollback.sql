-- DatingRoute 0단계 보안 마이그레이션 되돌리기 (긴급용)
--
-- supabase_security_migration.sql 실행 후 앱이 DB에 접근하지 못할 때만 쓰세요.
-- 실행하면 공개 키로 누구나 전체 데이터를 읽고 쓸 수 있던 이전 상태로 돌아갑니다(보안 구멍이 다시 열림).
--
-- 먼저 확인할 것: 대부분은 Vercel에 SUPABASE_SECRET_KEY가 빠졌거나 오타인 경우입니다.
-- 키를 고치고 Redeploy하면 이 파일 없이 해결됩니다. 원인을 고친 뒤에는 migration을 다시 실행하세요.
--
-- 되돌릴 수 없는 것: migration 4번(세션 토큰 초기화)은 복구할 필요가 없습니다. 모두 다시 로그인하면 됩니다.

-- 1. RLS 끄기
ALTER TABLE public.users         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_places DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.events        DISABLE ROW LEVEL SECURITY;

-- 2. 공개 키 역할 권한 복구 (Supabase 기본값과 동일)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;

-- 3. (선택) postgres_changes 발행 복구 — 현재 코드는 Broadcast를 쓰므로 필요 없습니다.
--    0단계 이전 코드(커밋 6b77ad2)로 되돌릴 때만 주석을 풀어 실행하세요.
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms, public.room_members, public.courses, public.course_places, public.events;

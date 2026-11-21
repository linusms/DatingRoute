-- DatingRoute v3 rollback: supabase_migration_v3.sql을 되돌립니다.
-- v3는 새 테이블 두 개(user_connections, connection_invites)만 추가했고 기존 테이블은 건드리지 않았으므로,
-- 이 두 테이블을 지우면 v3 실행 전 상태로 돌아갑니다. (연결 정보와 초대 링크는 사라집니다)
--
-- ⚠️ v3 기능이 들어간 코드(feature/connections)를 배포한 뒤라면, 먼저 이전 코드(main fc4dd85)로
--    되돌린 다음 실행하세요. 새 코드는 이 테이블이 없으면 함께하는 사람 기능이 동작하지 않습니다.

BEGIN;

DROP TABLE IF EXISTS connection_invites;
DROP TABLE IF EXISTS user_connections;

COMMIT;

-- DatingRoute v3 migration: 함께하는 사람(사용자 연결)과 1회용 초대 링크
-- 운영 DB에 Supabase SQL Editor에서 한 번 실행하세요. v2 마이그레이션이 먼저 적용되어 있어야 합니다.
-- 트랜잭션이라 중간에 실패하면 아무것도 바뀌지 않습니다.
-- 다시 실행해도 오류는 나지 않지만, 마지막 단계가 같은 코스를 함께 쓰는 사람끼리 다시 연결하므로
-- 그사이 연결을 끊은 사람이 다시 연결될 수 있습니다.
--
-- 이 SQL을 실행해도 지금 배포된 코드는 그대로 동작합니다(새 테이블만 추가).

BEGIN;

-- 1. 사용자 연결. 한 쌍마다 두 행(양방향)을 두어 각자 "새 코스에 자동 추가"를 따로 정합니다.
CREATE TABLE IF NOT EXISTS user_connections (
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
CREATE INDEX IF NOT EXISTS idx_user_connections_friend ON user_connections(friend_id);

-- 2. 연결용 초대 링크 (/?invite=<code>). 7일 동안 한 번만 쓸 수 있습니다.
--    room_id가 있으면 수락할 때 그 코스에도 함께 참여합니다.
CREATE TABLE IF NOT EXISTS connection_invites (
  code TEXT PRIMARY KEY,
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_by UUID REFERENCES users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_connection_invites_inviter ON connection_invites(inviter_id);

-- 3. 보안: 다른 테이블과 같이 RLS를 켜고 정책을 두지 않아 secret 키로만 접근합니다.
ALTER TABLE user_connections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON user_connections, connection_invites FROM anon, authenticated;

-- 4. 이미 같은 코스를 함께 쓰는 사람끼리 연결합니다.
--    둘이서만 쓰는 코스가 하나라도 있으면(커플) 새 코스 자동 추가를 켜고, 여럿이 쓰는 코스로만 만난 사이는 끕니다.
INSERT INTO user_connections (user_id, friend_id, auto_share)
SELECT a.user_id, b.user_id, BOOL_OR(c.member_count = 2)
FROM room_members a
JOIN room_members b ON b.room_id = a.room_id AND b.user_id <> a.user_id
JOIN (
  SELECT room_id, COUNT(DISTINCT user_id) AS member_count
  FROM room_members
  GROUP BY room_id
) c ON c.room_id = a.room_id
GROUP BY a.user_id, b.user_id
ON CONFLICT (user_id, friend_id) DO NOTHING;

COMMIT;

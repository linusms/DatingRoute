'use client';

import { useState } from 'react';
import type { Connection, RoomMember } from '@/lib/types';
import { createInviteLink, type InviteLink } from '@/hooks/useConnections';

interface MembersPanelProps {
  roomId: string;
  members: RoomMember[];
  onlineUserIds: string[];
  currentUserId: string;
  isHost: boolean;
  /** The host's connections (null while loading or for non-hosts) */
  connections: Connection[] | null;
  onToggle: (userId: string, enabled: boolean) => Promise<void>;
  onCopy: (text: string, message: string) => void;
}

interface Row {
  userId: string;
  nickname: string;
  isGuest?: boolean;
  isMember: boolean;
  isConnection: boolean;
}

/**
 * Who can edit this course. The host switches sharing on/off per connected person;
 * everyone else sees the member list.
 */
export default function MembersPanel({ roomId, members, onlineUserIds, currentUserId, isHost, connections, onToggle, onCopy }: MembersPanelProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteLink | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = new Set(onlineUserIds);
  const host = members.find((m) => m.isOwner);

  const rows: Row[] = [];
  if (isHost) {
    const memberIds = new Set(members.map((m) => m.userId));
    for (const c of connections ?? []) {
      rows.push({ userId: c.userId, nickname: c.nickname, isGuest: c.isGuest, isMember: memberIds.has(c.userId), isConnection: true });
    }
    const connected = new Set((connections ?? []).map((c) => c.userId));
    for (const m of members) {
      if (m.userId === currentUserId || connected.has(m.userId)) continue;
      rows.push({ userId: m.userId, nickname: m.nickname || 'Unknown', isMember: true, isConnection: false });
    }
  }

  const toggle = async (row: Row, enabled: boolean) => {
    setBusyId(row.userId);
    try {
      await onToggle(row.userId, enabled);
    } finally {
      setBusyId(null);
    }
  };

  const makeInvite = async () => {
    setCreating(true);
    setError(null);
    try {
      const link = await createInviteLink(roomId);
      setInvite(link);
      onCopy(link.url, '초대 링크를 복사했어요! 7일 동안 한 번 쓸 수 있어요.');
    } catch (err) {
      setError((err as Error).message || '초대 링크를 만들지 못했어요.');
    } finally {
      setCreating(false);
    }
  };

  if (!isHost) {
    return (
      <div className="members-panel">
        <h4>함께 편집하는 사람 ({members.length}명)</h4>
        <ul className="members-list">
          {members.map((m) => (
            <li key={m.userId}>
              <span className={`presence-dot ${online.has(m.userId) ? 'on' : ''}`} title={online.has(m.userId) ? '지금 보는 중' : '오프라인'} />
              <span className="member-name">{m.nickname || 'Unknown'}{m.userId === currentUserId ? ' (나)' : ''}</span>
              {m.isOwner && <span className="member-tag">만든 사람</span>}
            </li>
          ))}
        </ul>
        <p className="members-hint">함께할 사람은 {host?.nickname ? `${host.nickname}님이` : '코스를 만든 사람이'} 정해요.</p>
      </div>
    );
  }

  return (
    <div className="members-panel">
      <h4>이 코스를 함께 편집할 사람</h4>
      <ul className="members-list">
        <li>
          <span className={`presence-dot ${online.has(currentUserId) ? 'on' : ''}`} />
          <span className="member-name">나</span>
          <span className="member-tag">만든 사람</span>
        </li>
        {connections === null && <li className="members-muted">불러오는 중...</li>}
        {rows.map((row) => (
          <li key={row.userId}>
            <span className={`presence-dot ${row.isMember && online.has(row.userId) ? 'on' : ''}`} title={row.isMember && online.has(row.userId) ? '지금 보는 중' : undefined} />
            <span className="member-name">
              {row.nickname}
              {row.isGuest && <span className="member-sub"> 게스트</span>}
            </span>
            {row.isConnection ? (
              <button
                type="button"
                role="switch"
                aria-checked={row.isMember}
                aria-label={`${row.nickname}님과 이 코스 함께 편집`}
                className={`switch ${row.isMember ? 'on' : ''}`}
                disabled={busyId === row.userId}
                onClick={() => toggle(row, !row.isMember)}
              >
                <span className="switch-knob" />
              </button>
            ) : (
              <button type="button" className="cb-chip-btn danger" disabled={busyId === row.userId} onClick={() => toggle(row, false)}>
                빼기
              </button>
            )}
          </li>
        ))}
        {connections !== null && rows.length === 0 && (
          <li className="members-muted">아직 연결된 사람이 없어요.</li>
        )}
      </ul>

      <div className="members-invite">
        {invite ? (
          <div className="members-invite-result">
            <div>초대코드 <strong>{invite.code}</strong></div>
            <div className="members-invite-buttons">
              <button type="button" className="cb-chip-btn" onClick={() => onCopy(invite.url, '초대 링크를 복사했어요!')}>링크 복사</button>
              <button type="button" className="cb-chip-btn" onClick={() => onCopy(invite.code, `초대코드 "${invite.code}" 복사됨!`)}>코드 복사</button>
            </div>
            <p className="members-hint">받은 사람이 링크를 열면 나와 연결되고 이 코스에 바로 들어와요. 7일 동안 한 번 쓸 수 있어요.</p>
          </div>
        ) : (
          <button type="button" className="cb-chip-btn members-invite-btn" onClick={makeInvite} disabled={creating}>
            {creating ? '만드는 중...' : '+ 새로운 사람 초대 링크 만들기'}
          </button>
        )}
        {error && <p className="members-error" role="alert">{error}</p>}
      </div>
      <p className="members-hint">연결 끊기와 새 코스 자동 공유는 대시보드의 &lsquo;함께하는 사람&rsquo;에서 바꿀 수 있어요.</p>
    </div>
  );
}

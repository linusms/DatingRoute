'use client';

import React, { useState } from 'react';
import type { Connection } from '@/lib/types';
import { createInviteLink, type InviteLink } from '@/hooks/useConnections';

interface PeopleSectionProps {
  connections: Connection[] | null;
  onSetAutoShare: (friendId: string, autoShare: boolean) => Promise<void>;
  onDisconnect: (friend: Connection) => Promise<void>;
  onRedeemInvite: (code: string) => Promise<void>;
  onCopy: (text: string, message: string) => void;
}

/** Dashboard tab: invite people once, then choose per course who edits it. */
export default function PeopleSection({ connections, onSetAutoShare, onDisconnect, onRedeemInvite, onCopy }: PeopleSectionProps) {
  const [invite, setInvite] = useState<InviteLink | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const makeInvite = async () => {
    setCreating(true);
    setError(null);
    try {
      const link = await createInviteLink();
      setInvite(link);
      onCopy(link.url, '초대 링크를 복사했어요! 함께할 사람에게 보내주세요.');
    } catch (err) {
      setError((err as Error).message || '초대 링크를 만들지 못했어요.');
    } finally {
      setCreating(false);
    }
  };

  const redeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setRedeeming(true);
    try {
      await onRedeemInvite(code);
      setCode('');
    } catch { /* toast shown by the hook */ } finally {
      setRedeeming(false);
    }
  };

  const run = async (id: string, task: () => Promise<void>) => {
    setBusyId(id);
    try { await task(); } catch (err) {
      setError((err as Error).message || '저장하지 못했어요.');
    } finally { setBusyId(null); }
  };

  const expiresLabel = invite
    ? new Date(invite.expiresAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
    : '';

  return (
    <div className="dashboard-section people-section">
      <div className="people-card">
        <div className="people-card-title">🤝 함께할 사람 초대하기</div>
        <p className="people-card-desc">
          한 번만 연결하면 돼요. 연결된 사람은 앞으로 내가 만드는 코스에 자동으로 함께하고,
          코스마다 상단 👥 버튼에서 켜고 끌 수 있어요.
        </p>
        {invite ? (
          <div className="people-invite">
            <div className="people-invite-code" aria-label="초대코드">{invite.code}</div>
            <div className="people-invite-buttons">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => onCopy(invite.url, '초대 링크를 복사했어요!')}>링크 복사</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onCopy(invite.code, `초대코드 "${invite.code}" 복사됨!`)}>코드 복사</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={makeInvite} disabled={creating}>새로 만들기</button>
            </div>
            <p className="people-hint">{expiresLabel}까지 한 번 쓸 수 있어요. 받은 사람은 가입 없이 닉네임만으로 들어올 수 있어요.</p>
          </div>
        ) : (
          <button type="button" className="btn btn-primary" onClick={makeInvite} disabled={creating}>
            {creating ? '만드는 중...' : '초대 링크 만들기'}
          </button>
        )}
      </div>

      <form className="join-form" onSubmit={redeem}>
        <input
          className="input"
          value={code}
          maxLength={6}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="받은 초대코드 6자리"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          aria-label="받은 초대코드"
        />
        <button className="btn btn-secondary" type="submit" disabled={code.length !== 6 || redeeming}>
          {redeeming ? '확인 중...' : '연결하기'}
        </button>
      </form>

      {error && <p className="people-error" role="alert">{error}</p>}

      <h3 className="people-heading">연결된 사람 {connections ? `(${connections.length})` : ''}</h3>
      {connections === null ? (
        <div className="dashboard-empty"><div className="dashboard-loading-spinner" /><p>불러오는 중...</p></div>
      ) : connections.length === 0 ? (
        <div className="dashboard-empty">
          <div className="dashboard-empty-icon">💌</div>
          <p>아직 연결된 사람이 없어요</p>
          <p className="dashboard-empty-hint">초대 링크를 보내거나, 받은 초대코드를 입력해보세요.</p>
        </div>
      ) : (
        <ul className="people-list">
          {connections.map((c) => (
            <li key={c.userId} className="people-row">
              <div className="people-avatar" aria-hidden>{c.nickname.slice(0, 1)}</div>
              <div className="people-info">
                <div className="people-name">
                  {c.nickname}
                  {c.isGuest && <span className="member-tag">게스트</span>}
                </div>
                <div className="people-meta">{new Date(c.connectedAt).toLocaleDateString('ko-KR')} 연결</div>
              </div>
              <div className="people-actions">
                <label className="people-auto">
                  <span>새 코스 자동 공유</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={c.autoShare}
                    aria-label={`${c.nickname}님을 새 코스에 자동으로 추가`}
                    className={`switch ${c.autoShare ? 'on' : ''}`}
                    disabled={busyId === c.userId}
                    onClick={() => run(c.userId, () => onSetAutoShare(c.userId, !c.autoShare))}
                  >
                    <span className="switch-knob" />
                  </button>
                </label>
                <button
                  type="button"
                  className="cb-chip-btn danger"
                  disabled={busyId === c.userId}
                  onClick={() => run(c.userId, () => onDisconnect(c))}
                >
                  연결 끊기
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

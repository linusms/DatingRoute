'use client';

import React, { useState } from 'react';
import type { User } from '@/lib/types';

interface ChangePasswordModalProps {
  onClose: () => void;
  /** Guests set a password (and may pick a nickname) instead of changing one */
  guestUser?: User | null;
  onUpgraded?: (user: User) => void;
}

export default function ChangePasswordModal({ onClose, guestUser, onUpgraded }: ChangePasswordModalProps) {
  const isUpgrade = !!guestUser;
  const [nickname, setNickname] = useState(guestUser?.nickname.replace(/#\d+$/, '') ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSubmit = (isUpgrade ? nickname.trim() : currentPassword) && newPassword && confirmPassword && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 서로 다릅니다.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = isUpgrade
        ? await fetch('/api/auth/upgrade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nickname: nickname.trim(), password: newPassword.trim() }),
          })
        : await fetch('/api/auth/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword: currentPassword.trim(), newPassword: newPassword.trim() }),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || (isUpgrade ? '계정 전환에 실패했습니다.' : '비밀번호 변경에 실패했습니다.'));
        return;
      }
      if (isUpgrade && data.user) onUpgraded?.(data.user);
      setDone(true);
    } catch {
      setError('서버와 통신할 수 없습니다.');
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => e.key === 'Enter' && handleSubmit();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={isUpgrade ? '계정 만들기' : '비밀번호 변경'}>
        <div className="modal-header">
          <h2>{isUpgrade ? '계정으로 저장하기' : '비밀번호 변경'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="닫기">✕</button>
        </div>

        <div className="modal-body">
          {done ? (
            <p className="modal-text">
              {isUpgrade
                ? '이제 닉네임과 비밀번호로 어느 기기에서든 로그인할 수 있어요.'
                : '비밀번호를 변경했습니다. 다른 기기에서는 다시 로그인해야 해요.'}
            </p>
          ) : (
            <>
              {isUpgrade ? (
                <>
                  <p className="modal-text muted">지금은 이 브라우저에서만 쓸 수 있는 게스트예요. 비밀번호를 정하면 계정으로 남아요.</p>
                  <div className="save-input-group">
                    <label>닉네임</label>
                    <input className="input" value={nickname} maxLength={20} onChange={(e) => setNickname(e.target.value)} onKeyDown={onKeyDown} autoFocus />
                  </div>
                </>
              ) : (
                <div className="save-input-group">
                  <label>현재 비밀번호</label>
                  <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} onKeyDown={onKeyDown} autoFocus />
                </div>
              )}
              <div className="save-input-group">
                <label>{isUpgrade ? '비밀번호' : '새 비밀번호'}</label>
                <input className="input" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} onKeyDown={onKeyDown} />
              </div>
              <div className="save-input-group">
                <label>{isUpgrade ? '비밀번호 확인' : '새 비밀번호 확인'}</label>
                <input className="input" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={onKeyDown} />
              </div>
              {error && <p className="modal-text error" role="alert">{error}</p>}
            </>
          )}
        </div>

        <div className="modal-footer">
          {done ? (
            <button className="btn btn-primary" onClick={onClose}>확인</button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={onClose}>취소</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
                {saving ? '저장 중...' : isUpgrade ? '계정 만들기' : '변경'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

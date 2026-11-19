'use client';

import React, { useState } from 'react';

interface ChangePasswordModalProps {
  onClose: () => void;
}

export default function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSubmit = currentPassword && newPassword && confirmPassword && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 서로 다릅니다.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPassword.trim(), newPassword: newPassword.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '비밀번호 변경에 실패했습니다.');
        return;
      }
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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>비밀번호 변경</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {done ? (
            <p style={{ fontSize: '14px', color: 'var(--color-text-primary)', margin: 0 }}>비밀번호를 변경했습니다.</p>
          ) : (
            <>
              <div className="save-input-group">
                <label>현재 비밀번호</label>
                <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} onKeyDown={onKeyDown} autoFocus />
              </div>
              <div className="save-input-group">
                <label>새 비밀번호</label>
                <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} onKeyDown={onKeyDown} />
              </div>
              <div className="save-input-group">
                <label>새 비밀번호 확인</label>
                <input className="input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={onKeyDown} />
              </div>
              {error && <p style={{ fontSize: '13px', color: 'var(--color-error)', margin: 0 }}>{error}</p>}
            </>
          )}
        </div>

        <div className="modal-footer">
          {done ? (
            <button className="btn btn-primary" onClick={onClose}>
              확인
            </button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={onClose}>
                취소
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
                {saving ? '변경 중...' : '변경'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

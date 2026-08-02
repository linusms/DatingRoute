'use client';

import React, { useState } from 'react';

interface InviteCodeModalProps {
  inviteCode?: string;
  onJoin: (code: string, nickname: string) => Promise<void>;
  onClose: () => void;
}

export default function InviteCodeModal({
  inviteCode: initialCode,
  onJoin,
  onClose,
}: InviteCodeModalProps) {
  const [code, setCode] = useState(initialCode || '');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!code.trim() || code.trim().length !== 6) {
      setError('6자리 초대코드를 입력해주세요.');
      return;
    }
    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onJoin(code.trim().toUpperCase(), nickname.trim());
    } catch (e: any) {
      setError(e.message || '유효하지 않은 초대코드입니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="invite-modal-overlay" onClick={onClose}>
      <div
        className="invite-modal animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="invite-modal-close" onClick={onClose}>✕</button>

        <div className="invite-modal-header">
          <div className="invite-modal-icon">💌</div>
          <h2>초대를 받으셨나요?</h2>
          <p>초대코드와 닉네임을 입력해 함께 데이트 코스를 만들어보세요!</p>
        </div>

        <div className="invite-modal-body">
          <div className="invite-modal-field">
            <label>초대코드</label>
            <input
              className="invite-modal-input code"
              placeholder="AB12CD"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              maxLength={6}
              autoFocus
            />
          </div>

          <div className="invite-modal-field">
            <label>닉네임</label>
            <input
              className="invite-modal-input"
              placeholder="예: 여자친구 💕"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              maxLength={20}
            />
          </div>

          {error && (
            <div className="invite-modal-error animate-fade-in">{error}</div>
          )}
        </div>

        <button
          className="invite-modal-submit"
          onClick={handleSubmit}
          disabled={loading || !code.trim() || !nickname.trim()}
        >
          {loading ? '⏳ 참여 중...' : '🎉 함께 만들기'}
        </button>
      </div>
    </div>
  );
}

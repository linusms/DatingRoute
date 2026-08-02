import React, { useState } from 'react';
import type { SessionMode } from '@/lib/types';

interface SessionModeSelectorProps {
  onSelect: (
    mode: SessionMode,
    inviteCode?: string
  ) => void;
  isLoading: boolean;
}

export default function SessionModeSelector({
  onSelect,
  isLoading,
}: SessionModeSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<SessionMode | null>(null);
  const [inviteCode, setInviteCode] = useState('');

  const handleSelectMode = (mode: SessionMode) => {
    if (mode === 'personal' || mode === 'dev') {
      onSelect(mode);
    } else {
      setSelectedMode(mode);
    }
  };

  const handleSubmitInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      alert('입장할 초대 코드를 입력해주세요.');
      return;
    }
    onSelect('invite', inviteCode.trim().toUpperCase());
  };

  return (
    <div className="session-mode-overlay">
      <div className="session-mode-container">
        <div className="session-mode-header">
          <div className="session-mode-logo">✨</div>
          <h1 className="session-mode-title">경로 작업방 선택</h1>
          <p className="session-mode-subtitle">
            나만의 코스를 짜거나, 친구들과 함께 작업할 수 있습니다.
          </p>
        </div>

        {selectedMode !== 'invite' ? (
          <div className="session-mode-cards">
            {/* 개인 모드 */}
            <div
              className="session-mode-card"
              onClick={() => handleSelectMode('personal')}
            >
              <div className="session-mode-card-icon">👤</div>
              <h3 className="session-mode-card-title">개인 작업방 시작</h3>
              <p className="session-mode-card-desc">나만의 데이트 코스를 작성합니다.</p>
            </div>

            {/* 초대 모드 (방 생성) */}
            <div
              className="session-mode-card"
              onClick={() => handleSelectMode('dev')}
            >
              <div className="session-mode-card-icon">🤝</div>
              <h3 className="session-mode-card-title">새로운 협업 방 만들기</h3>
              <p className="session-mode-card-desc">친구를 초대하여 실시간으로 함께 지도를 봅니다.</p>
            </div>

            {/* 초대 코드로 참가 */}
            <div
              className="session-mode-card invite"
              onClick={() => handleSelectMode('invite')}
            >
              <div className="session-mode-card-icon">🎟️</div>
              <h3 className="session-mode-card-title">초대 코드로 참가</h3>
              <p className="session-mode-card-desc">친구가 만든 협업 방에 들어갑니다.</p>
              <div className="session-mode-card-badge">Join Room</div>
            </div>
          </div>
        ) : (
          <div className="session-mode-card invite" style={{ width: '100%', cursor: 'default' }}>
            <div className="session-mode-card-icon">🎟️</div>
            <h3 className="session-mode-card-title">초대 코드로 참가</h3>
            <p className="session-mode-card-desc">친구에게 받은 6자리 코드를 입력해주세요.</p>
            
            <form onSubmit={handleSubmitInvite} className="session-mode-input-group fade-in" style={{ marginTop: '24px' }}>
              <input
                className="session-mode-input"
                type="text"
                placeholder="6자리 코드 입력"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                maxLength={6}
                disabled={isLoading}
                style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '20px', fontWeight: 'bold' }}
              />
              <button 
                type="submit" 
                className="session-mode-submit" 
                disabled={isLoading || inviteCode.length < 6}
                style={{ marginTop: '16px', width: '100%' }}
              >
                {isLoading ? '입장 중...' : '방 참가하기'}
              </button>
              <button
                type="button"
                className="session-mode-back"
                onClick={() => setSelectedMode(null)}
                style={{ marginTop: '12px', width: '100%', background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
                disabled={isLoading}
              >
                뒤로가기
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

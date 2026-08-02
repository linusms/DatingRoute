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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMode) return;
    
    if (selectedMode === 'invite' && inviteCode.trim().length === 0) {
      alert('입장할 초대 코드를 입력해주세요.');
      return;
    }

    onSelect(selectedMode, inviteCode.trim().toUpperCase());
  };

  return (
    <div className="session-mode-container">
      <div className="session-mode-card">
        <div className="session-mode-header">
          <h1 className="session-mode-title">경로 작업방 선택</h1>
          <p className="session-mode-subtitle">
            나만의 코스를 짜거나, 친구들과 함께 작업할 수 있습니다.
          </p>
        </div>

        <div className="session-mode-options">
          {/* 개인 모드 */}
          <div
            className={`session-mode-option ${selectedMode === 'personal' ? 'selected' : ''}`}
            onClick={() => {
              setSelectedMode('personal');
              setInviteCode('');
            }}
          >
            <div className="session-mode-option-icon">👤</div>
            <div className="session-mode-option-content">
              <h3>개인 작업방 시작</h3>
              <p>나만의 데이트 코스를 작성합니다.</p>
            </div>
            <div className="session-mode-option-radio">
              <div className={`radio-inner ${selectedMode === 'personal' ? 'active' : ''}`} />
            </div>
          </div>

          {/* 초대 모드 (방 생성) */}
          <div
            className={`session-mode-option ${selectedMode === 'dev' ? 'selected' : ''}`}
            onClick={() => {
              setSelectedMode('dev');
              setInviteCode('');
            }}
          >
            <div className="session-mode-option-icon">🤝</div>
            <div className="session-mode-option-content">
              <h3>새로운 협업 방 만들기</h3>
              <p>친구를 초대하여 실시간으로 함께 지도를 봅니다.</p>
            </div>
            <div className="session-mode-option-radio">
              <div className={`radio-inner ${selectedMode === 'dev' ? 'active' : ''}`} />
            </div>
          </div>

          {/* 초대 코드로 참가 */}
          <div
            className={`session-mode-option ${selectedMode === 'invite' ? 'selected' : ''}`}
            onClick={() => setSelectedMode('invite')}
          >
            <div className="session-mode-option-icon">🎟️</div>
            <div className="session-mode-option-content">
              <h3>초대 코드로 참가</h3>
              <p>친구가 만든 협업 방에 들어갑니다.</p>
            </div>
            <div className="session-mode-option-radio">
              <div className={`radio-inner ${selectedMode === 'invite' ? 'active' : ''}`} />
            </div>
          </div>
        </div>

        {selectedMode === 'invite' && (
          <div className="session-mode-input-group fade-in" style={{ marginTop: '20px' }}>
            <label className="session-mode-label">초대 코드</label>
            <input
              className="session-mode-input"
              type="text"
              placeholder="친구가 알려준 6자리 코드"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
          </div>
        )}

        <button
          className="session-mode-submit"
          onClick={handleSubmit}
          disabled={!selectedMode || isLoading}
          style={{ marginTop: '24px' }}
        >
          {isLoading ? '처리 중...' : '시작하기'}
        </button>
      </div>
    </div>
  );
}

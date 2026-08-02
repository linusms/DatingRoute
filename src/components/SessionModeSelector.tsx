'use client';

import React, { useState } from 'react';

interface SessionModeSelectorProps {
  onSelectPersonal: (nickname: string, password?: string) => void;
  onSelectInvite: (nickname: string) => void;
  onSelectDev: () => void;
  isLocalhost: boolean;
  initialInviteCode?: string | null;
  onJoinInvite?: (code: string, nickname: string) => void;
}

export default function SessionModeSelector({
  onSelectPersonal,
  onSelectInvite,
  onSelectDev,
  isLocalhost,
  initialInviteCode,
  onJoinInvite,
}: SessionModeSelectorProps) {
  const [step, setStep] = useState<'mode' | 'nickname' | 'join'>(
    initialInviteCode ? 'join' : 'mode'
  );
  const [selectedMode, setSelectedMode] = useState<'personal' | 'invite' | null>(null);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState(initialInviteCode || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleModeSelect = (mode: 'personal' | 'invite') => {
    setSelectedMode(mode);
    setStep('nickname');
    setError('');
  };

  const handleNicknameSubmit = async () => {
    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요!');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (selectedMode === 'personal') {
        if (!password.trim()) {
          setError('비밀번호를 입력해주세요!');
          setLoading(false);
          return;
        }
        await onSelectPersonal(nickname.trim(), password.trim());
      } else {
        await onSelectInvite(nickname.trim());
      }
    } catch (e: any) {
      setError(e.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSubmit = async () => {
    if (!inviteCode.trim()) {
      setError('초대코드를 입력해주세요!');
      return;
    }
    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요!');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onJoinInvite?.(inviteCode.trim().toUpperCase(), nickname.trim());
    } catch (e: any) {
      setError(e.message || '유효하지 않은 초대코드입니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="session-mode-overlay">
      <div className="session-mode-container">
        {/* Logo */}
        <div className="session-mode-header">
          <div className="session-mode-logo">💕</div>
          <h1 className="session-mode-title">DatingRoute</h1>
          <p className="session-mode-subtitle">데이트 코스 플래너</p>
        </div>

        {/* Step: Mode Selection */}
        {step === 'mode' && (
          <div className="session-mode-cards animate-fade-in">
            <button
              className="session-mode-card"
              onClick={() => handleModeSelect('personal')}
            >
              <div className="session-mode-card-icon">🔒</div>
              <div className="session-mode-card-title">개인 모드</div>
              <div className="session-mode-card-desc">
                혼자서 데이트 코스를 만들고<br />
                나중에 공유할 수 있어요
              </div>
            </button>

            <button
              className="session-mode-card invite"
              onClick={() => handleModeSelect('invite')}
            >
              <div className="session-mode-card-icon">💑</div>
              <div className="session-mode-card-title">초대 모드</div>
              <div className="session-mode-card-desc">
                초대코드를 보내서<br />
                함께 코스를 만들어요
              </div>
              <div className="session-mode-card-badge">✨ 실시간 협업</div>
            </button>

            <button
              className="session-mode-card join"
              onClick={() => { setStep('join'); setError(''); }}
            >
              <div className="session-mode-card-icon">🎟️</div>
              <div className="session-mode-card-title">초대코드 입력</div>
              <div className="session-mode-card-desc">
                받은 초대코드로<br />
                세션에 참여해요
              </div>
            </button>

            {isLocalhost && (
              <button
                className="session-mode-dev-btn"
                onClick={onSelectDev}
              >
                🛠️ 개발자 모드 (로컬 전용)
              </button>
            )}
          </div>
        )}

        {/* Step: Nickname Input */}
        {step === 'nickname' && (
          <div className="session-mode-nickname animate-fade-in">
            <button className="session-mode-back" onClick={() => setStep('mode')}>
              ← 뒤로
            </button>
            <div className="session-mode-nickname-icon">
              {selectedMode === 'personal' ? '🔒' : '💑'}
            </div>
            <h2 className="session-mode-nickname-title">
              {selectedMode === 'personal' ? '개인 모드' : '초대 모드'}
            </h2>
            <p className="session-mode-nickname-desc">
              {selectedMode === 'personal'
                ? '나만의 코스를 만들어보세요!'
                : '상대방에게 보낼 초대코드가 생성됩니다!'}
            </p>

            <div className="session-mode-input-group">
              <label>{selectedMode === 'personal' ? '아이디 (닉네임)' : '닉네임'}</label>
              <input
                className="session-mode-input"
                placeholder={selectedMode === 'personal' ? "예: minseok" : "예: 민서기 💕"}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (selectedMode === 'personal') {
                      document.getElementById('session-password-input')?.focus();
                    } else {
                      handleNicknameSubmit();
                    }
                  }
                }}
                maxLength={20}
                autoFocus
              />
            </div>

            {selectedMode === 'personal' && (
              <div className="session-mode-input-group" style={{ marginTop: '1rem' }}>
                <label>비밀번호</label>
                <input
                  id="session-password-input"
                  className="session-mode-input"
                  type="password"
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleNicknameSubmit()}
                />
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.5rem', textAlign: 'left' }}>
                  처음이라면 입력한 정보로 자동 가입됩니다.
                </p>
              </div>
            )}

            {error && <div className="session-mode-error" style={{ marginTop: '1rem' }}>{error}</div>}

            <button
              className="session-mode-submit"
              style={{ marginTop: '1.5rem' }}
              onClick={handleNicknameSubmit}
              disabled={loading || !nickname.trim() || (selectedMode === 'personal' && !password.trim())}
            >
              {loading ? '⏳ 처리 중...' : '✨ 시작하기'}
            </button>
          </div>
        )}

        {/* Step: Join via Invite Code */}
        {step === 'join' && (
          <div className="session-mode-nickname animate-fade-in">
            <button className="session-mode-back" onClick={() => { setStep('mode'); setError(''); }}>
              ← 뒤로
            </button>
            <div className="session-mode-nickname-icon">🎟️</div>
            <h2 className="session-mode-nickname-title">초대코드 입력</h2>
            <p className="session-mode-nickname-desc">
              상대방에게 받은 6자리 코드를 입력하세요
            </p>

            <div className="session-mode-input-group">
              <label>초대코드</label>
              <input
                className="session-mode-input invite-code-input"
                placeholder="AB12CD"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase().slice(0, 6))}
                maxLength={6}
                autoFocus
                style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '24px', fontWeight: 700 }}
              />
            </div>

            <div className="session-mode-input-group">
              <label>닉네임</label>
              <input
                className="session-mode-input"
                placeholder="예: 여자친구 💕"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinSubmit()}
                maxLength={20}
              />
            </div>

            {error && <div className="session-mode-error">{error}</div>}

            <button
              className="session-mode-submit"
              onClick={handleJoinSubmit}
              disabled={loading || !inviteCode.trim() || !nickname.trim()}
            >
              {loading ? '⏳ 참여 중...' : '🎉 참여하기'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

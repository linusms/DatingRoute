'use client';

import React, { useState } from 'react';
import type { User } from '@/lib/types';

interface AuthScreenProps {
  onLogin: (user: User) => void;
  /** Present when the user arrived through an invite link: allows joining with a nickname only */
  inviteCode?: string | null;
  /** Name of a shared course waiting to be imported after sign-in */
  importName?: string | null;
}

type Mode = 'guest' | 'login' | 'register';

export default function AuthScreen({ onLogin, inviteCode, importName }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>(inviteCode ? 'guest' : 'login');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!nickname.trim() || (mode !== 'guest' && !password)) {
      setError(mode === 'guest' ? '닉네임을 입력해주세요.' : '닉네임과 비밀번호를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    const endpoint = mode === 'guest' ? '/api/auth/guest' : mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = mode === 'guest'
      ? { nickname: nickname.trim(), inviteCode }
      : { nickname: nickname.trim(), password: password.trim() }; // earlier builds trimmed passwords too

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.user) onLogin(data.user);
      else setError(data.error || '오류가 발생했습니다.');
    } catch {
      setError('서버와 통신할 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const subtitle = inviteCode
    ? '초대를 받았어요! 닉네임만 정하면 바로 함께할 수 있어요.'
    : importName
      ? `'${importName}' 코스를 내 코스로 가져오려면 로그인하세요.`
      : mode === 'register' ? '새로운 계정을 생성하고 시작하세요.' : '계정에 로그인하고 계속 진행하세요.';

  return (
    <div className="fullscreen-center">
      <div className="auth-card">
        <div className="auth-head">
          <h1 className="auth-title">DatingRoute</h1>
          <p className="auth-subtitle">{subtitle}</p>
        </div>

        {inviteCode && (
          <div className="auth-tabs" role="tablist">
            <button role="tab" aria-selected={mode === 'guest'} className={mode === 'guest' ? 'active' : ''} onClick={() => setMode('guest')}>
              닉네임으로 바로 참여
            </button>
            <button role="tab" aria-selected={mode !== 'guest'} className={mode !== 'guest' ? 'active' : ''} onClick={() => setMode('login')}>
              계정으로 로그인
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            className="auth-input"
            type="text"
            placeholder="닉네임"
            maxLength={20}
            autoComplete="username"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          {mode !== 'guest' && (
            <input
              className="auth-input"
              type="password"
              placeholder="비밀번호"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          {mode === 'guest' && (
            <p className="auth-hint">가입 없이 참여해요. 이미 계정이 있다면 &lsquo;계정으로 로그인&rsquo;을 눌러주세요. 나중에 대시보드에서 비밀번호를 정하면 다른 기기에서도 이어서 볼 수 있어요.</p>
          )}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button type="submit" disabled={isLoading} className="auth-submit">
            {isLoading ? '진행 중...' : mode === 'guest' ? '참여하기' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>

        {mode !== 'guest' && (
          <div className="auth-switch">
            <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
              {mode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

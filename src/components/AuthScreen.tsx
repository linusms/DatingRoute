import React, { useState } from 'react';
import type { User } from '@/lib/types';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

export default function AuthScreen({ onLogin }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !password.trim()) {
      alert('닉네임과 비밀번호를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim(), password: password.trim() })
      });

      const data = await res.json();
      if (res.ok && data.user) {
        onLogin(data.user);
      } else {
        alert(data.error || '오류가 발생했습니다.');
      }
    } catch (err) {
      console.error(err);
      alert('서버와 통신할 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100dvh', width: '100%', 
      background: 'var(--color-bg-primary)', 
      position: 'fixed', top: 0, left: 0, zIndex: 1000,
      padding: '24px', boxSizing: 'border-box'
    }}>
      <div style={{
        background: 'var(--color-bg-card)', padding: '40px 32px', borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)', 
        width: '100%', maxWidth: '360px', textAlign: 'center', 
        border: '1px solid var(--color-border)',
      }}>
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ 
            fontSize: '24px', 
            color: 'var(--color-text-primary)',
            fontWeight: '700',
            letterSpacing: '-0.5px',
            margin: '0 0 8px 0'
          }}>
            DatingRoute
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', lineHeight: 1.5, margin: 0, wordBreak: 'keep-all' }}>
            {isLogin ? '계정에 로그인하고 계속 진행하세요.' : '새로운 계정을 생성하고 시작하세요.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="text"
            placeholder="닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            style={{
              padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--color-border)', 
              fontSize: '14px', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)',
              outline: 'none', transition: 'border-color 0.2s', fontWeight: 500
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--color-text-primary)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--color-border)', 
              fontSize: '14px', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)',
              outline: 'none', transition: 'border-color 0.2s', fontWeight: 500
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--color-text-primary)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
          />
          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: '12px 16px', borderRadius: '8px', border: 'none',
              background: 'var(--color-text-primary)', color: 'var(--color-bg-primary)', fontSize: '14px', 
              fontWeight: '600', cursor: isLoading ? 'not-allowed' : 'pointer',
              marginTop: '8px', opacity: isLoading ? 0.7 : 1,
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => { if(!isLoading) e.currentTarget.style.background = '#000'; }}
            onMouseOut={(e) => { if(!isLoading) e.currentTarget.style.background = 'var(--color-text-primary)'; }}
          >
            {isLoading ? '진행 중...' : (isLogin ? '로그인' : '회원가입')}
          </button>
        </form>
        
        <div style={{ marginTop: '24px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            style={{
              background: 'none', border: 'none', color: 'var(--color-text-secondary)', 
              cursor: 'pointer', fontWeight: '500', textDecoration: 'underline', padding: '4px'
            }}
          >
            {isLogin ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
          </button>
        </div>
      </div>
    </div>
  );
}

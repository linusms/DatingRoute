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
    <div className="auth-screen-container" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', width: '100vw', background: 'var(--color-bg-primary)', position: 'fixed', top: 0, left: 0, zIndex: 1000
    }}>
      <div className="auth-card" style={{
        background: 'var(--color-bg-card)', padding: '40px', borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: '360px', textAlign: 'center', 
        backdropFilter: 'blur(10px)', border: '1px solid var(--color-border)'
      }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ 
            fontSize: 'var(--text-3xl)', 
            color: 'var(--color-text-primary)',
            background: 'var(--color-accent-gradient)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontWeight: '800',
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.5px'
          }}>
            DatingRoute
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: '8px' }}>
            {isLogin ? '로그인하여 당신만의 코스를 만들어보세요' : '가입하고 당신만의 코스를 만들어보세요'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="text"
            placeholder="닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            style={{
              padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', 
              fontSize: 'var(--text-base)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)',
              outline: 'none', transition: 'border-color var(--transition-fast)'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--color-accent-primary)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', 
              fontSize: 'var(--text-base)', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)',
              outline: 'none', transition: 'border-color var(--transition-fast)'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--color-accent-primary)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
          />
          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: '14px', borderRadius: 'var(--radius-md)', border: 'none',
              background: 'var(--color-accent-gradient)', color: 'var(--color-text-primary)', fontSize: 'var(--text-base)', 
              fontWeight: '600', cursor: isLoading ? 'not-allowed' : 'pointer',
              marginTop: '8px', boxShadow: 'var(--shadow-glow)', opacity: isLoading ? 0.7 : 1,
              transition: 'opacity var(--transition-fast)'
            }}
          >
            {isLoading ? '처리 중...' : (isLogin ? '로그인' : '회원가입')}
          </button>
        </form>
        
        <p style={{ marginTop: '24px', fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)' }}>
          {isLogin ? '아직 계정이 없으신가요?' : '이미 계정이 있으신가요?'}
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            style={{
              background: 'none', border: 'none', color: 'var(--color-accent-primary)', 
              marginLeft: '8px', cursor: 'pointer', fontWeight: '600',
              textDecoration: 'none'
            }}
            onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            {isLogin ? '회원가입' : '로그인'}
          </button>
        </p>
      </div>
    </div>
  );
}

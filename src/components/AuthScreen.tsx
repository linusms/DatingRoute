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
    <div className="auth-container" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.9)', padding: '40px', borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)', width: '360px', textAlign: 'center', backdropFilter: 'blur(10px)'
      }}>
        <h1 style={{ marginBottom: '24px', fontSize: '28px', color: '#333' }}>
          {isLogin ? '로그인' : '회원가입'}
        </h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="text"
            placeholder="닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            style={{
              padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '16px'
            }}
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '16px'
            }}
          />
          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: '14px', borderRadius: '8px', border: 'none',
              background: '#4CAF50', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? '처리 중...' : (isLogin ? '로그인' : '계정 생성')}
          </button>
        </form>
        
        <p style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
          {isLogin ? '아직 계정이 없으신가요?' : '이미 계정이 있으신가요?'}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            style={{
              background: 'none', border: 'none', color: '#2196F3', marginLeft: '8px', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            {isLogin ? '회원가입' : '로그인으로 돌아가기'}
          </button>
        </p>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import type { SessionMode, User } from '@/lib/types';

interface HeaderProps {
  onOpenManager: () => void;
  courseCount: number;
  sessionMode: SessionMode;
  currentUser?: User | null;
  onLogout?: () => void;
}

export default function Header({ onOpenManager, courseCount, sessionMode, currentUser, onLogout }: HeaderProps) {
  const [isShuttingDown, setIsShuttingDown] = useState(false);

  const handleShutdown = async () => {
    if (confirm("🛑 로컬 서버를 종료하고 사용 중인 메모리(RAM)를 모두 반환하시겠습니까?\n\n종료 후에는 열려 있는 브라우저 창이나 터미널을 편하게 닫으시면 됩니다!")) {
      setIsShuttingDown(true);
      try {
        await fetch('/api/shutdown', { method: 'POST' });
        alert("✅ 모든 데이트 로드맵 서버가 안전하게 종료되고 RAM이 완벽하게 해제되었습니다!\n이제 브라우저 창이나 터미널을 닫으셔도 됩니다.");
      } catch (e) {
        alert("✅ 서버 종료 명령이 실행되었습니다. 브라우저를 닫으셔도 됩니다.");
      }
    }
  };

  return (
    <header className="header" style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '16px 24px', background: 'rgba(26,21,32,0.8)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(244,114,182,0.2)'
    }}>
      <div className="header-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span className="header-logo" style={{ fontSize: '28px' }}>💕</span>
        <div>
          <div className="header-title" style={{ fontSize: '20px', fontWeight: 800, background: 'linear-gradient(to right, #f472b6, #c084fc)', WebkitBackgroundClip: 'text', color: 'transparent' }}>DatingRoute</div>
          <div className="header-subtitle" style={{ fontSize: '12px', color: '#8b7fa8' }}>데이트 코스 플래너</div>
        </div>
      </div>
      <div className="header-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        {courseCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(244,114,182,0.1)', padding: '6px 12px',
            borderRadius: '20px', border: '1px solid rgba(244,114,182,0.2)',
          }}>
            <span style={{ fontSize: '13px', color: '#f472b6', fontWeight: 600 }}>
              📍 {courseCount}곳
            </span>
          </div>
        )}
        <button className="btn btn-secondary" onClick={onOpenManager} style={{
          background: 'rgba(244,114,182,0.1)', color: '#f472b6', border: '1px solid rgba(244,114,182,0.3)',
          padding: '8px 16px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer'
        }}>
          📂 저장된 코스
        </button>

        {currentUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
              👤 {currentUser.nickname}님
            </span>
            {onLogout && (
              <button onClick={onLogout} style={{ fontSize: '12px', color: '#ff4d4f', border: '1px solid rgba(255,77,79,0.5)', borderRadius: '4px', padding: '4px 10px', background: 'rgba(255,77,79,0.1)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}>
                로그아웃
              </button>
            )}
          </div>
        )}

        {/* Show shutdown button only in dev mode (localhost) */}
        {sessionMode === 'dev' && (
          <button 
            onClick={handleShutdown} 
            disabled={isShuttingDown}
            title="로컬 서버를 끄고 메모리(RAM)를 회수합니다"
            style={{
              background: isShuttingDown ? 'rgba(100,100,100,0.3)' : 'rgba(239,68,68,0.15)', 
              color: isShuttingDown ? '#aaa' : '#ef4444', 
              border: isShuttingDown ? '1px solid #555' : '1px solid rgba(239,68,68,0.4)',
              padding: '8px 16px', borderRadius: '8px', fontWeight: 700, 
              display: 'flex', alignItems: 'center', gap: '6px', 
              cursor: isShuttingDown ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isShuttingDown ? 'none' : '0 0 10px rgba(239,68,68,0.2)'
            }}
          >
            {isShuttingDown ? '⏹️ 종료 중...' : '🛑 서버 종료'}
          </button>
        )}
      </div>
    </header>
  );
}

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
  return (
    <header className="header" style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px',
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
      <div className="header-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 1 }}>
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
      </div>
    </header>
  );
}

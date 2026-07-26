'use client';

import React from 'react';

interface HeaderProps {
  onOpenManager: () => void;
  courseCount: number;
}

export default function Header({ onOpenManager, courseCount }: HeaderProps) {
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
      <div className="header-actions" style={{ display: 'flex', gap: '12px' }}>
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
      </div>
    </header>
  );
}

'use client';

import React, { useState } from 'react';
import type { RoomMember } from '@/lib/types';

interface SessionBarProps {
  inviteCode: string | null;
  nickname: string;
  members: RoomMember[];
  isConnected: boolean;
  courseName?: string;
  onUpdateCourseName?: (name: string) => void;
  onCopyInviteCode: () => void;
  onCopyInviteLink: () => void;
  onDisconnect: () => void;
}

export default function SessionBar({
  inviteCode,
  nickname,
  members,
  isConnected,
  courseName,
  onUpdateCourseName,
  onCopyInviteCode,
  onCopyInviteLink,
  onDisconnect,
}: SessionBarProps) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [showMembersPopup, setShowMembersPopup] = useState(false);
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempCourseName, setTempCourseName] = useState('');
  
  React.useEffect(() => {
    if (courseName !== undefined) {
      setTempCourseName(courseName);
    }
  }, [courseName]);

  const handleCopy = (type: 'code' | 'link') => {
    if (type === 'code') {
      onCopyInviteCode();
    } else {
      onCopyInviteLink();
    }
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSaveName = () => {
    if (onUpdateCourseName && tempCourseName.trim()) {
      onUpdateCourseName(tempCourseName.trim());
    }
    setIsEditingName(false);
  };

  const isCollaborative = members.length > 1;
  const memberColors = ['#f472b6', '#c084fc', '#60a5fa', '#34d399', '#fbbf24', '#f87171'];

  return (
    <div className="session-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
      <div className="session-bar-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span className="session-bar-mode" style={{ fontSize: '13px', background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px' }}>
          {isCollaborative ? '👥 협업 중' : '✏️ 편집 중'}
        </span>
        <span className="session-bar-nickname" style={{ fontSize: '14px', fontWeight: 600 }}>{nickname}</span>
        <span className={`session-bar-status ${isConnected ? 'connected' : 'disconnected'}`} style={{ fontSize: '10px' }}>
          {isConnected ? '🟢' : '🔴'}
        </span>
      </div>

      <div className="session-bar-center" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {courseName !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isEditingName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  value={tempCourseName}
                  onChange={(e) => setTempCourseName(e.target.value)}
                  style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '14px', outline: 'none' }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setIsEditingName(false); }}
                  autoFocus
                />
                <button onClick={handleSaveName} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px' }}>💾</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{courseName || '새 코스'}</span>
                <button onClick={() => setIsEditingName(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: 0.7 }}>✏️</button>
              </div>
            )}
          </div>
        )}

        {inviteCode && (
          <div className="session-bar-invite" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(244,114,182,0.1)', padding: '6px 12px', borderRadius: '20px' }}>
            <span className="session-bar-invite-label" style={{ fontSize: '12px', color: '#f472b6' }}>초대코드</span>
            <span className="session-bar-invite-code" style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '1px' }}>{inviteCode}</span>
            <button
              className="session-bar-copy-btn"
              onClick={() => handleCopy('code')}
              title="코드 복사"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {copied === 'code' ? '✅' : '📋'}
            </button>
            <button
              className="session-bar-copy-btn"
              onClick={() => handleCopy('link')}
              title="초대 링크 복사"
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {copied === 'link' ? '✅' : '🔗'}
            </button>
          </div>
        )}
      </div>

      <div className="session-bar-right" style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
        {members.length > 0 && (
          <div 
            className="session-bar-members" 
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setShowMembersPopup(!showMembersPopup)}
          >
            {members.map((m, i) => (
              <div
                key={m.id}
                className="session-bar-member-avatar"
                title={(m.nickname || 'U') + (m.isOwner ? ' (호스트)' : '')}
                style={{
                  backgroundColor: memberColors[i % memberColors.length],
                  zIndex: members.length - i,
                  width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 'bold', marginLeft: i > 0 ? '-8px' : '0', border: '2px solid #1a1520'
                }}
              >
                {(m.nickname || 'U').charAt(0).toUpperCase()}
              </div>
            ))}
            <span className="session-bar-member-count" style={{ marginLeft: '8px', fontSize: '13px', fontWeight: 600 }}>
              {members.length}명
            </span>
          </div>
        )}

        {showMembersPopup && (
          <div style={{
            position: 'absolute', top: '40px', right: '100px', background: '#251e30', border: '1px solid rgba(244,114,182,0.3)', borderRadius: '12px', padding: '12px', zIndex: 1000, minWidth: '200px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#f472b6', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>참가자 목록</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>{m.nickname || 'Unknown'}</span>
                    {m.isOwner && <span style={{ fontSize: '10px', background: 'rgba(244,114,182,0.2)', color: '#f472b6', padding: '2px 4px', borderRadius: '4px' }}>호스트</span>}
                  </div>
                  {m.joinedAt && (
                    <span style={{ fontSize: '11px', color: '#8b7fa8' }}>
                      {new Date(m.joinedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          className="session-bar-exit"
          onClick={onDisconnect}
          title="대시보드로"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(248,113,113,0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
        >
          <span>🏠</span> 대시보드
        </button>
      </div>
    </div>
  );
}

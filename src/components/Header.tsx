'use client';

import React, { useState, useEffect } from 'react';
import type { User, RoomMember } from '@/lib/types';

interface HeaderProps {
  onGoToDashboard: () => void;
  courseCount: number;
  currentUser?: User | null;
  onLogout?: () => void;
  // Session bar props (integrated)
  inviteCode?: string | null;
  nickname?: string;
  members?: RoomMember[];
  isConnected?: boolean;
  courseName?: string;
  onUpdateCourseName?: (name: string) => void;
  onCopyInviteCode?: () => void;
  onCopyInviteLink?: () => void;
}

export default function Header({
  onGoToDashboard,
  courseCount,
  currentUser,
  onLogout,
  inviteCode,
  nickname,
  members = [],
  isConnected = true,
  courseName,
  onUpdateCourseName,
  onCopyInviteCode,
  onCopyInviteLink,
}: HeaderProps) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempCourseName, setTempCourseName] = useState('');
  const [showMembersPopup, setShowMembersPopup] = useState(false);

  useEffect(() => {
    if (courseName !== undefined) setTempCourseName(courseName);
  }, [courseName]);

  const handleCopy = (type: 'code' | 'link') => {
    if (type === 'code') onCopyInviteCode?.();
    else onCopyInviteLink?.();
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
    <header className="header">
      {/* Left: brand + dashboard button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={onGoToDashboard}
          title="대시보드"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px',
            borderRadius: '6px', transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <span style={{ fontSize: '18px', lineHeight: 1 }}>💕</span>
          <span style={{
            fontSize: '15px', fontWeight: 800,
            background: 'linear-gradient(to right, #f472b6, #c084fc)',
            WebkitBackgroundClip: 'text', color: 'transparent',
          }}>
            DatingRoute
          </span>
        </button>

        {/* Course name (editable) */}
        {courseName !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '8px' }}>
            {isEditingName ? (
              <>
                <input
                  value={tempCourseName}
                  onChange={e => setTempCourseName(e.target.value)}
                  style={{
                    background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
                    padding: '3px 6px', borderRadius: '4px', fontSize: '13px', outline: 'none',
                    width: '120px',
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') setIsEditingName(false);
                  }}
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: '2px' }}
                >
                  💾
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {courseName || '새 코스'}
                </span>
                <button
                  onClick={() => setIsEditingName(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', opacity: 0.5, padding: '2px' }}
                  title="이름 편집"
                >
                  ✏️
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Center: invite code (only when collaborative) */}
      {inviteCode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'rgba(244,114,182,0.08)', padding: '4px 10px',
          borderRadius: '16px', border: '1px solid rgba(244,114,182,0.25)',
        }}>
          <span style={{ fontSize: '11px', color: '#f472b6' }}>코드</span>
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '1px', color: '#f5f0ff' }}>{inviteCode}</span>
          <button
            onClick={() => handleCopy('code')}
            title="코드 복사"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: '2px' }}
          >
            {copied === 'code' ? '✅' : '📋'}
          </button>
          <button
            onClick={() => handleCopy('link')}
            title="링크 복사"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: '2px' }}
          >
            {copied === 'link' ? '✅' : '🔗'}
          </button>
        </div>
      )}

      {/* Right: status + members + user */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
        {/* Connection status dot */}
        <span
          title={isConnected ? '연결됨' : '연결 끊김'}
          style={{ fontSize: '8px', lineHeight: 1 }}
        >
          {isConnected ? '🟢' : '🔴'}
        </span>

        {/* Collaborative mode label */}
        {isCollaborative && (
          <span style={{
            fontSize: '11px', background: 'rgba(255,255,255,0.07)',
            padding: '2px 6px', borderRadius: '4px', color: '#c084fc', fontWeight: 600,
          }}>
            👥 {members.length}명
          </span>
        )}

        {/* Member avatars (collaborative) */}
        {isCollaborative && (
          <div
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setShowMembersPopup(!showMembersPopup)}
            title="참가자 목록"
          >
            {members.slice(0, 3).map((m, i) => (
              <div
                key={m.id}
                title={(m.nickname || 'U') + (m.isOwner ? ' (호스트)' : '')}
                style={{
                  backgroundColor: memberColors[i % memberColors.length],
                  zIndex: members.length - i,
                  width: '22px', height: '22px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '10px', fontWeight: 'bold',
                  marginLeft: i > 0 ? '-6px' : '0', border: '1.5px solid #1a1520',
                }}
              >
                {(m.nickname || 'U').charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        )}

        {/* Members popup */}
        {showMembersPopup && (
          <div style={{
            position: 'absolute', top: '36px', right: '0',
            background: '#251e30', border: '1px solid rgba(244,114,182,0.3)',
            borderRadius: '10px', padding: '10px', zIndex: 1000,
            minWidth: '160px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#f472b6', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
              참가자
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{m.nickname || 'Unknown'}</span>
                  {m.isOwner && (
                    <span style={{ fontSize: '10px', background: 'rgba(244,114,182,0.2)', color: '#f472b6', padding: '1px 4px', borderRadius: '3px' }}>
                      호스트
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Course count badge */}
        {courseCount > 0 && (
          <span style={{
            fontSize: '11px', color: '#f472b6', fontWeight: 600,
            background: 'rgba(244,114,182,0.1)', padding: '3px 8px',
            borderRadius: '10px', border: '1px solid rgba(244,114,182,0.2)',
          }}>
            {courseCount}곳
          </span>
        )}

        {/* User + logout */}
        {currentUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#b4a9c9', fontWeight: 500 }}>
              {currentUser.nickname}
            </span>
            {onLogout && (
              <button
                onClick={onLogout}
                style={{
                  fontSize: '11px', color: '#f87171',
                  border: '1px solid rgba(248,113,113,0.4)',
                  borderRadius: '4px', padding: '3px 7px',
                  background: 'rgba(248,113,113,0.08)',
                  cursor: 'pointer', fontWeight: 600,
                }}
              >
                로그아웃
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

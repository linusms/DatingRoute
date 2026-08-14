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
  const memberColors = ['var(--color-accent-primary)', 'var(--color-accent-secondary)', 'var(--color-warning)', 'var(--color-text-secondary)', 'var(--color-text-tertiary)'];

  return (
    <header className="header" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 var(--space-lg)',
      height: 'var(--header-height)',
      background: 'var(--color-bg-card)',
      borderBottom: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-sm)'
    }}>
      {/* Left: brand + dashboard button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        <button
          onClick={onGoToDashboard}
          title="대시보드"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px',
            borderRadius: 'var(--radius-sm)', transition: 'background var(--transition-fast)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-secondary)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <span style={{ fontSize: '18px', lineHeight: 1 }}>🤍</span>
          <span style={{
            fontSize: '15px', fontWeight: 700,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.3px'
          }}>
            DatingRoute
          </span>
        </button>

        {/* Course name (editable) */}
        {courseName !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid var(--color-border)', paddingLeft: '12px', marginLeft: '4px' }}>
            {isEditingName ? (
              <>
                <input
                  value={tempCourseName}
                  onChange={e => setTempCourseName(e.target.value)}
                  style={{
                    background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)',
                    padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontSize: '13px', outline: 'none',
                    width: '140px',
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') setIsEditingName(false);
                  }}
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: '4px' }}
                >
                  💾
                </button>
              </>
            ) : (
              <>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {courseName || '새 코스'}
                </span>
                <button
                  onClick={() => setIsEditingName(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', opacity: 0.6, padding: '4px' }}
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
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--color-bg-secondary)', padding: '6px 12px',
          borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)',
        }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>코드</span>
          <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px', color: 'var(--color-text-primary)' }}>{inviteCode}</span>
          <button
            onClick={() => handleCopy('code')}
            title="코드 복사"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '2px' }}
          >
            {copied === 'code' ? '✅' : '📋'}
          </button>
          <button
            onClick={() => handleCopy('link')}
            title="링크 복사"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: '2px' }}
          >
            {copied === 'link' ? '✅' : '🔗'}
          </button>
        </div>
      )}

      {/* Right: status + members + user */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
        {/* Connection status dot */}
        <span
          title={isConnected ? '연결됨' : '연결 끊김'}
          style={{ fontSize: '10px', lineHeight: 1 }}
        >
          {isConnected ? '🟢' : '🔴'}
        </span>

        {/* Collaborative mode label */}
        {isCollaborative && (
          <span style={{
            fontSize: '12px', background: 'var(--color-bg-secondary)',
            padding: '4px 8px', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-secondary)', fontWeight: 600,
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
                  width: '26px', height: '26px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '12px', fontWeight: 'bold',
                  marginLeft: i > 0 ? '-8px' : '0', border: '2px solid var(--color-bg-card)',
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
            position: 'absolute', top: '44px', right: '0',
            background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', padding: '12px', zIndex: 1000,
            minWidth: '180px', boxShadow: 'var(--shadow-lg)',
          }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
              참가자
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{m.nickname || 'Unknown'}</span>
                  {m.isOwner && (
                    <span style={{ fontSize: '11px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', padding: '2px 6px', borderRadius: 'var(--radius-sm)' }}>
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
            fontSize: '12px', color: 'var(--color-accent-primary)', fontWeight: 600,
            background: 'var(--color-accent-glow)', padding: '4px 10px',
            borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border)',
          }}>
            {courseCount}곳
          </span>
        )}

        {/* User + logout */}
        {currentUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '1px solid var(--color-border)', paddingLeft: '12px' }}>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              {currentUser.nickname}
            </span>
            {onLogout && (
              <button
                onClick={onLogout}
                style={{
                  fontSize: '12px', color: 'var(--color-error)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)', padding: '4px 10px',
                  background: 'var(--color-bg-card)',
                  cursor: 'pointer', fontWeight: 500,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-secondary)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--color-bg-card)'}
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

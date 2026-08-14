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
      padding: '0 var(--space-md)',
      height: 'var(--header-height)',
      background: 'var(--color-bg-card)',
      borderBottom: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-sm)',
      gap: '8px'
    }}>
      {/* Left: brand + dashboard button */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          onClick={onGoToDashboard}
          title="대시보드"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px', padding: '4px',
            borderRadius: 'var(--radius-sm)', transition: 'background var(--transition-fast)',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-secondary)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <span style={{ fontSize: '18px', lineHeight: 1 }}>🤍</span>
          <span style={{
            fontSize: '16px', fontWeight: 700,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.3px'
          }}>
            DatingRoute
          </span>
        </button>
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
        
        {/* Share Link Icon */}
        {inviteCode && (
          <button
            onClick={() => handleCopy('link')}
            title="초대 링크 복사"
            style={{
              background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', cursor: 'pointer',
              width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px'
            }}
          >
            {copied === 'link' ? '✅' : '🔗'}
          </button>
        )}

        {/* Participants Icon */}
        <div
          style={{ 
            background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', cursor: 'pointer',
            height: '32px', borderRadius: '16px', display: 'flex', alignItems: 'center', padding: '0 10px', gap: '4px',
            fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)'
          }}
          onClick={() => setShowMembersPopup(!showMembersPopup)}
          title="참가자 목록"
        >
          <span>👥</span>
          <span>{members.length}</span>
        </div>

        {/* Members popup */}
        {showMembersPopup && (
          <div style={{
            position: 'absolute', top: '40px', right: '0',
            background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)', padding: '12px', zIndex: 1000,
            minWidth: '180px', boxShadow: 'var(--shadow-lg)',
          }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
              참가자 ({members.length}명)
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

        {/* Logout Icon */}
        {currentUser && onLogout && (
          <button
            onClick={onLogout}
            title="로그아웃"
            style={{
              fontSize: '16px', color: 'var(--color-error)',
              border: 'none', background: 'transparent',
              width: '32px', height: '32px', borderRadius: '50%',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            🚪
          </button>
        )}
      </div>
    </header>
  );
}

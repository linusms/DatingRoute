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
              background: 'transparent', border: 'none', cursor: 'pointer',
              width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: copied === 'link' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
              transition: 'background 0.2s, color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-secondary)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {copied === 'link' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            )}
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

        {/* Dashboard Icon */}
        <button
          onClick={onGoToDashboard}
          title="대시보드로 이동"
          style={{
            fontSize: '16px', color: 'var(--color-text-secondary)',
            border: 'none', background: 'transparent',
            width: '32px', height: '32px', borderRadius: '50%',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s, color 0.2s', marginLeft: '4px'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-secondary)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>

        {/* Logout Icon */}
        {currentUser && onLogout && (
          <button
            onClick={onLogout}
            title="로그아웃"
            style={{
              fontSize: '16px', color: 'var(--color-text-secondary)',
              border: 'none', background: 'transparent',
              width: '32px', height: '32px', borderRadius: '50%',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s, color 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-secondary)'; e.currentTarget.style.color = 'var(--color-error)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}

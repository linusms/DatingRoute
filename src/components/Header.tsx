'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { User, RoomMember } from '@/lib/types';

interface HeaderProps {
  onGoToDashboard: () => void;
  currentUser?: User | null;
  onLogout?: () => void;
  inviteCode?: string | null;
  members?: RoomMember[];
  onlineUserIds?: string[];
  isConnected?: boolean;
  onCopyInviteCode?: () => void;
  onCopyInviteLink?: () => void;
}

export default function Header({
  onGoToDashboard,
  currentUser,
  onLogout,
  inviteCode,
  members = [],
  onlineUserIds = [],
  isConnected = true,
  onCopyInviteCode,
  onCopyInviteLink,
}: HeaderProps) {
  const [copied, setCopied] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const online = new Set(onlineUserIds);
  const onlineCount = members.filter((m) => online.has(m.userId)).length;

  useEffect(() => {
    if (!showMembers) return;
    const close = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setShowMembers(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showMembers]);

  const copyLink = () => {
    onCopyInviteLink?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="app-header">
      <button className="app-header-brand" onClick={onGoToDashboard} title="대시보드">
        <span className="app-header-logo">🤍</span>
        <span className="app-header-title">DatingRoute</span>
      </button>

      <div className="app-header-actions">
        {!isConnected && <span className="app-header-offline" title="실시간 연결이 끊겼어요. 다시 연결하는 중...">● 오프라인</span>}

        {inviteCode && (
          <button className={`icon-btn ${copied ? 'is-active' : ''}`} onClick={copyLink} title="초대 링크 복사">
            {copied ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            )}
          </button>
        )}

        <div className="app-header-members" ref={popupRef}>
          <button className="member-pill" onClick={() => setShowMembers((v) => !v)} title="참가자 목록" aria-expanded={showMembers}>
            <span>👥</span>
            <span>{members.length}</span>
            {members.length > 1 && onlineCount > 0 && <span className="member-pill-online">{onlineCount} 접속</span>}
          </button>

          {showMembers && (
            <div className="member-popup">
              <h4>참가자 ({members.length}명)</h4>
              <ul>
                {members.map((m) => (
                  <li key={m.userId}>
                    <span className={`presence-dot ${online.has(m.userId) ? 'on' : ''}`} title={online.has(m.userId) ? '지금 보는 중' : '오프라인'} />
                    <span className="member-name">{m.nickname || 'Unknown'}{m.userId === currentUser?.id ? ' (나)' : ''}</span>
                    {m.isOwner && <span className="member-tag">호스트</span>}
                  </li>
                ))}
              </ul>
              {inviteCode && (
                <div className="member-popup-invite">
                  <span>초대코드 <strong>{inviteCode}</strong></span>
                  <button className="cb-chip-btn" onClick={onCopyInviteCode}>복사</button>
                  <button className="cb-chip-btn" onClick={copyLink}>링크 복사</button>
                </div>
              )}
            </div>
          )}
        </div>

        <button className="icon-btn" onClick={onGoToDashboard} title="대시보드로 이동">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>

        {currentUser && onLogout && (
          <button className="icon-btn danger" onClick={onLogout} title="로그아웃">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}

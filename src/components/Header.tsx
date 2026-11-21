'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { User, RoomMember } from '@/lib/types';

interface HeaderProps {
  onGoToDashboard: () => void;
  currentUser?: User | null;
  onLogout?: () => void;
  members?: RoomMember[];
  onlineUserIds?: string[];
  isConnected?: boolean;
  /** Content of the members popup (see MembersPanel) */
  membersPanel?: React.ReactNode;
}

export default function Header({
  onGoToDashboard,
  currentUser,
  onLogout,
  members = [],
  onlineUserIds = [],
  isConnected = true,
  membersPanel,
}: HeaderProps) {
  const [showMembers, setShowMembers] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const online = new Set(onlineUserIds);
  const onlineCount = members.filter((m) => online.has(m.userId)).length;

  useEffect(() => {
    if (!showMembers) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setShowMembers(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMembers(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [showMembers]);

  return (
    <header className="app-header">
      <button className="app-header-brand" onClick={onGoToDashboard} title="대시보드">
        <span className="app-header-logo">🤍</span>
        <span className="app-header-title">DatingRoute</span>
      </button>

      <div className="app-header-actions">
        {!isConnected && <span className="app-header-offline" title="실시간 연결이 끊겼어요. 다시 연결하는 중...">● 오프라인</span>}

        <div className="app-header-members" ref={popupRef}>
          <button className="member-pill" onClick={() => setShowMembers((v) => !v)} title="함께 편집하는 사람" aria-expanded={showMembers}>
            <span>👥</span>
            <span>{members.length}</span>
            {members.length > 1 && onlineCount > 0 && <span className="member-pill-online">{onlineCount} 접속</span>}
          </button>

          {showMembers && membersPanel && (
            <div className="member-popup" role="dialog" aria-label="함께 편집하는 사람">
              {membersPanel}
            </div>
          )}
        </div>

        <button className="icon-btn" onClick={onGoToDashboard} title="대시보드로 이동" aria-label="대시보드로 이동">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>

        {currentUser && onLogout && (
          <button className="icon-btn danger" onClick={onLogout} title="로그아웃" aria-label="로그아웃">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}

'use client';

import React, { useState } from 'react';
import type { RoomMember } from '@/lib/types';

interface SessionBarProps {
  inviteCode: string | null;
  nickname: string;
  members: RoomMember[];
  isConnected: boolean;
  onCopyInviteCode: () => void;
  onCopyInviteLink: () => void;
  onDisconnect: () => void;
}

export default function SessionBar({
  inviteCode,
  nickname,
  members,
  isConnected,
  onCopyInviteCode,
  onCopyInviteLink,
  onDisconnect,
}: SessionBarProps) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const handleCopy = (type: 'code' | 'link') => {
    if (type === 'code') {
      onCopyInviteCode();
    } else {
      onCopyInviteLink();
    }
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const isCollaborative = members.length > 1;
  const memberColors = ['#f472b6', '#c084fc', '#60a5fa', '#34d399', '#fbbf24', '#f87171'];

  return (
    <div className="session-bar">
      <div className="session-bar-left">
        <span className="session-bar-mode">
          {isCollaborative ? '👥 협업 중' : '✏️ 편집 중'}
        </span>
        <span className="session-bar-nickname">{nickname}</span>
        <span className={`session-bar-status ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? '🟢' : '🔴'}
        </span>
      </div>

      <div className="session-bar-center">
        {inviteCode && (
          <div className="session-bar-invite">
            <span className="session-bar-invite-label">초대코드</span>
            <span className="session-bar-invite-code">{inviteCode}</span>
            <button
              className="session-bar-copy-btn"
              onClick={() => handleCopy('code')}
              title="코드 복사"
            >
              {copied === 'code' ? '✅' : '📋'}
            </button>
            <button
              className="session-bar-copy-btn"
              onClick={() => handleCopy('link')}
              title="초대 링크 복사"
            >
              {copied === 'link' ? '✅' : '🔗'}
            </button>
          </div>
        )}
      </div>

      <div className="session-bar-right">
        {members.length > 0 && (
          <div className="session-bar-members">
            {members.map((m, i) => (
              <div
                key={m.id}
                className="session-bar-member-avatar"
                title={(m.nickname || 'U') + (m.isOwner ? ' (호스트)' : '')}
                style={{
                  backgroundColor: memberColors[i % memberColors.length],
                  zIndex: members.length - i,
                }}
              >
                {(m.nickname || 'U').charAt(0).toUpperCase()}
              </div>
            ))}
            <span className="session-bar-member-count">
              {members.length}명
            </span>
          </div>
        )}

        <button
          className="session-bar-exit"
          onClick={onDisconnect}
          title="대시보드로"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#f87171' }}
        >
          <span>🏠</span> 대시보드
        </button>
      </div>
    </div>
  );
}

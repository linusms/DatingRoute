'use client';

import { useState } from 'react';
import type { RoomMember } from '@/lib/types';

export const REACTION_EMOJIS = ['❤️', '👍', '🤔', '❌'];

interface ReactionBarProps {
  reactions: Record<string, string>;
  currentUserId: string;
  members: RoomMember[];
  onReact: (emoji: string | null) => void;
}

export default function ReactionBar({ reactions, currentUserId, members, onReact }: ReactionBarProps) {
  const [picker, setPicker] = useState<'emoji' | 'list' | null>(null);
  const grouped = Object.entries(reactions).reduce<Record<string, string[]>>((acc, [uid, emoji]) => {
    (acc[emoji] ||= []).push(uid);
    return acc;
  }, {});
  const mine = reactions[currentUserId] ?? null;
  const nameOf = (uid: string) => (uid === currentUserId ? '나' : members.find((m) => m.userId === uid)?.nickname || '참여자');

  return (
    <div className="cb-reactions" onClick={(e) => e.stopPropagation()}>
      {Object.entries(grouped).map(([emoji, uids]) => (
        <button
          key={emoji}
          className={`cb-reaction ${uids.includes(currentUserId) ? 'mine' : ''}`}
          onClick={() => onReact(mine === emoji ? null : emoji)}
          title={uids.map(nameOf).join(', ')}
        >
          <span>{emoji}</span>
          <span className="cb-reaction-count">{uids.length}</span>
        </button>
      ))}

      <div className="cb-popover-anchor">
        <button className="cb-reaction" onClick={() => setPicker(picker === 'emoji' ? null : 'emoji')} aria-label="반응 추가">
          😀+
        </button>
        {picker === 'emoji' && (
          <div className="cb-popover cb-emoji-picker">
            {REACTION_EMOJIS.map((emoji) => (
              <button key={emoji} onClick={() => { onReact(mine === emoji ? null : emoji); setPicker(null); }}>
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {Object.keys(reactions).length > 0 && (
        <div className="cb-popover-anchor">
          <button className="cb-reaction" onClick={() => setPicker(picker === 'list' ? null : 'list')}>
            목록 💬
          </button>
          {picker === 'list' && (
            <div className="cb-popover cb-reaction-list">
              <div className="cb-popover-title">반응한 사람</div>
              {Object.entries(reactions).map(([uid, emoji]) => (
                <div key={uid} className="cb-reaction-list-row">
                  <span>{nameOf(uid)}</span>
                  <span>{emoji}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

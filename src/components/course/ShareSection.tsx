'use client';

import { useState } from 'react';
import type { CoursePlace, DateSchedule, DirectionResult, TransitMode } from '@/lib/types';
import ShareCard from '../ShareCard';

interface ShareSectionProps {
  places: CoursePlace[];
  directions: DirectionResult | null;
  schedule: DateSchedule | null;
  transitMode: TransitMode;
  courseName: string;
  onShareKakao: () => void;
  onCopyShareLink: () => void;
  onCopyInviteLink?: () => void;
}

export default function ShareSection({ places, directions, schedule, transitMode, courseName, onShareKakao, onCopyShareLink, onCopyInviteLink }: ShareSectionProps) {
  const [showCard, setShowCard] = useState(false);
  return (
    <>
      <div className="route-share-section">
        <div className="route-share-label">📤 코스 공유하기</div>
        <div className="route-share-buttons">
          <button className="route-share-btn kakao" onClick={onShareKakao}>💬 카카오톡</button>
          <button className="route-share-btn link" onClick={onCopyShareLink} title="누구나 볼 수 있는 읽기 전용 링크">🔗 보기 링크</button>
          <button className="route-share-btn image" onClick={() => setShowCard((v) => !v)}>📷 이미지</button>
        </div>
        {onCopyInviteLink && (
          <button className="cb-text-btn" onClick={onCopyInviteLink}>✏️ 함께 편집할 새로운 사람 초대 링크 복사</button>
        )}
      </div>
      {showCard && (
        <div className="animate-slide-up">
          <ShareCard places={places} directions={directions} schedule={schedule} transitMode={transitMode} courseName={courseName} />
        </div>
      )}
    </>
  );
}

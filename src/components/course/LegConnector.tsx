'use client';

import type { CoursePlace, DirectionLeg, TransitMode } from '@/lib/types';
import { formatDistance, formatDuration, getWalkingTimeMs } from '@/lib/utils';
import { kakaoRouteUrl } from '@/lib/links';

interface LegConnectorProps {
  from: CoursePlace;
  to: CoursePlace;
  leg: DirectionLeg | null;
  transitMode: TransitMode;
  /** Estimated travel minutes when no route has been computed */
  estimatedMinutes?: number;
}

/** Between two places of the same day: travel info and map links for that leg. */
export default function LegConnector({ from, to, leg, transitMode, estimatedMinutes }: LegConnectorProps) {
  const icon = transitMode === 'driving' ? '🚗' : '🚶';
  return (
    <div className="course-leg-connector animate-fade-in">
      <div className="course-leg-line" />
      <div className="course-leg-info-card">
        {leg ? (
          <>
            <span>{icon}</span>
            <span>{formatDistance(leg.distance)}</span>
            <span className="course-leg-divider">·</span>
            <span>{transitMode === 'driving' ? formatDuration(leg.duration) : `도보 ${formatDuration(getWalkingTimeMs(leg.distance))}`}</span>
          </>
        ) : estimatedMinutes ? (
          <span className="cb-muted">{icon} 약 {estimatedMinutes}분</span>
        ) : null}
        <a
          className="cb-leg-link"
          href={kakaoRouteUrl(from, to, 'traffic')}
          target="_blank"
          rel="noreferrer"
          title="카카오맵 대중교통 길찾기"
          onClick={(e) => e.stopPropagation()}
        >
          🚇 대중교통
        </a>
        <a
          className="cb-leg-link"
          href={kakaoRouteUrl(from, to, transitMode === 'driving' ? 'car' : 'walk')}
          target="_blank"
          rel="noreferrer"
          title="카카오맵 길찾기"
          onClick={(e) => e.stopPropagation()}
        >
          {transitMode === 'driving' ? '🚗 길찾기' : '🚶 길찾기'}
        </a>
      </div>
      <div className="course-leg-line" />
    </div>
  );
}

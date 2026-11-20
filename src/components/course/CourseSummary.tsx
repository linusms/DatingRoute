'use client';

import type { DirectionResult, TransitMode } from '@/lib/types';
import { formatDuration, getWalkingTimeMs } from '@/lib/utils';
import { formatClock, formatWon } from '@/lib/timeline';

interface CourseSummaryProps {
  isRouteCreated: boolean;
  directions: DirectionResult | null;
  transitMode: TransitMode;
  onChangeTransitMode: (mode: TransitMode) => void;
  /** Planned time window of the active day (minutes from midnight) */
  timeWindow: { start: number; end: number; overEnd: boolean; endTime?: string } | null;
  totalCost: number;
  memberCount: number;
  scopeLabel: string;
}

export default function CourseSummary({
  isRouteCreated,
  directions,
  transitMode,
  onChangeTransitMode,
  timeWindow,
  totalCost,
  memberCount,
  scopeLabel,
}: CourseSummaryProps) {
  const showRoute = isRouteCreated && directions;
  if (!showRoute && !timeWindow && totalCost <= 0) return null;

  const routeDuration = showRoute
    ? transitMode === 'driving' ? directions.totalDuration : getWalkingTimeMs(directions.totalDistance)
    : 0;

  return (
    <div className="cb-summary animate-fade-in">
      {showRoute && (
        <>
          <div className="cb-segmented">
            <button className={transitMode === 'driving' ? 'active' : ''} onClick={() => onChangeTransitMode('driving')}>🚗 자동차</button>
            <button className={transitMode === 'walking' ? 'active' : ''} onClick={() => onChangeTransitMode('walking')}>🚶 도보(예상)</button>
          </div>
          <div className="cb-summary-row">
            <div>
              <div className="cb-summary-label">총 이동 시간</div>
              <div className="cb-summary-value">{formatDuration(routeDuration)}</div>
            </div>
            <div className="cb-summary-right">
              <div className="cb-summary-label">총 이동 거리</div>
              <div className="cb-summary-value accent">{(directions.totalDistance / 1000).toFixed(1)}km</div>
            </div>
          </div>
        </>
      )}

      {(timeWindow || totalCost > 0) && (
        <div className="cb-summary-row cb-summary-sub">
          {timeWindow && (
            <div>
              <div className="cb-summary-label">{scopeLabel} 예상 일정</div>
              <div className={`cb-summary-small ${timeWindow.overEnd ? 'warn' : ''}`}>
                {formatClock(timeWindow.start)} – {formatClock(timeWindow.end)}
                {timeWindow.overEnd && timeWindow.endTime && ` (종료 ${timeWindow.endTime} 초과)`}
              </div>
            </div>
          )}
          {totalCost > 0 && (
            <div className="cb-summary-right">
              <div className="cb-summary-label">{scopeLabel} 예상 비용</div>
              <div className="cb-summary-small">
                {formatWon(totalCost)}
                {memberCount > 1 && <span className="cb-muted"> · 1인 {formatWon(totalCost / memberCount)}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

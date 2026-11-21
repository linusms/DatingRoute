'use client';

import { useState, type DragEvent } from 'react';
import { FACILITY_ICONS, FACILITY_LABELS, type CoursePlace, type PlaceUpdatableFields, type RoomMember } from '@/lib/types';
import { parseCategoryToFacility, stripHtml } from '@/lib/utils';
import { formatClock, formatWon, isLikelyClosed, stayMinutesOf, type TimelineEntry } from '@/lib/timeline';
import { kakaoDirectionsToUrl } from '@/lib/links';
import { usePlaceInfo } from '@/hooks/usePlaceInfo';
import type { ReviewMode } from '../ReviewPanel';
import PlaceLinks from '../PlaceLinks';
import ReactionBar from './ReactionBar';
import MemoryEditor from './MemoryEditor';

const STAY_OPTIONS = [0, 30, 60, 90, 120, 150, 180, 240];

export interface DragHandlers {
  draggable: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnter: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDragEnd: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
}

interface PlaceCardProps {
  place: CoursePlace;
  number: number;
  isStorageTab: boolean;
  isMultiDay: boolean;
  dayCount: number;
  isRouteCreated: boolean;
  isSelectMode: boolean;
  isSelected: boolean;
  assignedDays: number[];
  isConfirmed: boolean;
  timeline?: TimelineEntry;
  dayDate: string | null;
  isToday: boolean;
  currentUserId: string;
  members: RoomMember[];
  drag: DragHandlers | null;
  getDayLabel: (day: number) => string;
  onToggleSelect: () => void;
  onShowReview: (mode: ReviewMode) => void;
  onHighlight: (on: boolean) => void;
  onChangeDay: (day: number) => void;
  onToggleDayCopy: (day: number) => void;
  onRemove: () => void;
  onUpdate: (fields: PlaceUpdatableFields) => void;
  onReact: (emoji: string | null) => void;
  onOpenSimilar: () => void;
  onUploadPhoto: (file: Blob | null) => Promise<void>;
  /** Reorder without drag & drop (touch screens). Undefined when that direction isn't possible. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export default function PlaceCard(props: PlaceCardProps) {
  const {
    place, number, isStorageTab, isMultiDay, dayCount, isRouteCreated, isSelectMode, isSelected,
    assignedDays, isConfirmed, timeline, dayDate, isToday, currentUserId, members, drag,
  } = props;
  const [expanded, setExpanded] = useState(false);
  const [memo, setMemo] = useState(place.memo || '');
  const [cost, setCost] = useState(place.cost != null ? String(place.cost) : '');

  // Re-sync drafts when the server copy changes (another member edited)
  const [synced, setSynced] = useState({ memo: place.memo || '', cost: place.cost });
  if ((place.memo || '') !== synced.memo || place.cost !== synced.cost) {
    setSynced({ memo: place.memo || '', cost: place.cost });
    setMemo(place.memo || '');
    setCost(place.cost != null ? String(place.cost) : '');
  }

  const placeDay = place.day ?? 0;
  const inDay = placeDay > 0;
  const title = stripHtml(place.title);
  const facility = parseCategoryToFacility(place.category);
  const info = usePlaceInfo(title, place.mapx, place.mapy, inDay && !isStorageTab && (expanded || !!dayDate));
  const closed = isLikelyClosed(info?.restDate, dayDate);
  const visited = !!place.visitedAt;
  const dimmed = place.isHold || (isStorageTab && assignedDays.length > 0);

  const saveCost = () => {
    const digits = cost.replace(/[^\d]/g, '');
    const value = digits ? Math.min(100_000_000, parseInt(digits, 10)) : null;
    if (value !== (place.cost ?? null)) props.onUpdate({ cost: value });
    setCost(value != null ? String(value) : '');
  };

  return (
    <div
      className={`cb-place ${dimmed ? 'is-dimmed' : ''} ${visited ? 'is-visited' : ''} ${isSelected ? 'is-selected' : ''} ${drag?.draggable ? 'is-draggable' : ''}`}
      draggable={drag?.draggable}
      onDragStart={drag?.onDragStart}
      onDragEnter={drag?.onDragEnter}
      onDragOver={drag?.onDragOver}
      onDragEnd={drag?.onDragEnd}
      onDrop={drag?.onDrop}
      onMouseEnter={() => !isSelectMode && props.onHighlight(true)}
      onMouseLeave={() => !isSelectMode && props.onHighlight(false)}
      onClick={() => { if (isSelectMode && isStorageTab) props.onToggleSelect(); }}
    >
      <div className="cb-place-main">
        {isSelectMode && isStorageTab ? (
          <input type="checkbox" className="cb-checkbox" checked={isSelected} readOnly aria-label="선택" />
        ) : inDay ? (
          <div className={`cb-place-number ${visited ? 'done' : ''}`}>{visited ? '✓' : number}</div>
        ) : null}

        <div className="cb-place-body">
          <div className="cb-place-title-row">
            <button
              className="cb-place-title"
              onClick={(e) => { e.stopPropagation(); if (!isSelectMode) props.onShowReview('reviews'); }}
              title="후기 보기"
            >
              {title}
            </button>
            <span className="facility-badge" title={FACILITY_LABELS[facility]}>{FACILITY_ICONS[facility]}</span>
            {place.category && <span className="cb-place-category">{place.category}</span>}
          </div>

          <div className="cb-badges">
            {isConfirmed && <span className="cb-badge love">💖 모두 찜</span>}
            {place.isHold && <span className="cb-badge hold">보류됨</span>}
            {isStorageTab && isRouteCreated && assignedDays.length > 0 && <span className="cb-badge assigned">Day {assignedDays.join(', ')} 포함됨</span>}
            {closed && <span className="cb-badge warn">⚠️ 휴무일일 수 있어요</span>}
          </div>

          <div className="cb-place-address">{place.roadAddress || place.address}</div>

          {timeline && inDay && !isStorageTab && (
            <div className={`cb-place-time ${timeline.overEnd ? 'warn' : ''}`}>
              🕐 {formatClock(timeline.arrival)}–{formatClock(timeline.departure)}
              <select
                className="cb-stay-select"
                value={STAY_OPTIONS.includes(stayMinutesOf(place)) ? stayMinutesOf(place) : 'custom'}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => props.onUpdate({ stayMinutes: Number(e.target.value) })}
                aria-label="머무는 시간"
              >
                {!STAY_OPTIONS.includes(stayMinutesOf(place)) && <option value="custom">{stayMinutesOf(place)}분</option>}
                {STAY_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m === 0 ? '잠깐 들르기' : m < 60 ? `${m}분` : `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}`}</option>
                ))}
              </select>
              {timeline.overEnd && <span className="cb-warn-text">종료 시간 이후</span>}
            </div>
          )}

          {info?.found && inDay && !isStorageTab && (
            <div className="cb-place-hours">
              {info.hours && <span>영업 {info.hours}</span>}
              {info.restDate && <span>휴무 {info.restDate}</span>}
            </div>
          )}

          {!expanded && place.memo && <div className="cb-place-memo-preview">📝 {place.memo}</div>}
          {!expanded && (place.cost ?? 0) > 0 && <div className="cb-place-memo-preview">💰 {formatWon(place.cost ?? 0)}</div>}
        </div>

        {!isRouteCreated && !isSelectMode && (
          <div className="cb-place-side">
            <button
              className="cb-remove-btn"
              onClick={(e) => { e.stopPropagation(); props.onRemove(); }}
              title={inDay ? '보관함으로 되돌리기' : '완전 삭제'}
              aria-label={inDay ? '보관함으로 되돌리기' : '완전 삭제'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className={`cb-place-footer ${inDay || (isSelectMode && isStorageTab) ? 'indented' : ''}`}>
          <PlaceLinks
            className="cb-place-links"
            title={title}
            homepage={place.link}
            onShowReview={isSelectMode ? undefined : () => props.onShowReview('reviews')}
            onShowSummary={isSelectMode ? undefined : () => props.onShowReview('summary')}
          >
            {isToday && inDay && (
              <a href={kakaoDirectionsToUrl(place)} target="_blank" rel="noreferrer" className="cb-link-chip">🧭 여기로 길찾기</a>
            )}
          </PlaceLinks>

          {!isSelectMode && (
            <div className="cb-place-controls" onClick={(e) => e.stopPropagation()}>
              {!isRouteCreated && isStorageTab && (
                // One control for all days: a native picker works well on phones
                <select
                  className={`cb-day-picker ${assignedDays.length > 0 ? 'on' : ''}`}
                  value=""
                  onChange={(e) => { const d = Number(e.target.value); if (d > 0) props.onToggleDayCopy(d); }}
                  aria-label="일정에 추가하거나 빼기"
                >
                  <option value="" disabled>
                    {assignedDays.length > 0 ? `📅 Day ${assignedDays.join(', ')}에 담김` : '📅 일정에 추가'}
                  </option>
                  {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {assignedDays.includes(d) ? `✓ ${props.getDayLabel(d)} — 빼기` : `${props.getDayLabel(d)}에 추가`}
                    </option>
                  ))}
                </select>
              )}
              {isMultiDay && !isRouteCreated && !isStorageTab && (
                <select className="cb-day-picker" value={placeDay} onChange={(e) => props.onChangeDay(Number(e.target.value))} aria-label="일차 변경">
                  <option value={0}>보관함으로</option>
                  {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{props.getDayLabel(d)}</option>
                  ))}
                </select>
              )}
              <button className={`cb-link-chip ${expanded ? 'active' : ''}`} onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
                {expanded ? '접기 ▲' : '메모·비용·추억 ▼'}
              </button>
              {(props.onMoveUp || props.onMoveDown) && (
                <span className="cb-move-btns">
                  <button type="button" onClick={() => props.onMoveUp?.()} disabled={!props.onMoveUp} aria-label="위로 옮기기">▲</button>
                  <button type="button" onClick={() => props.onMoveDown?.()} disabled={!props.onMoveDown} aria-label="아래로 옮기기">▼</button>
                </span>
              )}
            </div>
          )}

          {currentUserId && !isSelectMode && (
            <ReactionBar reactions={place.reactions || {}} currentUserId={currentUserId} members={members} onReact={props.onReact} />
          )}

          {expanded && (
            <div className="cb-details" onClick={(e) => e.stopPropagation()}>
              <label className="cb-field">
                <span className="cb-field-label">📝 메모 (함께 보는 사람 모두에게 보여요)</span>
                <textarea
                  className="cb-input cb-textarea"
                  rows={2}
                  maxLength={1000}
                  value={memo}
                  placeholder="예) 창가 자리 예약, 시그니처 메뉴 꼭 먹기"
                  onChange={(e) => setMemo(e.target.value)}
                  onBlur={() => { if (memo !== (place.memo || '')) props.onUpdate({ memo }); }}
                />
              </label>
              <label className="cb-field">
                <span className="cb-field-label">💰 예상 비용 (원)</span>
                <input
                  className="cb-input"
                  inputMode="numeric"
                  value={cost ? Number(cost.replace(/[^\d]/g, '') || 0).toLocaleString('ko-KR') : ''}
                  placeholder="예) 50,000"
                  onChange={(e) => setCost(e.target.value.replace(/[^\d]/g, ''))}
                  onBlur={saveCost}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                />
              </label>
              <div className="cb-detail-actions">
                <button className="cb-chip-btn" onClick={props.onOpenSimilar}>🔄 비슷한 곳으로 바꾸기</button>
                {inDay && (
                  <button
                    className={`cb-chip-btn ${visited ? 'on' : ''}`}
                    onClick={() => props.onUpdate({ visitedAt: visited ? null : new Date().toISOString() })}
                  >
                    {visited ? '✓ 다녀왔어요 (취소)' : '✓ 다녀왔어요'}
                  </button>
                )}
              </div>
              {inDay && <MemoryEditor place={place} onUpdate={props.onUpdate} onUploadPhoto={props.onUploadPhoto} />}
            </div>
          )}
      </div>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { CoursePlace, DateSchedule, DirectionResult, TransitMode, FACILITY_ICONS, FACILITY_LABELS } from '@/lib/types';
import { formatDuration, formatDistance, getWalkingTimeMs, stripHtml, parseCategoryToFacility } from '@/lib/utils';
import { useDragAndDrop } from '@/lib/useDragAndDrop';
import ShareCard from './ShareCard';
import DateSchedulePicker from './DateSchedulePicker';

interface CourseBuilderProps {
  places: CoursePlace[];
  directions: DirectionResult | null;
  onRemovePlace: (id: string) => void;
  onReorderPlaces: (newPlaces: CoursePlace[]) => void;
  onShowReview: (placeName: string) => void;
  onHighlightPlace: (place: CoursePlace | null) => void;
  onCreateRoute: () => void;
  isRouteCreated: boolean;
  transitMode: TransitMode;
  onChangeTransitMode: (mode: TransitMode) => void;
  onShareCourseUrl: () => void;
  onShareKakao: () => void;
  // Invite features
  inviteCode: string | null;
  onCreateInviteCode?: () => void;
  onJoinByInviteCode?: (code: string) => void;
  onCopyInviteCode?: () => void;
  onCopyInviteLink?: () => void;
  members?: { nickname?: string; isOwner?: boolean }[];
  // Course naming (auto-save)
  schedule?: DateSchedule | null;
  onScheduleChange?: (schedule: DateSchedule | null) => void;
  courseName?: string;       // current display name (from DB)
  courseDescription?: string; // current description (from DB)
  onUpdateCourseName?: (displayName: string, description: string) => Promise<void>;
}

export default function CourseBuilder({
  places,
  directions,
  onRemovePlace,
  onReorderPlaces,
  onShowReview,
  onHighlightPlace,
  onCreateRoute,
  isRouteCreated,
  transitMode,
  onChangeTransitMode,
  onShareCourseUrl,
  onShareKakao,
  inviteCode,
  onCreateInviteCode,
  onJoinByInviteCode,
  onCopyInviteCode,
  onCopyInviteLink,
  members,
  schedule,
  onScheduleChange,
  courseName = '',
  courseDescription = '',
  onUpdateCourseName,
}: CourseBuilderProps) {
  const [showShareCard, setShowShareCard] = useState(false);
  const [activeDayTab, setActiveDayTab] = useState<'all' | number>('all');
  const [showInvitePanel, setShowInvitePanel] = useState<'create' | 'join' | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showStorageDropdown, setShowStorageDropdown] = useState(false);

  // Course naming state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  // Multi-day: calculate number of days from schedule
  const dayCount = useMemo(() => {
    if (!schedule?.startDate || !schedule?.endDate) return 1;
    const start = new Date(schedule.startDate);
    const end = new Date(schedule.endDate);
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
  }, [schedule]);

  const isMultiDay = dayCount > 1;

  // Day label helper
  const getDayLabel = (dayNum: number) => {
    if (dayNum === 0) return '보관함 (미지정)';
    if (!schedule?.startDate) return `Day ${dayNum}`;
    const date = new Date(schedule.startDate);
    date.setDate(date.getDate() + dayNum - 1);
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const w = weekdays[date.getDay()];
    return `Day ${dayNum} (${m}/${d} ${w})`;
  };

  const handleStartEditName = () => {
    setEditName(courseName);
    setEditDescription(courseDescription);
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    if (!onUpdateCourseName) return;
    setNameSaving(true);
    try {
      await onUpdateCourseName(editName.trim(), editDescription.trim());
      setIsEditingName(false);
    } finally {
      setNameSaving(false);
    }
  };

  // Change a place's day assignment
  const handleChangePlaceDay = (placeId: string, newDay: number) => {
    const updated = places.map(p =>
      p.id === placeId ? { ...p, day: newDay } : p
    );
    onReorderPlaces(updated);
  };
  
  const {
    list: draggablePlaces,
    updateList,
    handleDragStart,
    handleDragEnter,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  } = useDragAndDrop(places);

  const handleFilteredReorder = (newFiltered: CoursePlace[]) => {
    if (activeDayTab === 'all') {
      onReorderPlaces(newFiltered);
    } else {
      const otherPlaces = places.filter(p => (p.day ?? 0) !== activeDayTab);
      const updatedFilteredPlaces = newFiltered.map(p => ({ ...p, day: activeDayTab }));
      onReorderPlaces([...otherPlaces, ...updatedFilteredPlaces]);
    }
  };

  const filteredPlaces = useMemo(() => {
    if (activeDayTab === 'all') return draggablePlaces;
    return draggablePlaces.filter(p => (p.day ?? 0) === activeDayTab);
  }, [draggablePlaces, activeDayTab]);

  // Sync internal drag list when external places change
  React.useEffect(() => {
    updateList(places);
  }, [places, updateList]);

  const handleCopyCode = () => {
    onCopyInviteCode?.();
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleJoinSubmit = async () => {
    if (!joinCode.trim() || joinCode.trim().length !== 6) return;
    setJoinLoading(true);
    try {
      await onJoinByInviteCode?.(joinCode.trim().toUpperCase());
      setShowInvitePanel(null);
      setJoinCode('');
    } catch {
      // Error handled by parent
    } finally {
      setJoinLoading(false);
    }
  };

  const isCollaborative = members && members.length > 1;

  // Calculate per-day stats (distance and duration)
  const dayStats = useMemo(() => {
    const stats: Record<number, { distance: number, durationMs: number }> = {};
    if (!isRouteCreated || !directions || !directions.legs) return stats;

    for (let i = 0; i < places.length - 1; i++) {
      const p1 = places[i];
      const p2 = places[i + 1];
      if ((p1.day ?? 0) === (p2.day ?? 0) && (p1.day ?? 0) !== 0) {
        const day = p1.day ?? 0;
        if (!stats[day]) stats[day] = { distance: 0, durationMs: 0 };
        const leg = directions.legs[i];
        if (leg) {
          stats[day].distance += leg.distance;
          stats[day].durationMs += leg.duration;
        }
      }
    }
    return stats;
  }, [places, directions, isRouteCreated]);

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── 경로 이름/설명 편집 영역 ── */}
      <div style={{
        background: 'rgba(255,255,255,0.04)', borderRadius: '12px',
        border: '1px solid rgba(244,114,182,0.15)', padding: '14px',
      }}>
        {isEditingName ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="경로 이름 (예: 홍대 데이트 코스)"
              autoFocus
              style={{
                width: '100%', padding: '8px 12px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(244,114,182,0.4)',
                color: '#f5f0ff', fontSize: '15px', fontWeight: 600, outline: 'none',
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setIsEditingName(false); }}
            />
            <input
              type="text"
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              placeholder="설명 (선택사항)"
              style={{
                width: '100%', padding: '6px 12px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                color: '#b4a9c9', fontSize: '13px', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleSaveName}
                disabled={nameSaving}
                style={{
                  padding: '6px 16px', borderRadius: '8px', fontSize: '13px',
                  background: 'linear-gradient(135deg, #f472b6, #c084fc)',
                  color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600,
                }}
              >
                {nameSaving ? '저장 중...' : '✓ 저장'}
              </button>
              <button
                onClick={() => setIsEditingName(false)}
                style={{
                  padding: '6px 12px', borderRadius: '8px', fontSize: '13px',
                  background: 'rgba(255,255,255,0.08)', color: '#8b7fa8',
                  border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                }}
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#f5f0ff' }}>
                  {courseName || '이름 없는 경로'}
                </span>
                <span style={{
                  fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                  background: 'rgba(244,114,182,0.15)', color: '#f472b6',
                  border: '1px solid rgba(244,114,182,0.3)', fontWeight: 600,
                }}>자동저장</span>
              </div>
              {courseDescription && (
                <div style={{ fontSize: '12px', color: '#8b7fa8' }}>{courseDescription}</div>
              )}
              {!courseDescription && !courseName && (
                <div style={{ fontSize: '12px', color: '#6b5f85', fontStyle: 'italic' }}>이름과 설명을 설정해보세요</div>
              )}
            </div>
            {onUpdateCourseName && (
              <button
                onClick={handleStartEditName}
                title="이름 편집"
                style={{
                  background: 'rgba(244,114,182,0.1)', color: '#f472b6',
                  border: 'none', width: '32px', height: '32px', borderRadius: '8px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '15px', flexShrink: 0,
                }}
              >
                ✏️
              </button>
            )}
          </div>
        )}
      </div>


      <div>
        <div className="invite-section">
          <button
            className={`invite-section-btn ${showInvitePanel === 'create' ? 'active' : ''}`}
            onClick={() => {
              if (showInvitePanel === 'create') {
                setShowInvitePanel(null);
              } else {
                setShowInvitePanel('create');
                if (!inviteCode && onCreateInviteCode) {
                  onCreateInviteCode();
                }
              }
            }}
          >
            🔗 초대코드 {inviteCode ? '보기' : '만들기'}
          </button>
          <button
            className={`invite-section-btn ${showInvitePanel === 'join' ? 'active' : ''}`}
            onClick={() => setShowInvitePanel(showInvitePanel === 'join' ? null : 'join')}
          >
            🎟️ 초대코드 입력
          </button>
        </div>

        {/* Create invite code panel */}
        {showInvitePanel === 'create' && inviteCode && (
          <div className="invite-code-display">
            <div className="invite-code-value">
              <span className="invite-code-text">{inviteCode}</span>
              <button className="invite-copy-btn" onClick={handleCopyCode}>
                {codeCopied ? '✅ 복사됨' : '📋 복사'}
              </button>
            </div>
            <button className="invite-link-btn" onClick={onCopyInviteLink}>
              🔗 초대 링크 복사
            </button>
            {isCollaborative && (
              <div style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
                👥 현재 {members!.length}명 참여 중
              </div>
            )}
          </div>
        )}

        {/* Join invite code panel */}
        {showInvitePanel === 'join' && (
          <div className="invite-join-form">
            <input
              className="invite-join-input"
              type="text"
              placeholder="6자리 코드"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              maxLength={6}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinSubmit()}
            />
            <button
              className="invite-join-submit"
              onClick={handleJoinSubmit}
              disabled={joinLoading || joinCode.length < 6}
            >
              {joinLoading ? '⏳' : '참가'}
            </button>
          </div>
        )}
      </div>

      {/* Empty state */}
      {places.length === 0 && (
        <div className="course-empty">
          <div className="course-empty-icon">🗺️</div>
          <h4>경로가 비어있어요</h4>
          <p>
            장소검색 탭에서 장소를 찾고
            <br />
            &ldquo;경로 추가&rdquo; 버튼을 눌러보세요!
          </p>
        </div>
      )}

      {places.length > 0 && (
        <>
          {/* Calendar Date Picker */}
          <div style={{ marginBottom: '16px' }}>
            <DateSchedulePicker
              schedule={schedule || null}
              onScheduleChange={onScheduleChange || (() => {})}
            />
          </div>

          {/* Day Tabs */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '4px' }} className="custom-scrollbar">
            <button
              onClick={() => setActiveDayTab('all')}
              style={{
                padding: '6px 12px', borderRadius: '12px', fontSize: '13px', whiteSpace: 'nowrap',
                background: activeDayTab === 'all' ? 'linear-gradient(135deg, #f472b6, #c084fc)' : 'rgba(255,255,255,0.05)',
                color: activeDayTab === 'all' ? '#fff' : '#8b7fa8', border: 'none', cursor: 'pointer'
              }}
            >
              전체
            </button>
            {Array.from({ length: dayCount + 1 }).map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveDayTab(i)}
                style={{
                  padding: '6px 12px', borderRadius: '12px', fontSize: '13px', whiteSpace: 'nowrap',
                  background: activeDayTab === i ? 'linear-gradient(135deg, #f472b6, #c084fc)' : 'rgba(255,255,255,0.05)',
                  color: activeDayTab === i ? '#fff' : '#8b7fa8', border: 'none', cursor: 'pointer'
                }}
              >
                {getDayLabel(i)}
              </button>
            ))}
          </div>
          {/* Route Mode & Stats (Only if route is created) */}
          {isRouteCreated && directions && (() => {
            let walkingDuration = 0;
            if (directions) {
              const totalDistMeters = directions.totalDistance;
              walkingDuration = getWalkingTimeMs(totalDistMeters);
            }
            return (
              <div className="animate-fade-in" style={{
                background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '16px',
                border: '1px solid rgba(244,114,182,0.2)'
              }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '12px' }}>
                  <button 
                    onClick={() => onChangeTransitMode('driving')}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                      background: transitMode === 'driving' ? 'linear-gradient(135deg, #f472b6, #c084fc)' : 'transparent',
                      color: transitMode === 'driving' ? '#fff' : '#8b7fa8',
                      fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >🚗 자동차</button>
                  <button 
                    onClick={() => onChangeTransitMode('walking')}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                      background: transitMode === 'walking' ? 'linear-gradient(135deg, #f472b6, #c084fc)' : 'transparent',
                      color: transitMode === 'walking' ? '#fff' : '#8b7fa8',
                      fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >🚶‍♂️ 도보(예상)</button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#8b7fa8', marginBottom: '4px' }}>총 소요 시간</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#f5f0ff' }}>
                      {transitMode === 'driving' ? formatDuration(directions.totalDuration) : formatDuration(walkingDuration)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#8b7fa8', marginBottom: '4px' }}>총 이동 거리</div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#f472b6' }}>
                      {(directions.totalDistance / 1000).toFixed(1)}km
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Places DND timeline with optional day dividers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {(() => {
              // When multi-day: group by day and show day headers
              const seenDays = new Set<number>();
              return filteredPlaces.map((place, idx) => {
              const facility = parseCategoryToFacility(place.category);
              const facilityIcon = FACILITY_ICONS[facility];
              const facilityLabel = FACILITY_LABELS[facility];
              const placeDay = place.day ?? 1;

              // Get leg info for the segment AFTER this place (using global index)
              const globalIdx = places.findIndex(p => p.id === place.id);
              const legs = directions?.legs || [];
              const legAfter = (isRouteCreated && legs.length > 0 && globalIdx < places.length - 1)
                ? legs[globalIdx] : null;

              // Day divider: show header when day changes (only in 'all' tab if multi-day)
              const showDayHeader = isMultiDay && activeDayTab === 'all' && !seenDays.has(placeDay);
              if (showDayHeader) seenDays.add(placeDay);

              return (
                <React.Fragment key={place.id}>
                  {/* Day divider header */}
                  {showDayHeader && (
                    <div style={{
                      display: 'flex', flexDirection: 'column',
                      margin: idx === 0 ? '0 0 10px 0' : '24px 0 10px 0',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          background: 'linear-gradient(135deg, #f472b6, #c084fc)',
                          borderRadius: '8px', padding: '4px 14px',
                          fontSize: '13px', fontWeight: 700, color: '#fff', flexShrink: 0,
                        }}>
                          📅 {getDayLabel(placeDay)}
                        </div>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, rgba(244,114,182,0.3), transparent)' }} />
                      </div>
                      
                      {/* Day Stats summary */}
                      {isRouteCreated && dayStats[placeDay] && (
                        <div style={{
                          marginTop: '8px', marginLeft: '4px', fontSize: '13px', color: '#f472b6', fontWeight: 600
                        }}>
                          전체 이동거리 {(dayStats[placeDay].distance / 1000).toFixed(1)}km, 
                          이동 시간 {transitMode === 'driving' 
                            ? formatDuration(dayStats[placeDay].durationMs)
                            : formatDuration(getWalkingTimeMs(dayStats[placeDay].distance))}
                        </div>
                      )}
                    </div>
                  )}
                  <div
                    draggable={!isRouteCreated}
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragEnter={(e) => handleDragEnter(e, idx)}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, (newList) => {
                      const updated = newList.map((p, i) => ({ ...p, order: i }));
                      handleFilteredReorder(updated);
                    })}
                    onMouseEnter={() => onHighlightPlace(place)}
                    onMouseLeave={() => onHighlightPlace(null)}
                    style={{
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(244,114,182,0.1)',
                      borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'center',
                      cursor: isRouteCreated ? 'default' : 'grab'
                    }}
                  >
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #f472b6, #c084fc)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '13px',
                      flexShrink: 0,
                    }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          <div style={{ cursor: 'pointer', fontSize: '15px', fontWeight: 600, color: '#f5f0ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                               onClick={() => onShowReview(stripHtml(place.title))}>
                            {stripHtml(place.title)}
                          </div>
                          {/* Facility Type Badge */}
                          <span className="facility-badge" title={facilityLabel} style={{ flexShrink: 0 }}>
                            {facilityIcon}
                          </span>
                        </div>
                        {/* Naver Category Text */}
                        {place.category && (
                          <span style={{ fontSize: '11px', color: '#f472b6', flexShrink: 0, textAlign: 'right' }}>
                            {place.category}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#8b7fa8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {place.roadAddress || place.address}
                      </div>
                      {/* External links */}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {place.link && (
                          <a
                            href={place.link}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                              background: 'rgba(255,255,255,0.06)', color: '#93c5fd',
                              textDecoration: 'none', border: '1px solid rgba(147,197,253,0.2)',
                              fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                          >
                            🌐 홈페이지
                          </a>
                        )}
                        <a
                          href={`https://www.instagram.com/explore/tags/${encodeURIComponent(stripHtml(place.title).replace(/\s/g, ''))}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                            background: 'rgba(255,255,255,0.06)', color: '#f472b6',
                            textDecoration: 'none', border: '1px solid rgba(244,114,182,0.2)',
                            fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          📷 인스타그램
                        </a>
                        <a
                          href={`https://map.naver.com/v5/search/${encodeURIComponent(stripHtml(place.title))}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                            background: 'rgba(255,255,255,0.06)', color: '#4ade80',
                            textDecoration: 'none', border: '1px solid rgba(74,222,128,0.2)',
                            fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          🗺️ 네이버맵
                        </a>
                        {/* Day selector: only show when multi-day & not in route mode */}
                        {isMultiDay && !isRouteCreated && (
                          <select
                            value={placeDay}
                            onChange={e => handleChangePlaceDay(place.id, Number(e.target.value))}
                            onClick={e => e.stopPropagation()}
                            style={{
                              fontSize: '11px', padding: '2px 6px', borderRadius: '4px',
                              background: 'rgba(255,255,255,0.08)', color: '#c084fc',
                              border: '1px solid rgba(192,132,252,0.3)', cursor: 'pointer',
                              outline: 'none',
                            }}
                          >
                            <option value={0} style={{ background: '#1a1520' }}>보관함</option>
                            {Array.from({ length: dayCount }, (_, i) => i + 1).map(d => (
                              <option key={d} value={d} style={{ background: '#1a1520' }}>
                                Day {d}
                              </option>
                            ))}
                          </select>
                        )}
                    </div>
                    </div>
                    {!isRouteCreated && (
                      <button
                        onClick={() => onRemovePlace(place.id)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none',
                          width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                          flexShrink: 0,
                        }}
                        title="삭제"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Leg info between places */}
                  {legAfter && (
                    <div className="course-leg-connector animate-fade-in">
                      <div className="course-leg-line" />
                      <div className="course-leg-info-card">
                        {transitMode === 'driving' ? (
                          <>
                            <span>🚗</span>
                            <span>{formatDistance(legAfter.distance)}</span>
                            <span className="course-leg-divider">·</span>
                            <span>{formatDuration(legAfter.duration)}</span>
                          </>
                        ) : (
                          <>
                            <span>🚶</span>
                            <span>{formatDistance(legAfter.distance)}</span>
                            <span className="course-leg-divider">·</span>
                            <span>도보 {formatDuration(getWalkingTimeMs(legAfter.distance))}</span>
                          </>
                        )}
                      </div>
                      <div className="course-leg-line" />
                    </div>
                  )}
                </React.Fragment>
              );
            });
            })()}
          </div>

          {/* Add from Storage Button */}
          {activeDayTab !== 'all' && activeDayTab !== 0 && (
            <div style={{ marginTop: '16px' }}>
              <button
                onClick={() => setShowStorageDropdown(!showStorageDropdown)}
                style={{
                  width: '100%', padding: '12px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(244,114,182,0.4)',
                  color: '#f472b6', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <span>+</span> 담은 장소 목록에서 추가
              </button>
              
              {showStorageDropdown && (
                <div className="animate-fade-in" style={{
                  marginTop: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '12px',
                  border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px'
                }}>
                  {places.filter(p => (p.day ?? 0) === 0).length === 0 ? (
                    <div style={{ color: '#8b7fa8', textAlign: 'center', fontSize: '13px', padding: '12px' }}>
                      보관함에 담은 장소가 없습니다.
                    </div>
                  ) : (
                    places.filter(p => (p.day ?? 0) === 0).map(p => (
                      <div
                        key={p.id}
                        onClick={() => {
                          handleChangePlaceDay(p.id, activeDayTab);
                          setShowStorageDropdown(false);
                        }}
                        style={{
                          background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(244,114,182,0.4)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '18px' }}>{FACILITY_ICONS[parseCategoryToFacility(p.category)] || '📍'}</span>
                          <span style={{ color: '#f5f0ff', fontSize: '14px', fontWeight: 500 }}>{p.title.replace(/<[^>]+>/g, '')}</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#f472b6', fontWeight: 600 }}>추가</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}


          {!isRouteCreated && places.length >= 2 && (
            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '10px' }}
              onClick={onCreateRoute}
            >
              🚗 경로 만들기
            </button>
          )}
          
          {isRouteCreated && (
            <>
              <button
                className="btn btn-ghost"
                style={{ width: '100%', marginTop: '10px' }}
                onClick={() => onReorderPlaces([...places])}
              >
                ✏️ 장소 순서 수정하기
              </button>

              {/* Share section */}
              <div className="route-share-section">
                <div className="route-share-label">📤 코스 공유하기</div>
                <div className="route-share-buttons">
                  <button
                    className="route-share-btn kakao"
                    onClick={onShareKakao}
                  >
                    💬 카카오톡
                  </button>
                  <button
                    className="route-share-btn link"
                    onClick={onShareCourseUrl}
                  >
                    🔗 링크 복사
                  </button>
                  <button
                    className="route-share-btn image"
                    onClick={() => setShowShareCard(!showShareCard)}
                  >
                    📷 이미지 저장
                  </button>
                </div>
              </div>

              {/* Share Card Preview */}
              {showShareCard && (
                <div className="animate-slide-up">
                  <ShareCard
                    places={places}
                    directions={directions}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

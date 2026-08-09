import React, { useState, useMemo } from 'react';
import { CoursePlace, DateSchedule, DirectionResult, TransitMode, FACILITY_ICONS, FACILITY_LABELS } from '@/lib/types';
import { formatDuration, formatDistance, getWalkingTimeMs, stripHtml, parseCategoryToFacility, optimizeRouteTSP, autoDistributePlaces } from '@/lib/utils';
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
  activeDayTab: 'all' | number;
  setActiveDayTab: (tab: 'all' | number) => void;
  showStoragePins?: boolean;
  setShowStoragePins?: (show: boolean) => void;
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
  activeDayTab,
  setActiveDayTab,
  showStoragePins = false,
  setShowStoragePins,
}: CourseBuilderProps) {
  const [showShareCard, setShowShareCard] = useState(false);
  const [showInvitePanel, setShowInvitePanel] = useState<'create' | 'join' | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

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
  
  const filteredPlacesSource = useMemo(() => {
    if (activeDayTab === 'all') return places.filter(p => (p.day ?? 0) !== 0);
    return places.filter(p => (p.day ?? 0) === activeDayTab);
  }, [places, activeDayTab]);

  const {
    list: filteredPlaces,
    updateList,
    handleDragStart,
    handleDragEnter,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  } = useDragAndDrop(filteredPlacesSource);

  // Sync internal drag list when external filtered places change
  React.useEffect(() => {
    updateList(filteredPlacesSource);
  }, [filteredPlacesSource, updateList]);

  const handleFilteredReorder = (newFiltered: CoursePlace[]) => {
    if (activeDayTab === 'all') {
      const day0Places = places.filter(p => (p.day ?? 0) === 0);
      onReorderPlaces([...day0Places, ...newFiltered]);
    } else {
      const otherPlaces = places.filter(p => (p.day ?? 0) !== activeDayTab);
      const updatedFilteredPlaces = newFiltered.map(p => ({ ...p, day: activeDayTab }));
      onReorderPlaces([...otherPlaces, ...updatedFilteredPlaces]);
    }
  };

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

  const handleOptimizeRoute = () => {
    if (activeDayTab === 'all' || activeDayTab === 0) return;
    
    const currentDayPlaces = places.filter(p => (p.day ?? 0) === activeDayTab);
    const otherPlaces = places.filter(p => (p.day ?? 0) !== activeDayTab);
    
    if (currentDayPlaces.length <= 2) return;
    
    const optimized = optimizeRouteTSP(currentDayPlaces, 0); // Keep first place fixed
    onReorderPlaces([...otherPlaces, ...optimized]);
  };

  const handleAutoDistribute = () => {
    if (dayCount < 2) {
      alert("일정이 2일 이상이어야 자동 분배가 가능합니다.");
      return;
    }
    const distributed = autoDistributePlaces(places, dayCount);
    onReorderPlaces(distributed);
  };

  const handleResetRoute = () => {
    if (activeDayTab === 0) return;
    
    if (confirm(activeDayTab === 'all' ? "모든 일정을 보관함으로 되돌리시겠습니까?" : "이 일정의 장소들을 보관함으로 되돌리시겠습니까?")) {
      const updatedPlaces = places.map(p => {
        if (activeDayTab === 'all') {
          if ((p.day ?? 0) !== 0) return { ...p, day: 0 };
        } else {
          if (p.day === activeDayTab) return { ...p, day: 0 };
        }
        return p;
      });
      onReorderPlaces(updatedPlaces);
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

          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              className="btn btn-primary animate-slide-up"
              style={{ flex: 1, padding: '16px', fontSize: '16px' }}
              onClick={onCreateRoute}
              disabled={places.length < 2 && !isRouteCreated}
            >
              {isRouteCreated ? '🔄 경로 다시 생성' : '✨ 경로 생성'}
            </button>
            {activeDayTab !== 'all' && activeDayTab !== 0 && filteredPlaces.length > 2 && (
              <button
                className="btn animate-slide-up"
                style={{
                  flex: '0 0 auto', padding: '16px 20px', fontSize: '14px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(244,114,182,0.4)',
                  color: '#f472b6', fontWeight: 600, cursor: 'pointer', borderRadius: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                onClick={handleOptimizeRoute}
              >
                🪄 동선 최적화
              </button>
            )}
            {(activeDayTab === 'all' || activeDayTab === 0) && isMultiDay && places.some(p => (p.day ?? 0) === 0) && (
              <button
                className="btn animate-slide-up"
                style={{
                  flex: '0 0 auto', padding: '16px 20px', fontSize: '14px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(192,132,252,0.4)',
                  color: '#c084fc', fontWeight: 600, cursor: 'pointer', borderRadius: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                onClick={handleAutoDistribute}
              >
                🤖 자동 분배
              </button>
            )}
            {activeDayTab !== 0 && filteredPlaces.length > 0 && (
              <button
                className="btn animate-slide-up"
                style={{
                  flex: '0 0 auto', padding: '16px 20px', fontSize: '14px',
                  background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#ef4444', fontWeight: 600, cursor: 'pointer', borderRadius: '12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                onClick={handleResetRoute}
                title="이 탭의 장소를 보관함으로 되돌립니다"
              >
                🗑️ 경로 초기화
              </button>
            )}
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
            {Array.from({ length: dayCount }).map((_, i) => {
              const day = i + 1;
              return (
                <button
                  key={day}
                  onClick={() => setActiveDayTab(day)}
                  style={{
                    padding: '6px 12px', borderRadius: '12px', fontSize: '13px', whiteSpace: 'nowrap',
                    background: activeDayTab === day ? 'linear-gradient(135deg, #f472b6, #c084fc)' : 'rgba(255,255,255,0.05)',
                    color: activeDayTab === day ? '#fff' : '#8b7fa8', border: 'none', cursor: 'pointer'
                  }}
                >
                  {getDayLabel(day)}
                </button>
              );
            })}
            <button
              onClick={() => setActiveDayTab(0)}
              style={{
                padding: '6px 12px', borderRadius: '12px', fontSize: '13px', whiteSpace: 'nowrap',
                background: activeDayTab === 0 ? 'linear-gradient(135deg, #f472b6, #c084fc)' : 'rgba(255,255,255,0.05)',
                color: activeDayTab === 0 ? '#fff' : '#8b7fa8', border: 'none', cursor: 'pointer'
              }}
            >
              {getDayLabel(0)}
            </button>
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
                    {placeDay !== 0 && (
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #f472b6, #c084fc)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '13px',
                        flexShrink: 0,
                      }}>
                        {idx + 1}
                      </div>
                    )}
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
                        onClick={() => {
                          if (placeDay !== 0) {
                            handleChangePlaceDay(place.id, 0); // Send back to storage
                          } else {
                            onRemovePlace(place.id); // Permanently delete from storage
                          }
                        }}
                        style={{
                          background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none',
                          width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                          flexShrink: 0,
                        }}
                        title={placeDay !== 0 ? "보관함으로 되돌리기" : "완전 삭제"}
                      >
                        {placeDay !== 0 ? '⬇️' : '✕'}
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
                onClick={() => setShowStoragePins?.(!showStoragePins)}
                style={{
                  width: '100%', padding: '12px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(244,114,182,0.4)',
                  color: '#f472b6', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <span>+</span> 담은 장소 목록에서 추가
              </button>
              
              {showStoragePins && (() => {
                const storagePlaces = places.filter(p => (p.day ?? 0) === 0);
                const assignedTitles = new Set(places.filter(p => (p.day ?? 0) > 0).map(p => p.title));
                const sortedStoragePlaces = [...storagePlaces].sort((a, b) => {
                  const aAssigned = assignedTitles.has(a.title);
                  const bAssigned = assignedTitles.has(b.title);
                  if (aAssigned && !bAssigned) return 1;
                  if (!aAssigned && bAssigned) return -1;
                  return 0;
                });
                
                return (
                  <div className="animate-fade-in" style={{
                    marginTop: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '12px',
                    border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px'
                  }}>
                    {sortedStoragePlaces.length === 0 ? (
                      <div style={{ color: '#8b7fa8', textAlign: 'center', fontSize: '13px', padding: '12px' }}>
                        보관함에 담은 장소가 없습니다.
                      </div>
                    ) : (
                      sortedStoragePlaces.map(p => {
                        const fac = parseCategoryToFacility(p.category);
                        const fIcon = FACILITY_ICONS[fac];
                        const fLabel = FACILITY_LABELS[fac];
                        const isAssigned = assignedTitles.has(p.title);
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              const newPlace = { ...p, id: p.id + '-' + Date.now(), day: activeDayTab as number, order: places.length };
                              onReorderPlaces([...places, newPlace]);
                              setShowStoragePins?.(false);
                            }}
                            style={{
                              background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px',
                              display: 'flex', alignItems: 'center', gap: '12px',
                              cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(244,114,182,0.4)'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                          >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                <div style={{ fontSize: '15px', fontWeight: 600, color: '#f5f0ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {stripHtml(p.title)}
                                </div>
                                <span className="facility-badge" title={fLabel} style={{ flexShrink: 0 }}>
                                  {fIcon}
                                </span>
                              </div>
                              {p.category && (
                                <span style={{ fontSize: '11px', color: '#f472b6', flexShrink: 0, textAlign: 'right' }}>
                                  {p.category}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: '#8b7fa8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.roadAddress || p.address}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                              {p.link && (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                  fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                                  background: 'rgba(255,255,255,0.06)', color: '#93c5fd',
                                  border: '1px solid rgba(147,197,253,0.2)', fontWeight: 500, whiteSpace: 'nowrap',
                                }}>🌐 홈페이지</span>
                              )}
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                                background: 'rgba(255,255,255,0.06)', color: '#f472b6',
                                border: '1px solid rgba(244,114,182,0.2)', fontWeight: 500, whiteSpace: 'nowrap',
                              }}>📷 인스타그램</span>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                                background: 'rgba(255,255,255,0.06)', color: '#4ade80',
                                border: '1px solid rgba(74,222,128,0.2)', fontWeight: 500, whiteSpace: 'nowrap',
                              }}>🗺️ 네이버맵</span>
                            </div>
                          </div>
                          <div style={{ fontSize: '13px', color: '#f472b6', fontWeight: 700, padding: '6px 12px', background: 'rgba(244,114,182,0.1)', borderRadius: '8px' }}>
                            추가 +
                          </div>
                        </div>
                      );
                    })
                  )}
                  </div>
                );
              })()}
            </div>
          )}
          {isRouteCreated && (
            <>
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

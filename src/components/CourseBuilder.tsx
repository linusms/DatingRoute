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
  onAddPlace?: (place: CoursePlace & { day?: number }) => void;
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
  currentUserId?: string;
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
  onShowToast?: (msg: string) => void;
}

export default function CourseBuilder({
  places,
  directions,
  onRemovePlace,
  onAddPlace,
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
  currentUserId,
  schedule,
  onScheduleChange,
  courseName = '',
  courseDescription = '',
  onUpdateCourseName,
  activeDayTab,
  setActiveDayTab,
  showStoragePins = false,
  setShowStoragePins,
  onShowToast,
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

  // Select mode state for storage
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<Set<string>>(new Set());
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);

  const overflowMenuItemStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: '8px', border: 'none',
    background: 'transparent', color: 'var(--color-text-primary)', cursor: 'pointer',
    fontSize: '13px', fontWeight: 500, textAlign: 'left',
    transition: 'background 0.15s', width: '100%',
  };

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
    if (dayNum === 0) return '보관함';
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
    const place = places.find(p => p.id === placeId);
    if (!place) return;

    if (newDay === 0) {
      // Check if a master day 0 copy already exists
      const hasMaster = places.some(p => (p.day ?? 0) === 0 && stripHtml(p.title) === stripHtml(place.title));
      if (hasMaster) {
        onRemovePlace(placeId);
      } else {
        const updated = places.map(p =>
          p.id === placeId ? { ...p, day: 0 } : p
        );
        onReorderPlaces(updated);
      }
      return;
    }

    const updated = places.map(p =>
      p.id === placeId ? { ...p, day: newDay } : p
    );
    onReorderPlaces(updated);
  };
  
  const filteredPlacesSource = useMemo(() => {
    if (activeDayTab === 'all') {
      return [...places]
        .filter(p => (p.day ?? 0) !== 0)
        .sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
    }
    if (activeDayTab === 0) {
      // Storage tab only shows day 0 master copies.
      const storagePlaces = places.filter(p => (p.day ?? 0) === 0);
      return storagePlaces.sort((a, b) => {
        const aAssigned = places.some(p => (p.day ?? 0) > 0 && stripHtml(p.title) === stripHtml(a.title));
        const bAssigned = places.some(p => (p.day ?? 0) > 0 && stripHtml(p.title) === stripHtml(b.title));
        if (aAssigned && !bAssigned) return 1;
        if (!aAssigned && bAssigned) return -1;
        return 0;
      });
    }
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
      const newPlaces = [...day0Places, ...newFiltered];
      newPlaces.sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
      onReorderPlaces(newPlaces);
    } else if (activeDayTab === 0) {
      const newPlaces = [...newFiltered];
      newPlaces.sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
      onReorderPlaces(newPlaces);
    } else {
      const otherPlaces = places.filter(p => (p.day ?? 0) !== activeDayTab);
      const updatedFilteredPlaces = newFiltered.map(p => ({ ...p, day: activeDayTab }));
      const newPlaces = [...otherPlaces, ...updatedFilteredPlaces];
      newPlaces.sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
      onReorderPlaces(newPlaces);
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

  const handleToggleHoldSelected = () => {
    const updatedPlaces = places.map(p => {
      if (selectedPlaceIds.has(p.id)) {
        return { ...p, isHold: !p.isHold };
      }
      return p;
    });
    onReorderPlaces(updatedPlaces);
    setSelectedPlaceIds(new Set());
    setIsSelectMode(false);
  };

  const handleDeleteSelected = () => {
    if (!confirm(`선택한 장소 ${selectedPlaceIds.size}개를 삭제하시겠습니까?`)) return;
    const updatedPlaces = places.filter(p => !selectedPlaceIds.has(p.id));
    onReorderPlaces(updatedPlaces);
    setSelectedPlaceIds(new Set());
    setIsSelectMode(false);
  };

  const isCollaborative = inviteCode != null;

  // Calculate per-day stats (distance and duration)
  const dayStats = useMemo(() => {
    const stats: Record<number, { distance: number, durationMs: number }> = {};
    if (!isRouteCreated || !directions || !directions.legs) return stats;

    directions.legs.forEach((leg: any) => {
      const p = places.find(p => p.id === leg.fromId);
      if (p && (p.day ?? 0) !== 0) {
        const day = p.day ?? 0;
        if (!stats[day]) stats[day] = { distance: 0, durationMs: 0 };
        stats[day].distance += leg.distance || 0;
        stats[day].durationMs += leg.duration || 0;
      }
    });
    return stats;
  }, [places, directions, isRouteCreated]);

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>



      {/* Course Name Header */}
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--color-bg-secondary)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
        {isEditingName ? (
          <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="경로 이름을 입력하세요"
              style={{
                flex: 1, background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-active)', color: 'var(--color-text-primary)',
                padding: '8px 12px', borderRadius: '8px', fontSize: '15px', outline: 'none', fontWeight: 600
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveName();
                if (e.key === 'Escape') setIsEditingName(false);
              }}
              autoFocus
            />
            <button
              onClick={handleSaveName}
              disabled={nameSaving}
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              {nameSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <span style={{ fontSize: '12px', color: 'var(--color-accent-primary)', fontWeight: 600, marginBottom: '2px' }}>나만의 데이트 코스 💖</span>
              <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {courseName || '새로운 코스'}
              </span>
            </div>
            <button
              onClick={handleStartEditName}
              style={{ background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)', cursor: 'pointer', fontSize: '13px', padding: '6px 12px', borderRadius: '8px', color: 'var(--color-text-secondary)', fontWeight: 600, flexShrink: 0 }}
            >
              이름 변경 ✏️
            </button>
          </>
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

          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', alignItems: 'center' }}>
            <button
              className="btn btn-primary animate-slide-up"
              style={{ flex: 1, padding: '10px', fontSize: '14px' }}
              onClick={onCreateRoute}
              disabled={places.length < 2 && !isRouteCreated}
            >
              {isRouteCreated ? '🔄 다시 생성' : '✨ 경로 생성'}
            </button>
            {/* Overflow menu for secondary actions */}
            {(() => {
              const hasOptimize = activeDayTab !== 'all' && activeDayTab !== 0 && filteredPlaces.length > 2;
              const hasDistribute = (activeDayTab === 'all' || activeDayTab === 0) && isMultiDay && places.some(p => (p.day ?? 0) === 0);
              const hasReset = activeDayTab !== 0 && filteredPlaces.length > 0;
              if (!hasOptimize && !hasDistribute && !hasReset) return null;
              return (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowOverflowMenu(prev => !prev)}
                    style={{
                      padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)',
                      background: 'var(--color-bg-secondary)', color: '#b4a9c9', cursor: 'pointer',
                      fontSize: '16px', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title="추가 기능"
                  >
                    ⋯
                  </button>
                  {showOverflowMenu && (
                    <div style={{
                      position: 'absolute', top: '40px', right: 0, zIndex: 100,
                      background: 'var(--color-bg-primary)', border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '12px', padding: '6px', minWidth: '150px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '2px',
                    }}>
                      {hasOptimize && (
                        <button onClick={() => { handleOptimizeRoute(); setShowOverflowMenu(false); }}
                          style={overflowMenuItemStyle}>
                          🪄 동선 최적화
                        </button>
                      )}
                      {hasDistribute && (
                        <button onClick={() => { handleAutoDistribute(); setShowOverflowMenu(false); }}
                          style={overflowMenuItemStyle}>
                          🤖 자동 분배
                        </button>
                      )}
                      {hasReset && (
                        <button onClick={() => { handleResetRoute(); setShowOverflowMenu(false); }}
                          style={{ ...overflowMenuItemStyle, color: '#f87171' }}>
                          🗑️ 경로 초기화
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Day Tabs */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '4px' }} className="custom-scrollbar">
            <button
              onClick={() => setActiveDayTab('all')}
              style={{
                padding: '6px 12px', borderRadius: '12px', fontSize: '13px', whiteSpace: 'nowrap',
                background: activeDayTab === 'all' ? 'var(--color-accent-primary)' : 'var(--color-bg-secondary)',
                color: activeDayTab === 'all' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', border: 'none', cursor: 'pointer'
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
                    background: activeDayTab === day ? 'var(--color-accent-primary)' : 'var(--color-bg-secondary)',
                    color: activeDayTab === day ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', border: 'none', cursor: 'pointer'
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
                background: activeDayTab === 0 ? 'var(--color-accent-primary)' : 'var(--color-bg-secondary)',
                color: activeDayTab === 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', border: 'none', cursor: 'pointer'
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
                background: 'var(--color-bg-secondary)', borderRadius: '16px', padding: '16px',
                border: '1px solid var(--color-border)'
              }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'var(--color-bg-tertiary)', padding: '4px', borderRadius: '12px' }}>
                  <button 
                    onClick={() => onChangeTransitMode('driving')}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                      background: transitMode === 'driving' ? 'var(--color-accent-primary)' : 'transparent',
                      color: transitMode === 'driving' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >🚗 자동차</button>
                  <button 
                    onClick={() => onChangeTransitMode('walking')}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                      background: transitMode === 'walking' ? 'var(--color-accent-primary)' : 'transparent',
                      color: transitMode === 'walking' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                      fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >🚶‍♂️ 도보(예상)</button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>총 소요 시간</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                      {transitMode === 'driving' ? formatDuration(directions.totalDuration) : formatDuration(walkingDuration)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>총 이동 거리</div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-accent-primary)' }}>
                      {(directions.totalDistance / 1000).toFixed(1)}km
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          
          {/* Storage Actions */}
          {activeDayTab === 0 && filteredPlaces.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                보관함 목록 ({filteredPlaces.length}개)
              </div>
              {isSelectMode ? (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={handleDeleteSelected}
                    disabled={selectedPlaceIds.size === 0}
                    style={{
                      padding: '6px 12px', borderRadius: '8px', border: 'none',
                      background: selectedPlaceIds.size > 0 ? 'rgba(239, 68, 68, 0.2)' : 'var(--color-bg-secondary)',
                      color: selectedPlaceIds.size > 0 ? '#ef4444' : '#6b7280', fontSize: '12px', cursor: 'pointer'
                    }}
                  >
                    선택 삭제
                  </button>
                  <button
                    onClick={handleToggleHoldSelected}
                    disabled={selectedPlaceIds.size === 0}
                    style={{
                      padding: '6px 12px', borderRadius: '8px', border: 'none',
                      background: selectedPlaceIds.size > 0 ? 'rgba(245, 158, 11, 0.2)' : 'var(--color-bg-secondary)',
                      color: selectedPlaceIds.size > 0 ? '#f59e0b' : '#6b7280', fontSize: '12px', cursor: 'pointer'
                    }}
                  >
                    보류/해제
                  </button>
                  <button
                    onClick={() => setIsSelectMode(false)}
                    style={{
                      padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)',
                      background: 'transparent', color: '#cbd5e1', fontSize: '12px', cursor: 'pointer'
                    }}
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsSelectMode(true)}
                  style={{
                    padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)', fontSize: '12px', cursor: 'pointer'
                  }}
                >
                  선택 모드
                </button>
              )}
            </div>
          )}

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
              
              const assignedDays = activeDayTab === 0 
                ? Array.from(new Set(places.filter(p => (p.day ?? 0) > 0 && stripHtml(p.title) === stripHtml(place.title)).map(p => p.day)))
                : [];
              const isAssigned = assignedDays.length > 0;

              // Get leg info for the segment AFTER this place (using global index)
              const legs = directions?.legs || [];
              const legAfter = (isRouteCreated && legs.length > 0)
                ? legs.find((l: any) => l.fromId === place.id) : null;

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
                          background: 'var(--color-accent-primary)',
                          borderRadius: '8px', padding: '4px 14px',
                          fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', flexShrink: 0,
                        }}>
                          📅 {getDayLabel(placeDay)}
                        </div>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, var(--color-border-active), transparent)' }} />
                      </div>
                      
                      {/* Day Stats summary */}
                      {isRouteCreated && dayStats[placeDay] && (
                        <div style={{
                          marginTop: '8px', marginLeft: '4px', fontSize: '13px', color: 'var(--color-accent-primary)', fontWeight: 600
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
                    draggable={!isRouteCreated && !isSelectMode && !(activeDayTab === 0 && placeDay !== 0)}
                    onDragStart={!isSelectMode ? (e) => handleDragStart(e, idx) : undefined}
                    onDragEnter={!isSelectMode ? (e) => handleDragEnter(e, idx) : undefined}
                    onDragOver={!isSelectMode ? handleDragOver : undefined}
                    onDragEnd={!isSelectMode ? handleDragEnd : undefined}
                    onDrop={!isSelectMode ? (e) => handleDrop(e, (newList) => {
                      const updated = newList.map((p, i) => ({ ...p, order: i }));
                      handleFilteredReorder(updated);
                    }) : undefined}
                    onMouseEnter={() => !isSelectMode && onHighlightPlace(place)}
                    onMouseLeave={() => !isSelectMode && onHighlightPlace(null)}
                    onClick={() => {
                      if (isSelectMode && place.day === 0) {
                        setSelectedPlaceIds(prev => {
                          const next = new Set(prev);
                          if (next.has(place.id)) next.delete(place.id);
                          else next.add(place.id);
                          return next;
                        });
                        return;
                      }
                    }}
                    style={{
                      background: (activeDayTab === 0 && placeDay !== 0) ? 'rgba(255,255,255,0.01)' : 'var(--color-bg-secondary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '10px', padding: '10px', display: 'flex', gap: '10px', alignItems: 'center',
                      cursor: (isRouteCreated || isSelectMode || (activeDayTab === 0 && placeDay !== 0)) ? 'pointer' : 'grab',
                      opacity: (place.isHold || (activeDayTab === 0 && placeDay !== 0) || (activeDayTab === 0 && isAssigned)) ? 0.5 : 1,
                    }}
                  >
                    {isSelectMode && place.day === 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedPlaceIds.has(place.id)}
                          readOnly
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-accent-primary)' }}
                        />
                      </div>
                    )}
                    {placeDay !== 0 && !isSelectMode && (
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%', background: 'var(--color-accent-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '13px',
                        flexShrink: 0,
                      }}>
                        {idx + 1}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          <div style={{ cursor: 'pointer', fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                               onClick={(e) => {
                                 if (isSelectMode) return;
                                 onShowReview(stripHtml(place.title));
                               }}>
                            {stripHtml(place.title)}
                            {place.isHold && <span style={{ marginLeft: '6px', fontSize: '11px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '2px 6px', borderRadius: '4px' }}>보류됨</span>}
                            {activeDayTab === 0 && placeDay !== 0 && (
                              <span style={{ marginLeft: '6px', fontSize: '11px', background: 'rgba(192, 132, 252, 0.2)', color: '#c084fc', padding: '2px 6px', borderRadius: '4px' }}>
                                Day {placeDay}에 추가됨
                              </span>
                            )}
                            {activeDayTab === 0 && isAssigned && (
                              <span style={{ marginLeft: '6px', fontSize: '11px', background: 'rgba(74, 222, 128, 0.2)', color: '#4ade80', border: '1px solid rgba(74, 222, 128, 0.4)', padding: '2px 6px', borderRadius: '4px' }}>
                                Day {assignedDays.join(', ')} 포함됨
                              </span>
                            )}
                          </div>
                          {/* Facility Type Badge */}
                          <span className="facility-badge" title={facilityLabel} style={{ flexShrink: 0 }}>
                            {facilityIcon}
                          </span>
                        </div>
                        {/* Naver Category Text */}
                        {place.category && (
                          <span style={{ fontSize: '11px', color: 'var(--color-accent-primary)', flexShrink: 0, textAlign: 'right' }}>
                            {place.category}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                        {/* Day selector: inline buttons for Storage tab, select for other tabs */}
                        {isMultiDay && !isRouteCreated && activeDayTab === 0 && (
                          <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                            {Array.from({ length: dayCount }, (_, i) => i + 1).map(d => {
                              const isAssignedToDay = places.some(p => p.day === d && stripHtml(p.title) === stripHtml(place.title));
                              return (
                                <button
                                  key={d}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isAssignedToDay) {
                                      // Remove clone
                                      const clone = places.find(p => p.day === d && stripHtml(p.title) === stripHtml(place.title));
                                      if (clone) onRemovePlace(clone.id);
                                      onShowToast?.(`"${stripHtml(place.title)}" Day ${d}에서 제거됨`);
                                    } else {
                                      // Create clone
                                      if (onAddPlace) {
                                        onAddPlace({ ...place, day: d });
                                      } else {
                                        const newPlace = { ...place, id: Math.random().toString(36).substring(2, 9), day: d };
                                        onReorderPlaces([...places, newPlace]);
                                        onShowToast?.(`"${stripHtml(place.title)}" Day ${d}에 추가됨`);
                                      }
                                    }
                                  }}
                                  style={{
                                    fontSize: '11px', padding: '4px 8px', borderRadius: '4px',
                                    background: isAssignedToDay ? 'rgba(192,132,252,0.2)' : 'rgba(255,255,255,0.06)',
                                    color: isAssignedToDay ? '#c084fc' : '#cbd5e1',
                                    border: `1px solid ${isAssignedToDay ? 'rgba(192,132,252,0.5)' : 'rgba(255,255,255,0.2)'}`,
                                    cursor: 'pointer', transition: 'all 0.2s',
                                  }}
                                  title={`Day ${d}에 추가하기`}
                                >
                                  {isAssignedToDay ? `✅ D${d}` : `D${d}`}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {isMultiDay && !isRouteCreated && activeDayTab !== 0 && (
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
                            <option value={0} style={{ background: 'var(--color-bg-card)' }}>보관함</option>
                            {Array.from({ length: dayCount }, (_, i) => i + 1).map(d => (
                              <option key={d} value={d} style={{ background: 'var(--color-bg-card)' }}>
                                Day {d}
                              </option>
                            ))}
                          </select>
                        )}
                    </div>
                    </div>
                    {/* Reactions UI */}
                    {currentUserId && (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '8px', paddingLeft: '38px' }} onClick={e => e.stopPropagation()}>
                        {['❤️', '👍', '🤔', '❌'].map(emoji => {
                          const reactions = place.reactions || {};
                          const hasReacted = reactions[currentUserId] === emoji;
                          // count total of this emoji
                          const count = Object.values(reactions).filter(v => v === emoji).length;
                          return (
                            <button
                              key={emoji}
                              onClick={(e) => {
                                e.stopPropagation();
                                const updatedReactions = { ...reactions };
                                if (hasReacted) {
                                  delete updatedReactions[currentUserId];
                                } else {
                                  updatedReactions[currentUserId] = emoji;
                                }
                                const updatedPlace = { ...place, reactions: updatedReactions };
                                const newPlaces = places.map(p => p.id === place.id ? updatedPlace : p);
                                onReorderPlaces(newPlaces);
                              }}
                              style={{
                                padding: '4px 8px', borderRadius: '12px',
                                background: hasReacted ? 'rgba(255, 60, 100, 0.2)' : 'var(--color-bg-tertiary)',
                                border: hasReacted ? '1px solid rgba(255, 60, 100, 0.5)' : '1px solid var(--color-border)',
                                cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px',
                                color: hasReacted ? '#ff3c64' : 'var(--color-text-secondary)',
                                transition: 'all 0.2s',
                              }}
                            >
                              <span>{emoji}</span>
                              {count > 0 && <span style={{ fontSize: '11px', fontWeight: 600 }}>{count}</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
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
                          background: 'rgba(255, 255, 255, 0.05)', color: 'var(--color-text-tertiary)', border: 'none',
                          width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, transition: 'background 0.2s, color 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
                        title={placeDay !== 0 ? "보관함으로 되돌리기" : "완전 삭제"}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
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
                  background: 'var(--color-bg-secondary)', border: '1px dashed var(--color-border)',
                  color: 'var(--color-accent-primary)', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
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
                    border: '1px solid var(--color-bg-secondary)', display: 'flex', flexDirection: 'column', gap: '8px'
                  }}>
                    {sortedStoragePlaces.length === 0 ? (
                      <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', fontSize: '13px', padding: '12px' }}>
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
                              if (onAddPlace) {
                                onAddPlace({ ...p, day: activeDayTab as number });
                              } else {
                                const newPlace = { ...p, id: p.id + '-' + Date.now(), day: activeDayTab as number, order: places.length };
                                onReorderPlaces([...places, newPlace]);
                              }
                              setShowStoragePins?.(false);
                            }}
                            style={{
                              background: 'var(--color-bg-secondary)', padding: '12px', borderRadius: '8px',
                              display: 'flex', alignItems: 'center', gap: '12px',
                              cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                          >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {stripHtml(p.title)}
                                </div>
                                <span className="facility-badge" title={fLabel} style={{ flexShrink: 0 }}>
                                  {fIcon}
                                </span>
                              </div>
                              {p.category && (
                                <span style={{ fontSize: '11px', color: 'var(--color-accent-primary)', flexShrink: 0, textAlign: 'right' }}>
                                  {p.category}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                                background: 'rgba(255,255,255,0.06)', color: '#4ade80',
                                border: '1px solid rgba(74,222,128,0.2)', fontWeight: 500, whiteSpace: 'nowrap',
                              }}>🗺️ 네이버맵</span>
                            </div>
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--color-accent-primary)', fontWeight: 700, padding: '6px 12px', background: 'var(--color-border)', borderRadius: '8px' }}>
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

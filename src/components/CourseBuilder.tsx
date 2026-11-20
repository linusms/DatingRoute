'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type {
  CoursePlace,
  DateSchedule,
  DirectionLeg,
  DirectionResult,
  PlaceUpdatableFields,
  RoomMember,
  TransitMode,
} from '@/lib/types';
import type { NewPlaceInput } from '@/hooks/useCourseSession';
import { autoDistributePlaces, optimizeRouteTSP, stripHtml } from '@/lib/utils';
import { computeDayTimeline, dateOfDay, todayDayNumber, WEEKDAYS_KO, type TimelineEntry } from '@/lib/timeline';
import { useDragAndDrop } from '@/lib/useDragAndDrop';
import DateSchedulePicker from './DateSchedulePicker';
import CourseHeader from './course/CourseHeader';
import CourseActions from './course/CourseActions';
import CourseSummary from './course/CourseSummary';
import DayTabs from './course/DayTabs';
import DayOfBanner from './course/DayOfBanner';
import LegConnector from './course/LegConnector';
import PlaceCard from './course/PlaceCard';
import ShareSection from './course/ShareSection';
import SimilarPlacesModal from './course/SimilarPlacesModal';
import StoragePicker from './course/StoragePicker';

interface CourseBuilderProps {
  places: CoursePlace[];
  directions: DirectionResult | null;
  isRouteCreated: boolean;
  transitMode: TransitMode;
  onChangeTransitMode: (mode: TransitMode) => void;
  onCreateRoute: () => void;
  onApplyPlaces: (list: CoursePlace[]) => void;
  onAddPlaces: (inputs: NewPlaceInput[], options?: { day?: number; silent?: boolean }) => number;
  onRemovePlace: (id: string) => void;
  onUpdatePlace: (id: string, fields: PlaceUpdatableFields) => void;
  onReact: (id: string, emoji: string | null) => void;
  onReplacePlace: (id: string, input: NewPlaceInput) => void;
  onUploadPhoto: (id: string, file: Blob | null) => Promise<void>;
  onShowReview: (placeName: string) => void;
  onHighlightPlace: (place: CoursePlace | null) => void;
  onShareKakao: () => void;
  onCopyShareLink: () => void;
  onCopyInviteLink?: () => void;
  members: RoomMember[];
  currentUserId: string;
  schedule: DateSchedule | null;
  onScheduleChange: (schedule: DateSchedule | null) => void;
  courseName: string;
  courseDescription: string;
  onUpdateCourseName: (displayName: string, description: string) => Promise<void>;
  activeDayTab: 'all' | number;
  setActiveDayTab: (tab: 'all' | number) => void;
  showStoragePins: boolean;
  setShowStoragePins: (show: boolean) => void;
  onShowToast: (msg: string) => void;
}

export default function CourseBuilder(props: CourseBuilderProps) {
  const {
    places, directions, isRouteCreated, transitMode, schedule, members, currentUserId,
    activeDayTab, setActiveDayTab, onApplyPlaces, onShowToast,
  } = props;

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lovedOnly, setLovedOnly] = useState(false);
  const [similarFor, setSimilarFor] = useState<CoursePlace | null>(null);

  /* ─────────── Days ─────────── */

  const dayCount = useMemo(() => {
    if (!schedule?.startDate || !schedule?.endDate) return 1;
    const diff = Math.round((Date.parse(`${schedule.endDate}T00:00:00`) - Date.parse(`${schedule.startDate}T00:00:00`)) / 86400000) + 1;
    return Math.max(1, Math.min(30, diff));
  }, [schedule]);
  const isMultiDay = dayCount > 1;
  const todayDay = todayDayNumber(schedule);

  const getDayLabel = (day: number) => {
    if (day === 0) return '보관함';
    const iso = dateOfDay(schedule, day);
    if (!iso) return `Day ${day}`;
    const d = new Date(`${iso}T00:00:00`);
    return `Day ${day} (${d.getMonth() + 1}/${d.getDate()} ${WEEKDAYS_KO[d.getDay()]})`;
  };

  /* ─────────── Derived data ─────────── */

  const sameTitle = (a: CoursePlace, b: CoursePlace) => stripHtml(a.title) === stripHtml(b.title);

  const isConfirmed = (p: CoursePlace) =>
    members.length >= 2 && members.every((m) => p.reactions?.[m.userId] === '❤️');

  const assignedDaysOf = (p: CoursePlace) =>
    Array.from(new Set(places.filter((o) => (o.day ?? 0) > 0 && sameTitle(o, p)).map((o) => o.day as number))).sort((a, b) => a - b);

  const legByFrom = useMemo(() => {
    const map = new Map<string, DirectionLeg>();
    if (isRouteCreated && directions) for (const leg of directions.legs) if (leg.fromId) map.set(leg.fromId, leg);
    return map;
  }, [directions, isRouteCreated]);

  const dayLists = useMemo(() => {
    const map = new Map<number, CoursePlace[]>();
    for (const p of places) {
      const d = p.day ?? 0;
      if (d > 0) (map.get(d) ?? map.set(d, []).get(d)!).push(p);
    }
    return map;
  }, [places]);

  const timelines = useMemo(() => {
    const result = new Map<number, Map<string, TimelineEntry>>();
    const legs = isRouteCreated && directions ? directions.legs : [];
    dayLists.forEach((list, day) => result.set(day, computeDayTimeline(list, schedule, transitMode, legs)));
    return result;
  }, [dayLists, schedule, transitMode, directions, isRouteCreated]);

  const filteredSource = useMemo(() => {
    if (activeDayTab === 'all') {
      return places.filter((p) => (p.day ?? 0) !== 0).sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
    }
    if (activeDayTab === 0) {
      const storage = places.filter((p) => (p.day ?? 0) === 0 && (!lovedOnly || isConfirmed(p)));
      const assigned = (p: CoursePlace) => places.some((o) => (o.day ?? 0) > 0 && sameTitle(o, p));
      return storage.sort((a, b) => Number(assigned(a)) - Number(assigned(b)));
    }
    return places.filter((p) => (p.day ?? 0) === activeDayTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, activeDayTab, lovedOnly, members]);

  const { list: filteredPlaces, updateList, handleDragStart, handleDragEnter, handleDragOver, handleDrop, handleDragEnd } =
    useDragAndDrop(filteredSource);
  useEffect(() => { updateList(filteredSource); }, [filteredSource, updateList]);

  const timeWindow = useMemo(() => {
    if (typeof activeDayTab !== 'number' || activeDayTab === 0) return null;
    const list = dayLists.get(activeDayTab) || [];
    const tl = timelines.get(activeDayTab);
    if (!tl || list.length === 0) return null;
    const first = tl.get(list[0].id);
    const last = tl.get(list[list.length - 1].id);
    if (!first || !last) return null;
    return { start: first.arrival, end: last.departure, overEnd: last.overEnd, endTime: schedule?.endTime };
  }, [activeDayTab, dayLists, timelines, schedule?.endTime]);

  const totalCost = useMemo(() => {
    const scope = activeDayTab === 'all'
      ? places.filter((p) => (p.day ?? 0) > 0)
      : activeDayTab === 0 ? [] : places.filter((p) => p.day === activeDayTab);
    return scope.reduce((sum, p) => sum + (p.cost ?? 0), 0);
  }, [places, activeDayTab]);

  /* ─────────── Mutations ─────────── */

  const changePlaceDay = (placeId: string, newDay: number) => {
    const place = places.find((p) => p.id === placeId);
    if (!place) return;
    if (newDay === 0 && places.some((p) => (p.day ?? 0) === 0 && sameTitle(p, place))) {
      // The storage already has this place: the day copy is just removed
      props.onRemovePlace(placeId);
      return;
    }
    onApplyPlaces(places.map((p) => (p.id === placeId ? { ...p, day: newDay } : p)));
  };

  const toggleDayCopy = (place: CoursePlace, day: number) => {
    const copy = places.find((p) => p.day === day && sameTitle(p, place));
    if (copy) {
      props.onRemovePlace(copy.id);
      onShowToast(`"${stripHtml(place.title)}" Day ${day}에서 뺐어요`);
    } else {
      props.onAddPlaces([place], { day });
    }
  };

  const reorderFiltered = (newFiltered: CoursePlace[]) => {
    let next: CoursePlace[];
    if (activeDayTab === 'all') {
      next = [...places.filter((p) => (p.day ?? 0) === 0), ...newFiltered];
    } else if (activeDayTab === 0) {
      const moved = new Set(newFiltered.map((p) => p.id));
      next = [...newFiltered, ...places.filter((p) => !moved.has(p.id))];
    } else {
      next = [...places.filter((p) => (p.day ?? 0) !== activeDayTab), ...newFiltered.map((p) => ({ ...p, day: activeDayTab }))];
    }
    next.sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
    onApplyPlaces(next);
  };

  const optimizeDay = () => {
    if (typeof activeDayTab !== 'number' || activeDayTab === 0) return;
    const current = places.filter((p) => p.day === activeDayTab);
    if (current.length <= 2) return;
    onApplyPlaces([...places.filter((p) => p.day !== activeDayTab), ...optimizeRouteTSP(current, 0)]);
    onShowToast('가까운 순서로 동선을 정리했어요');
  };

  const autoDistribute = () => {
    if (dayCount < 2) return;
    onApplyPlaces(autoDistributePlaces(places, dayCount));
    onShowToast('보관함 장소를 날짜별로 나눴어요');
  };

  const resetDays = () => {
    if (activeDayTab === 0) return;
    const message = activeDayTab === 'all' ? '모든 일정을 보관함으로 되돌리시겠습니까?' : '이 일정의 장소들을 보관함으로 되돌리시겠습니까?';
    if (!confirm(message)) return;
    const inScope = (p: CoursePlace) => (activeDayTab === 'all' ? (p.day ?? 0) !== 0 : p.day === activeDayTab);
    // Day copies whose title is already in storage are removed; others move back to storage
    const next: CoursePlace[] = [];
    for (const p of places) {
      if (!inScope(p)) next.push(p);
      else if (!next.some((o) => (o.day ?? 0) === 0 && sameTitle(o, p)) && !places.some((o) => (o.day ?? 0) === 0 && sameTitle(o, p))) {
        next.push({ ...p, day: 0 });
      }
    }
    onApplyPlaces(next);
  };

  const deleteSelected = () => {
    if (!confirm(`선택한 장소 ${selectedIds.size}개를 삭제하시겠습니까?`)) return;
    onApplyPlaces(places.filter((p) => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
    setIsSelectMode(false);
  };

  const toggleHoldSelected = () => {
    onApplyPlaces(places.map((p) => (selectedIds.has(p.id) ? { ...p, isHold: !p.isHold } : p)));
    setSelectedIds(new Set());
    setIsSelectMode(false);
  };

  const menuItems = [
    ...(typeof activeDayTab === 'number' && activeDayTab > 0 && filteredPlaces.length > 2
      ? [{ key: 'optimize', label: '🪄 동선 최적화', onSelect: optimizeDay }] : []),
    ...((activeDayTab === 'all' || activeDayTab === 0) && isMultiDay && places.some((p) => (p.day ?? 0) === 0)
      ? [{ key: 'distribute', label: '🤖 날짜별 자동 분배', onSelect: autoDistribute }] : []),
    ...(activeDayTab !== 0 && filteredPlaces.length > 0
      ? [{ key: 'reset', label: '🗑️ 보관함으로 되돌리기', danger: true, onSelect: resetDays }] : []),
  ];

  const isStorageTab = activeDayTab === 0;
  const hasDayPlaces = places.some((p) => (p.day ?? 0) > 0);
  const scopeLabel = activeDayTab === 'all' ? '전체' : `Day ${activeDayTab}`;
  const dayNumbers = new Map<string, number>();
  {
    const counters = new Map<number, number>();
    for (const p of filteredPlaces) {
      const d = p.day ?? 0;
      counters.set(d, (counters.get(d) ?? 0) + 1);
      dayNumbers.set(p.id, counters.get(d)!);
    }
  }

  /* ─────────── Render ─────────── */

  return (
    <div className="cb-root">
      <CourseHeader courseName={props.courseName} courseDescription={props.courseDescription} onSave={props.onUpdateCourseName} />

      {todayDay !== null && (
        <DayOfBanner
          day={todayDay}
          dayPlaces={dayLists.get(todayDay) || []}
          timeline={timelines.get(todayDay) || new Map()}
          onUpdatePlace={props.onUpdatePlace}
          onOpenDay={() => setActiveDayTab(todayDay)}
        />
      )}

      <DateSchedulePicker schedule={schedule} onScheduleChange={props.onScheduleChange} />

      {places.length === 0 ? (
        <div className="course-empty">
          <div className="course-empty-icon">🗺️</div>
          <h4>경로가 비어있어요</h4>
          <p>
            장소검색이나 AI 추천 탭에서 장소를 찾아
            <br />
            보관함에 담아보세요!
          </p>
        </div>
      ) : (
        <>
          <CourseActions
            isRouteCreated={isRouteCreated}
            canCreateRoute={places.filter((p) => (p.day ?? 0) > 0).length >= 2}
            onCreateRoute={props.onCreateRoute}
            menuItems={menuItems}
          />

          <DayTabs
            dayCount={dayCount}
            activeDayTab={activeDayTab}
            onChange={setActiveDayTab}
            getDayLabel={getDayLabel}
            places={places}
            todayDay={todayDay}
          />

          <CourseSummary
            isRouteCreated={isRouteCreated}
            directions={directions}
            transitMode={transitMode}
            onChangeTransitMode={props.onChangeTransitMode}
            timeWindow={timeWindow}
            totalCost={totalCost}
            memberCount={members.length}
            scopeLabel={scopeLabel}
          />

          {isStorageTab && (
            <div className="cb-storage-toolbar">
              <span className="cb-muted cb-small">보관함 ({filteredPlaces.length}개)</span>
              <div className="cb-toolbar-buttons">
                {members.length >= 2 && (
                  <button className={`cb-chip-btn ${lovedOnly ? 'on' : ''}`} onClick={() => setLovedOnly((v) => !v)} title="모든 참여자가 ❤️를 누른 장소만">
                    💖 모두 찜
                  </button>
                )}
                {isSelectMode ? (
                  <>
                    <button className="cb-chip-btn danger" onClick={deleteSelected} disabled={selectedIds.size === 0}>선택 삭제</button>
                    <button className="cb-chip-btn" onClick={toggleHoldSelected} disabled={selectedIds.size === 0}>보류/해제</button>
                    <button className="cb-chip-btn" onClick={() => { setIsSelectMode(false); setSelectedIds(new Set()); }}>취소</button>
                  </>
                ) : (
                  filteredPlaces.length > 0 && <button className="cb-chip-btn" onClick={() => setIsSelectMode(true)}>선택 모드</button>
                )}
              </div>
            </div>
          )}

          {activeDayTab !== 0 && filteredPlaces.length === 0 && (
            <div className="cb-muted cb-center cb-pad">이 날에 담긴 장소가 없어요. 아래에서 보관함 장소를 추가해보세요.</div>
          )}

          <div className="cb-place-list">
            {(() => {
              const seenDays = new Set<number>();
              return filteredPlaces.map((place, idx) => {
                const placeDay = place.day ?? 0;
                const showDayHeader = isMultiDay && activeDayTab === 'all' && !seenDays.has(placeDay);
                if (showDayHeader) seenDays.add(placeDay);
                const next = filteredPlaces[idx + 1];
                const connectsToNext = !isStorageTab && placeDay > 0 && next && (next.day ?? 0) === placeDay;
                const timeline = timelines.get(placeDay)?.get(place.id);
                const draggable = !isRouteCreated && !isSelectMode;

                return (
                  <React.Fragment key={place.id}>
                    {showDayHeader && (
                      <div className="cb-day-divider" style={{ marginTop: idx === 0 ? 0 : 20 }}>
                        <span className="cb-day-divider-label">📅 {getDayLabel(placeDay)}</span>
                        <span className="cb-day-divider-line" />
                      </div>
                    )}
                    <PlaceCard
                      place={place}
                      number={dayNumbers.get(place.id) ?? idx + 1}
                      isStorageTab={isStorageTab}
                      isMultiDay={isMultiDay}
                      dayCount={dayCount}
                      isRouteCreated={isRouteCreated}
                      isSelectMode={isSelectMode}
                      isSelected={selectedIds.has(place.id)}
                      assignedDays={isStorageTab ? assignedDaysOf(place) : []}
                      isConfirmed={isConfirmed(place)}
                      timeline={timeline}
                      dayDate={dateOfDay(schedule, placeDay)}
                      isToday={todayDay !== null && placeDay === todayDay}
                      currentUserId={currentUserId}
                      members={members}
                      drag={draggable ? {
                        draggable: true,
                        onDragStart: (e) => handleDragStart(e, idx),
                        onDragEnter: (e) => handleDragEnter(e, idx),
                        onDragOver: handleDragOver,
                        onDragEnd: handleDragEnd,
                        onDrop: (e) => handleDrop(e, reorderFiltered),
                      } : null}
                      onToggleSelect={() => setSelectedIds((prev) => {
                        const nextSet = new Set(prev);
                        if (nextSet.has(place.id)) nextSet.delete(place.id); else nextSet.add(place.id);
                        return nextSet;
                      })}
                      onShowReview={() => props.onShowReview(stripHtml(place.title))}
                      onHighlight={(on) => props.onHighlightPlace(on ? place : null)}
                      onChangeDay={(day) => changePlaceDay(place.id, day)}
                      onToggleDayCopy={(day) => toggleDayCopy(place, day)}
                      onRemove={() => (placeDay !== 0 ? changePlaceDay(place.id, 0) : props.onRemovePlace(place.id))}
                      onUpdate={(fields) => props.onUpdatePlace(place.id, fields)}
                      onReact={(emoji) => props.onReact(place.id, emoji)}
                      onOpenSimilar={() => setSimilarFor(place)}
                      onUploadPhoto={(file) => props.onUploadPhoto(place.id, file)}
                    />
                    {connectsToNext && (
                      <LegConnector
                        from={place}
                        to={next}
                        leg={legByFrom.get(place.id) ?? null}
                        transitMode={transitMode}
                        estimatedMinutes={timeline?.travelNext}
                      />
                    )}
                  </React.Fragment>
                );
              });
            })()}
          </div>

          {typeof activeDayTab === 'number' && activeDayTab > 0 && (
            <StoragePicker
              open={props.showStoragePins}
              onToggle={() => props.setShowStoragePins(!props.showStoragePins)}
              places={places}
              day={activeDayTab}
              onPick={(p) => props.onAddPlaces([p], { day: activeDayTab })}
            />
          )}

          {hasDayPlaces && (
            <ShareSection
              places={places}
              directions={isRouteCreated ? directions : null}
              schedule={schedule}
              transitMode={transitMode}
              courseName={props.courseName}
              onShareKakao={props.onShareKakao}
              onCopyShareLink={props.onCopyShareLink}
              onCopyInviteLink={props.onCopyInviteLink}
            />
          )}
        </>
      )}

      {similarFor && (
        <SimilarPlacesModal
          place={similarFor}
          onClose={() => setSimilarFor(null)}
          onPick={(input) => props.onReplacePlace(similarFor.id, input)}
        />
      )}
    </div>
  );
}

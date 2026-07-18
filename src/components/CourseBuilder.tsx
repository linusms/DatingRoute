import React from 'react';
import { CoursePlace, DirectionResult, TransitMode, FACILITY_ICONS, FACILITY_LABELS } from '@/lib/types';
import { formatDuration, formatDistance, getWalkingTimeMs, stripHtml, parseCategoryToFacility } from '@/lib/utils';
import { useDragAndDrop } from '@/lib/useDragAndDrop';

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
}: CourseBuilderProps) {
  const {
    list: draggablePlaces,
    updateList,
    handleDragStart,
    handleDragEnter,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  } = useDragAndDrop(places);

  // Sync internal drag list when external places change
  React.useEffect(() => {
    updateList(places);
  }, [places, updateList]);

  if (places.length === 0) {
    return (
      <div className="course-empty">
        <div className="course-empty-icon">🗺️</div>
        <h4>코스가 비어있어요</h4>
        <p>
          검색 탭에서 장소를 찾고
          <br />
          &ldquo;코스 추가&rdquo; 버튼을 눌러보세요!
        </p>
      </div>
    );
  }

  // Calculate walking time if directions (driving) is available
  let walkingDuration = 0;
  if (directions) {
    const totalDistMeters = directions.totalDistance;
    walkingDuration = getWalkingTimeMs(totalDistMeters);
  }

  // Get per-leg info
  const legs = directions?.legs || [];

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Route Mode & Stats (Only if route is created) */}
      {isRouteCreated && directions && (
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
      )}

      {/* Places DND timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {draggablePlaces.map((place, idx) => {
          const facility = parseCategoryToFacility(place.category);
          const facilityIcon = FACILITY_ICONS[facility];
          const facilityLabel = FACILITY_LABELS[facility];

          // Get leg info for the segment AFTER this place (between this place and next)
          const legAfter = (isRouteCreated && legs.length > 0 && idx < draggablePlaces.length - 1)
            ? legs[idx] : null;

          return (
            <React.Fragment key={place.id}>
              <div
                draggable={!isRouteCreated}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragEnter={(e) => handleDragEnter(e, idx)}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, (newList) => {
                  const updated = newList.map((p, i) => ({ ...p, order: i }));
                  onReorderPlaces(updated);
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ cursor: 'pointer', fontSize: '15px', fontWeight: 600, color: '#f5f0ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                         onClick={() => onShowReview(stripHtml(place.title))}>
                      {stripHtml(place.title)}
                    </div>
                    {/* Facility Type Badge */}
                    <span className="facility-badge" title={facilityLabel}>
                      {facilityIcon} {facilityLabel}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#8b7fa8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {place.roadAddress || place.address || place.category}
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
        })}
      </div>

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
        <button
          className="btn btn-ghost"
          style={{ width: '100%', marginTop: '10px' }}
          onClick={() => onReorderPlaces([...places])}
        >
          ✏️ 장소 순서 수정하기
        </button>
      )}
    </div>
  );
}

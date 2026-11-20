'use client';

import { FACILITY_ICONS, FACILITY_LABELS, type CoursePlace } from '@/lib/types';
import { parseCategoryToFacility, stripHtml } from '@/lib/utils';

interface StoragePickerProps {
  open: boolean;
  onToggle: () => void;
  places: CoursePlace[];
  day: number;
  onPick: (place: CoursePlace) => void;
}

/** In a Day tab: add a place from the storage (보관함) list to this day. */
export default function StoragePicker({ open, onToggle, places, day, onPick }: StoragePickerProps) {
  const storage = places.filter((p) => (p.day ?? 0) === 0);
  const inThisDay = new Set(places.filter((p) => p.day === day).map((p) => stripHtml(p.title)));
  const assignedAnywhere = new Set(places.filter((p) => (p.day ?? 0) > 0).map((p) => stripHtml(p.title)));
  const sorted = [...storage].sort((a, b) => Number(assignedAnywhere.has(stripHtml(a.title))) - Number(assignedAnywhere.has(stripHtml(b.title))));

  return (
    <div className="cb-storage-picker">
      <button className="cb-dashed-btn" onClick={onToggle}>
        <span>{open ? '−' : '+'}</span> 담은 장소 목록에서 추가
      </button>
      {open && (
        <div className="cb-storage-list animate-fade-in">
          {sorted.length === 0 ? (
            <div className="cb-muted cb-center">보관함에 담은 장소가 없습니다.</div>
          ) : (
            sorted.map((p) => {
              const facility = parseCategoryToFacility(p.category);
              const already = inThisDay.has(stripHtml(p.title));
              return (
                <button key={p.id} className={`cb-storage-item ${assignedAnywhere.has(stripHtml(p.title)) ? 'is-dimmed' : ''}`} onClick={() => onPick(p)} disabled={already}>
                  <div className="cb-storage-info">
                    <div className="cb-place-title-row">
                      <span className="cb-place-title as-text">{stripHtml(p.title)}</span>
                      <span className="facility-badge" title={FACILITY_LABELS[facility]}>{FACILITY_ICONS[facility]}</span>
                    </div>
                    <div className="cb-place-address">{p.roadAddress || p.address}</div>
                  </div>
                  <span className="cb-storage-add">{already ? '추가됨' : '추가 +'}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

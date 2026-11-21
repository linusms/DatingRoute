'use client';

import { useMemo, useState } from 'react';
import type { AICourseDraft, CoursePlace, DateSchedule, Place } from '@/lib/types';
import type { NewPlaceInput } from '@/hooks/useCourseSession';
import { stripHtml } from '@/lib/utils';
import { formatClock, parseClock } from '@/lib/timeline';

const THEMES = ['분위기 좋은', '비 오는 날 실내', '조용한 대화', '기념일', '가성비', '야경', '산책'];

interface AICourseDraftPanelProps {
  coursePlaces: CoursePlace[];
  schedule: DateSchedule | null;
  onAddPlaces: (inputs: NewPlaceInput[], options?: { day?: number; silent?: boolean }) => number;
  onOpenDay: (day: number) => void;
  onHighlightPlace?: (place: Place | null) => void;
}

/** "AI 코스 초안": real places from Naver, ordered by Gemini, added in one tap. */
export default function AICourseDraftPanel({ coursePlaces, schedule, onAddPlaces, onOpenDay, onHighlightPlace }: AICourseDraftPanelProps) {
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState('');
  const [theme, setTheme] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AICourseDraft | null>(null);
  const [targetDay, setTargetDay] = useState(1);

  const dayCount = useMemo(() => {
    if (!schedule?.startDate || !schedule?.endDate) return 1;
    const diff = Math.round((Date.parse(`${schedule.endDate}T00:00:00`) - Date.parse(`${schedule.startDate}T00:00:00`)) / 86400000) + 1;
    return Math.max(1, Math.min(30, diff));
  }, [schedule]);

  const generate = async () => {
    if (!region.trim() && coursePlaces.length === 0) {
      setError('지역을 입력해주세요. (예: 성수동)');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: region.trim(),
          theme: theme.trim(),
          schedule,
          points: region.trim() ? [] : coursePlaces.slice(0, 5).map((p) => ({ mapx: p.mapx, mapy: p.mapy })),
          excludeTitles: coursePlaces.map((p) => stripHtml(p.title)),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '코스 초안을 만들지 못했어요.');
      setDraft(data.draft);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const items = draft?.items ?? [];
  const inputs: NewPlaceInput[] = items.map((it) => ({ ...it.place, stayMinutes: it.stayMinutes }));
  // Rough preview times: stay + ~20 minutes of travel between places
  const startClock = parseClock(schedule?.startTime, 12 * 60);
  const arrivals = items.reduce<number[]>((acc, _it, i) => {
    acc.push(i === 0 ? startClock : acc[i - 1] + items[i - 1].stayMinutes + 20);
    return acc;
  }, []);

  return (
    <div className="ai-draft">
      <button className="ai-draft-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>🪄 AI가 코스 초안 짜주기</span>
        <span className="ai-draft-caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="ai-draft-body">
          <div className="ai-draft-row">
            <input
              className="ai-region-input"
              value={region}
              maxLength={30}
              onChange={(e) => setRegion(e.target.value)}
              placeholder={coursePlaces.length > 0 ? '지역 (비우면 담은 장소 주변)' : '지역 (예: 성수동, 연남동)'}
              onKeyDown={(e) => { if (e.key === 'Enter') generate(); }}
            />
          </div>
          <div className="ai-draft-themes">
            {THEMES.map((t) => (
              <button key={t} className={`cb-chip-btn ${theme === t ? 'on' : ''}`} onClick={() => setTheme(theme === t ? '' : t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="ai-draft-hint">
            {schedule ? `일정 ${schedule.startTime}~${schedule.endTime}에 맞춰 짜요.` : '일정을 정하면 시간대에 맞춰 짜요. (기본 12:00~21:00)'}
          </div>
          <button className="btn btn-primary ai-draft-generate" onClick={generate} disabled={loading}>
            {loading ? '코스를 짜는 중... (10초 정도)' : draft ? '🔄 다시 짜기' : '✨ 초안 만들기'}
          </button>
          {error && <div className="cb-error-text">{error}</div>}

          {draft && items.length > 0 && (
            <div className="ai-draft-result animate-fade-in">
              <div className="ai-draft-title">{draft.title}</div>
              {draft.summary && <div className="ai-draft-summary">{draft.summary}</div>}
              <ol className="ai-draft-list">
                {items.map((it, i) => {
                  const arrival = arrivals[i];
                  return (
                    <li
                      key={it.place.id}
                      onMouseEnter={() => onHighlightPlace?.(it.place)}
                      onMouseLeave={() => onHighlightPlace?.(null)}
                    >
                      <span className="ai-draft-num">{i + 1}</span>
                      <div className="ai-draft-item">
                        <div className="ai-draft-item-head">
                          <strong>{it.place.title}</strong>
                          <span className="cb-muted cb-small">{formatClock(arrival)} · {it.stayMinutes}분</span>
                        </div>
                        <div className="cb-muted cb-small">{it.place.category}</div>
                        {it.reason && <div className="ai-draft-reason">{it.reason}</div>}
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="ai-draft-actions">
                <button className="cb-chip-btn" onClick={() => onAddPlaces(inputs, { day: 0 })}>보관함에 모두 담기</button>
                <div className="ai-draft-day">
                  {dayCount > 1 && (
                    <select className="cb-day-select" value={targetDay} onChange={(e) => setTargetDay(Number(e.target.value))} aria-label="넣을 날짜">
                      {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => <option key={d} value={d}>Day {d}</option>)}
                    </select>
                  )}
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const day = dayCount > 1 ? targetDay : 1;
                      onAddPlaces(inputs, { day });
                      onOpenDay(day);
                    }}
                  >
                    {dayCount > 1 ? '이 날 코스로 넣기' : '코스로 넣기'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

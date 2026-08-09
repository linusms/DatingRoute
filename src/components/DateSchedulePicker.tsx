'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { DateSchedule } from '@/lib/types';

interface DateSchedulePickerProps {
  schedule: DateSchedule | null;
  onScheduleChange: (schedule: DateSchedule) => void;
}

export default function DateSchedulePicker({
  schedule,
  onScheduleChange,
}: DateSchedulePickerProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectingEnd, setSelectingEnd] = useState(false);

  const [startDate, setStartDate] = useState(schedule?.startDate || '');
  const [endDate, setEndDate] = useState(schedule?.endDate || '');
  const [startTime, setStartTime] = useState(schedule?.startTime || '10:00');
  const [endTime, setEndTime] = useState(schedule?.endTime || '22:00');
  
  const [isCollapsed, setIsCollapsed] = useState(!!schedule?.startDate);

  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate();
  }, [viewYear, viewMonth]);

  const firstDayOfWeek = useMemo(() => {
    return new Date(viewYear, viewMonth, 1).getDay();
  }, [viewYear, viewMonth]);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const handlePrevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }, [viewYear, viewMonth]);

  const handleNextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }, [viewYear, viewMonth]);

  const handleDayClick = useCallback((day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (!selectingEnd || !startDate) {
      setStartDate(dateStr);
      setEndDate('');
      setSelectingEnd(true);
    } else {
      if (dateStr < startDate) {
        setStartDate(dateStr);
        setEndDate(startDate);
      } else {
        setEndDate(dateStr);
      }
      setSelectingEnd(false);
    }
  }, [viewYear, viewMonth, selectingEnd, startDate]);

  const isInRange = useCallback((day: number) => {
    if (!startDate || !endDate) return false;
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateStr >= startDate && dateStr <= endDate;
  }, [viewYear, viewMonth, startDate, endDate]);

  const isStart = useCallback((day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateStr === startDate;
  }, [viewYear, viewMonth, startDate]);

  const isEnd = useCallback((day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateStr === endDate;
  }, [viewYear, viewMonth, endDate]);


  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
  const MONTH_NAMES = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

  const formatSelectedRange = () => {
    if (!startDate) return '날짜를 선택하세요';
    const sd = new Date(startDate);
    const sdStr = `${sd.getMonth() + 1}/${sd.getDate()}`;
    if (!endDate || endDate === startDate) return sdStr;
    const ed = new Date(endDate);
    return `${sdStr} ~ ${ed.getMonth() + 1}/${ed.getDate()}`;
  };

  return (
    <div className="date-schedule-picker">
      {/* Selected Range Info (Always Visible, Acts as Toggle) */}
      <div 
        className="dsp-selection-info" 
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div className="dsp-date-display">
          <span className="dsp-date-label">📅 일정</span>
          <span className="dsp-date-value">
            {formatSelectedRange()} {startTime} ~ {endTime}
          </span>
        </div>
        <div style={{ color: 'var(--color-text-muted)' }}>
          {isCollapsed ? '▼' : '▲'}
        </div>
      </div>

      {!isCollapsed && (
        <div className="dsp-collapsible-content">
          {/* Calendar Header */}
          <div className="dsp-calendar-header">
            <button className="dsp-nav-btn" onClick={handlePrevMonth}>‹</button>
            <span className="dsp-month-label">{viewYear}년 {MONTH_NAMES[viewMonth]}</span>
            <button className="dsp-nav-btn" onClick={handleNextMonth}>›</button>
          </div>

          {/* Weekday Labels */}
          <div className="dsp-weekdays">
            {WEEKDAYS.map((d) => (
              <div key={d} className={`dsp-weekday ${d === '일' ? 'sunday' : d === '토' ? 'saturday' : ''}`}>{d}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="dsp-days-grid">
            {Array.from({ length: firstDayOfWeek }, (_, i) => (
              <div key={`empty-${i}`} className="dsp-day empty" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isPast = dateStr < todayStr;
              const dayOfWeek = (firstDayOfWeek + i) % 7;

              return (
                <button
                  key={day}
                  className={`dsp-day ${
                    isStart(day) ? 'start' : ''
                  } ${
                    isEnd(day) ? 'end' : ''
                  } ${
                    isInRange(day) ? 'in-range' : ''
                  } ${
                    isPast ? 'past' : ''
                  } ${
                    dayOfWeek === 0 ? 'sunday' : dayOfWeek === 6 ? 'saturday' : ''
                  } ${
                    dateStr === todayStr ? 'today' : ''
                  }`}
                  onClick={() => !isPast && handleDayClick(day)}
                  disabled={isPast}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Time Inputs */}
          <div className="dsp-time-row">
            <div className="dsp-time-input">
              <label>시작 시간</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="input dsp-time-field"
              />
            </div>
            <div className="dsp-time-divider">~</div>
            <div className="dsp-time-input">
              <label>종료 시간</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="input dsp-time-field"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

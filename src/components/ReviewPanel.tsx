'use client';

import React, { useEffect, useState } from 'react';
import type { ReviewItem, YoutubeVideo } from '@/lib/types';
import { stripHtml } from '@/lib/utils';

export type ReviewMode = 'reviews' | 'summary';
type SummaryType = 'blog' | 'youtube';

interface ReviewData {
  videos: YoutubeVideo[];
  blogs: ReviewItem[];
}

interface ReviewPanelProps {
  placeName: string;
  mode: ReviewMode;
  onModeChange: (mode: ReviewMode) => void;
  onClose: () => void;
}

// Reopening the same place (or switching between list and summary) doesn't search again
const reviewCache = new Map<string, Promise<ReviewData>>();
const summaryCache = new Map<string, Promise<string>>();

function loadReviews(placeName: string): Promise<ReviewData> {
  let pending = reviewCache.get(placeName);
  if (!pending) {
    pending = fetch(`/api/reviews?place=${encodeURIComponent(placeName)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('후기를 불러오지 못했어요.');
        const data = await res.json();
        return { videos: data.videos || [], blogs: data.blogs || [] };
      });
    pending.catch(() => reviewCache.delete(placeName));
    reviewCache.set(placeName, pending);
  }
  return pending;
}

function loadSummary(placeName: string, type: SummaryType, items: unknown[]): Promise<string> {
  const key = `${type}:${placeName}`;
  let pending = summaryCache.get(key);
  if (!pending) {
    pending = fetch('/api/reviews/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, type, placeName }),
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.summary || '요약을 만들지 못했어요.');
      return String(data.summary || '');
    });
    pending.catch(() => summaryCache.delete(key));
    summaryCache.set(key, pending);
  }
  return pending;
}

function formatPostDate(value: string): string {
  return /^\d{8}$/.test(value) ? `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}` : value;
}

/** Reviews of a place: YouTube and Naver blog lists, and an AI summary only when asked for. */
export default function ReviewPanel({ placeName, mode, onModeChange, onClose }: ReviewPanelProps) {
  const [tab, setTab] = useState<'youtube' | 'blog'>('youtube');
  const [data, setData] = useState<ReviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Partial<Record<SummaryType, string>>>({});

  useEffect(() => {
    let alive = true;
    loadReviews(placeName)
      .then((d) => {
        if (!alive) return;
        setData(d);
        // Open the tab that has something to show
        if (d.videos.length === 0 && d.blogs.length > 0) setTab('blog');
      })
      .catch((err) => { if (alive) setError((err as Error).message); });
    return () => { alive = false; };
  }, [placeName]);

  useEffect(() => {
    if (mode !== 'summary' || !data) return;
    let alive = true;
    (['blog', 'youtube'] as const).forEach((type) => {
      const items = type === 'blog' ? data.blogs : data.videos;
      if (items.length === 0) return;
      loadSummary(placeName, type, items)
        .then((text) => { if (alive) setSummaries((prev) => ({ ...prev, [type]: text })); })
        .catch((err) => { if (alive) setSummaries((prev) => ({ ...prev, [type]: (err as Error).message })); });
    });
    return () => { alive = false; };
  }, [mode, data, placeName]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const summaryCard = (type: SummaryType, label: string) => {
    const count = type === 'blog' ? data?.blogs.length ?? 0 : data?.videos.length ?? 0;
    const text = summaries[type];
    return (
      <div className="review-summary-card">
        <div className="review-summary-title">{label}</div>
        {!data ? (
          <div className="review-muted">후기를 모으는 중...</div>
        ) : count === 0 ? (
          <div className="review-muted">요약할 {type === 'blog' ? '블로그 후기가' : '영상이'} 없어요.</div>
        ) : text ? (
          <div className="review-summary-text">{text}</div>
        ) : (
          <div className="review-muted">✨ 요약을 만드는 중...</div>
        )}
      </div>
    );
  };

  return (
    <div className="review-overlay" onClick={onClose}>
      <div
        className="review-sheet animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-label={`${placeName} ${mode === 'summary' ? 'AI 요약' : '후기'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="review-sheet-head">
          <div className="review-sheet-title">
            <h2>{placeName}</h2>
            <span>{mode === 'summary' ? '✨ AI 후기 요약' : '💬 후기 모아보기'}</span>
          </div>
          <div className="review-sheet-actions">
            {mode === 'reviews' ? (
              <button type="button" className="cb-link-chip purple" onClick={() => onModeChange('summary')}>✨ AI 요약</button>
            ) : (
              <button type="button" className="cb-link-chip" onClick={() => onModeChange('reviews')}>💬 후기 목록</button>
            )}
            <button type="button" className="review-close" onClick={onClose} aria-label="닫기">✕</button>
          </div>
        </div>

        {mode === 'reviews' && (
          <div className="review-tabs-bar" role="tablist">
            <button role="tab" aria-selected={tab === 'youtube'} className={tab === 'youtube' ? 'active' : ''} onClick={() => setTab('youtube')}>
              ▶️ YouTube{data ? ` ${data.videos.length}` : ''}
            </button>
            <button role="tab" aria-selected={tab === 'blog'} className={tab === 'blog' ? 'active' : ''} onClick={() => setTab('blog')}>
              📝 네이버 블로그{data ? ` ${data.blogs.length}` : ''}
            </button>
          </div>
        )}

        <div className="review-body custom-scrollbar">
          {error && <div className="review-error">{error}</div>}
          {!error && !data && <div className="review-muted review-center">후기를 모으는 중...</div>}

          {data && mode === 'summary' && (
            <div className="review-summary">
              {summaryCard('blog', '📝 네이버 블로그 후기 요약')}
              {summaryCard('youtube', '▶️ 유튜브 영상 요약')}
              <p className="review-note">AI가 후기 제목과 일부 내용만 보고 만든 요약이라 실제와 다를 수 있어요.</p>
            </div>
          )}

          {data && mode === 'reviews' && tab === 'youtube' && (
            data.videos.length === 0 ? (
              <div className="review-muted review-center">관련 영상이 없어요.</div>
            ) : (
              <div className="review-list">
                {data.videos.map((vid) => (
                  <a key={vid.id} href={vid.url} target="_blank" rel="noreferrer" className="review-video">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={vid.thumbnail} alt="" loading="lazy" />
                    <div className="review-item-body">
                      <div className="review-item-title">{stripHtml(vid.title)}</div>
                      <div className="review-item-meta">{vid.channelTitle}</div>
                    </div>
                  </a>
                ))}
              </div>
            )
          )}

          {data && mode === 'reviews' && tab === 'blog' && (
            data.blogs.length === 0 ? (
              <div className="review-muted review-center">관련 블로그 글이 없어요.</div>
            ) : (
              <div className="review-list">
                {data.blogs.map((blog, i) => (
                  <a key={`${blog.link}-${i}`} href={blog.link} target="_blank" rel="noreferrer" className="review-blog">
                    <div className="review-item-title">{stripHtml(blog.title)}</div>
                    <div className="review-item-desc">{stripHtml(blog.description)}</div>
                    <div className="review-item-meta">{blog.bloggername} · {formatPostDate(blog.postdate)}</div>
                  </a>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

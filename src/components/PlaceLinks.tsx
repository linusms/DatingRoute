'use client';

import React from 'react';
import { naverSearchUrl, openNaverMap } from '@/lib/links';

interface PlaceLinksProps {
  title: string;
  /** The place's own website (Naver local search `link`) */
  homepage?: string;
  onShowReview?: () => void;
  onShowSummary?: () => void;
  className?: string;
  /** Extra controls shown in the same row */
  children?: React.ReactNode;
}

/** The same link row everywhere a place is shown: website, Naver Map (app on phones), reviews, AI summary. */
export default function PlaceLinks({ title, homepage, onShowReview, onShowSummary, className = 'place-links', children }: PlaceLinksProps) {
  const site = homepage && /^https?:\/\//i.test(homepage) ? homepage : null;
  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      {site && (
        <a href={site} target="_blank" rel="noreferrer" className="cb-link-chip blue">🌐 홈페이지</a>
      )}
      <a
        href={naverSearchUrl(title)}
        target="_blank"
        rel="noreferrer"
        className="cb-link-chip green"
        onClick={(e) => openNaverMap(e, title)}
        title="네이버 지도 앱에서 보기"
      >
        🗺️ 네이버맵
      </a>
      {onShowReview && (
        <button type="button" className="cb-link-chip" onClick={onShowReview}>💬 후기</button>
      )}
      {onShowSummary && (
        <button type="button" className="cb-link-chip purple" onClick={onShowSummary}>✨ AI 요약</button>
      )}
      {children}
    </div>
  );
}

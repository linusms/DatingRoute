import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ReviewItem, YoutubeVideo } from '@/lib/types';
import { stripHtml } from '@/lib/utils';

interface ReviewPanelProps {
  placeName: string;
  onClose: () => void;
}

export default function ReviewPanel({ placeName, onClose }: ReviewPanelProps) {
  const [activeTab, setActiveTab] = useState<'blog' | 'youtube'>('youtube');
  const [videos, setVideos] = useState<YoutubeVideo[]>([]);
  const [blogs, setBlogs] = useState<ReviewItem[]>([]);
  const [blogSummary, setBlogSummary] = useState<string | null>(null);
  const [ytSummary, setYtSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resize state
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelSize, setPanelSize] = useState({ width: 560, height: Math.round(window.innerHeight * 0.88) });
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      w: panelSize.width,
      h: panelSize.height,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizingRef.current) return;
      const dx = ev.clientX - resizeStartRef.current.x;
      const dy = ev.clientY - resizeStartRef.current.y;
      setPanelSize({
        width: Math.max(320, Math.min(window.innerWidth * 0.95, resizeStartRef.current.w + dx)),
        height: Math.max(400, Math.min(window.innerHeight * 0.98, resizeStartRef.current.h + dy)),
      });
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelSize]);

  // Top edge drag to resize height upward
  const handleTopResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      w: panelSize.width,
      h: panelSize.height,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizingRef.current) return;
      const dy = resizeStartRef.current.y - ev.clientY;
      setPanelSize(prev => ({
        ...prev,
        height: Math.max(400, Math.min(window.innerHeight * 0.98, resizeStartRef.current.h + dy)),
      }));
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelSize]);

  useEffect(() => {
    let isMounted = true;

    const fetchReviews = async () => {
      setIsLoading(true);
      setError(null);
      setBlogSummary(null);
      setYtSummary(null);

      try {
        const res = await fetch(
          `/api/reviews?place=${encodeURIComponent(placeName)}`
        );
        if (!res.ok) throw new Error('후기를 불러오는데 실패했습니다.');

        const data = await res.json();

        if (isMounted) {
          const vidItems = data.videos || [];
          setVideos(vidItems);
          const blogItems = data.blogs || [];
          setBlogs(blogItems);

          if (blogItems.length > 0) {
            fetchSummary(blogItems, 'blog');
          }
          if (vidItems.length > 0) {
            fetchSummary(vidItems, 'youtube');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    const fetchSummary = async (itemList: any[], type: 'blog' | 'youtube') => {
      try {
        const summaryRes = await fetch('/api/reviews/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemList, type, placeName }),
        });
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          if (isMounted && summaryData.summary) {
            if (type === 'blog') setBlogSummary(summaryData.summary);
            else setYtSummary(summaryData.summary);
          }
        }
      } catch (err) {
        console.error('Summary fetch failed', err);
      }
    };

    fetchReviews();

    return () => {
      isMounted = false;
    };
  }, [placeName]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div
        ref={panelRef}
        className="review-panel animate-slide-up"
        style={{
          width: `${panelSize.width}px`,
          height: `${panelSize.height}px`,
          maxWidth: '95vw',
          maxHeight: '98vh',
          background: 'rgba(26,21,32,0.97)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(244,114,182,0.3)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(244,114,182,0.1)',
        }}
      >
        {/* Top resize handle */}
        <div
          onMouseDown={handleTopResizeMouseDown}
          style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: '80px', height: '6px', cursor: 'ns-resize', zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            paddingTop: '2px',
          }}
        >
          <div style={{ width: '40px', height: '3px', borderRadius: '2px', background: 'rgba(244,114,182,0.3)' }} />
        </div>

        {/* Header */}
        <div className="review-header" style={{
          padding: '20px 20px 16px 20px',
          borderBottom: '1px solid rgba(244,114,182,0.1)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f5f0ff', marginBottom: '4px' }}>{placeName}</h2>
            <div style={{ fontSize: '13px', color: '#8b7fa8' }}>리뷰 및 후기</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Size hint */}
            <span style={{ fontSize: '11px', color: '#6b5f85' }}>
              {Math.round(panelSize.width)}×{Math.round(panelSize.height)}
            </span>
            <button onClick={onClose} style={{
              background: 'transparent', border: 'none', color: '#8b7fa8',
              fontSize: '20px', cursor: 'pointer'
            }}>
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="review-tabs" style={{ display: 'flex', borderBottom: '1px solid rgba(244,114,182,0.1)', flexShrink: 0 }}>
          <button
            style={{
              flex: 1, padding: '12px', background: 'transparent', border: 'none',
              color: activeTab === 'youtube' ? '#f472b6' : '#8b7fa8',
              borderBottom: activeTab === 'youtube' ? '2px solid #f472b6' : '2px solid transparent',
              fontWeight: activeTab === 'youtube' ? 600 : 400, cursor: 'pointer'
            }}
            onClick={() => setActiveTab('youtube')}
          >
            ▶️ YouTube
          </button>
          <button
            style={{
              flex: 1, padding: '12px', background: 'transparent', border: 'none',
              color: activeTab === 'blog' ? '#f472b6' : '#8b7fa8',
              borderBottom: activeTab === 'blog' ? '2px solid #f472b6' : '2px solid transparent',
              fontWeight: activeTab === 'blog' ? 600 : 400, cursor: 'pointer'
            }}
            onClick={() => setActiveTab('blog')}
          >
            📝 네이버 블로그
          </button>
        </div>

        {/* Content */}
        <div className="review-content custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {isLoading && <div style={{ color: '#8b7fa8', textAlign: 'center', padding: '40px' }}>불러오는 중...</div>}
          {error && <div style={{ color: '#ef4444', textAlign: 'center', padding: '40px' }}>{error}</div>}

          {!isLoading && !error && activeTab === 'youtube' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {videos.length === 0 ? (
                <div style={{ color: '#8b7fa8', textAlign: 'center', padding: '40px' }}>관련 영상이 없습니다.</div>
              ) : (
                <>
                  <div className="ai-recommendation animate-fade-in" style={{
                    background: 'rgba(244,114,182,0.1)',
                    border: '1px solid rgba(244,114,182,0.3)',
                    borderRadius: '12px',
                    padding: '16px',
                    fontSize: '14px',
                    color: '#f5f0ff',
                    lineHeight: 1.6,
                  }}>
                    <strong style={{ color: '#f472b6', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '15px' }}>
                      <span>✨</span> Gemini 유튜브 핵심 요약
                    </strong>
                    {ytSummary ? (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{ytSummary}</div>
                    ) : (
                      <div style={{ color: '#8b7fa8' }}>요약을 생성하는 중입니다...</div>
                    )}
                  </div>
                  <h4 style={{ color: '#8b7fa8', marginTop: '8px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>참고한 영상 목록</h4>
                  {videos.map((vid) => (
                  <a key={vid.id} href={vid.url} target="_blank" rel="noreferrer" style={{
                    display: 'flex', gap: '12px', textDecoration: 'none', background: 'rgba(255,255,255,0.03)',
                    padding: '12px', borderRadius: '12px', border: '1px solid rgba(244,114,182,0.1)'
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={vid.thumbnail} alt={vid.title} style={{ width: '140px', height: '79px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: '14px', color: '#f5f0ff', fontWeight: 500, marginBottom: '6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{stripHtml(vid.title)}</div>
                      <div style={{ fontSize: '12px', color: '#8b7fa8' }}>{vid.channelTitle}</div>
                    </div>
                  </a>
                ))}
              </>
              )}
            </div>
          )}

          {!isLoading && !error && activeTab === 'blog' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {blogs.length === 0 ? (
                <div style={{ color: '#8b7fa8', textAlign: 'center', padding: '40px' }}>관련 블로그가 없습니다.</div>
              ) : (
                <>
                  <div className="ai-recommendation animate-fade-in" style={{
                    background: 'rgba(244,114,182,0.1)',
                    border: '1px solid rgba(244,114,182,0.3)',
                    borderRadius: '12px',
                    padding: '16px',
                    fontSize: '14px',
                    color: '#f5f0ff',
                    lineHeight: 1.6,
                  }}>
                    <strong style={{ color: '#f472b6', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '15px' }}>
                      <span>✨</span> Gemini 블로그 핵심 요약
                    </strong>
                    {blogSummary ? (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{blogSummary}</div>
                    ) : (
                      <div style={{ color: '#8b7fa8' }}>요약을 생성하는 중입니다...</div>
                    )}
                  </div>

                  <h4 style={{ color: '#8b7fa8', marginTop: '8px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>참고한 블로그 목록</h4>
                  {blogs.map((blog, i) => (
                    <a key={i} href={blog.link} target="_blank" rel="noreferrer" style={{
                      display: 'block', textDecoration: 'none', background: 'rgba(255,255,255,0.03)',
                      padding: '16px', borderRadius: '12px', border: '1px solid rgba(244,114,182,0.1)'
                    }}>
                      <div style={{ fontSize: '14px', color: '#f5f0ff', fontWeight: 600, marginBottom: '8px' }}>
                        {stripHtml(blog.title)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#8b7fa8', lineHeight: 1.5, marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {stripHtml(blog.description)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#f472b6' }}>{blog.postdate}</div>
                    </a>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Bottom-right resize handle */}
        <div
          onMouseDown={handleResizeMouseDown}
          style={{
            position: 'absolute', right: 0, bottom: 0,
            width: '24px', height: '24px', cursor: 'nwse-resize',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
            padding: '4px',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M11 1L1 11M11 6L6 11M11 11L11 11" stroke="rgba(244,114,182,0.5)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

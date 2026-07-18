import React, { useEffect, useState } from 'react';
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchReviews = async () => {
      setIsLoading(true);
      setError(null);
      setBlogSummary(null);

      try {
        const res = await fetch(
          `/api/reviews?place=${encodeURIComponent(placeName)}`
        );
        if (!res.ok) throw new Error('후기를 불러오는데 실패했습니다.');

        const data = await res.json();
        
        if (isMounted) {
          setVideos(data.videos || []);
          const blogItems = data.blogs || [];
          setBlogs(blogItems);

          if (blogItems.length > 0) {
            fetchSummary(blogItems);
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

    const fetchSummary = async (blogList: ReviewItem[]) => {
      try {
        const summaryRes = await fetch('/api/reviews/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blogs: blogList, placeName }),
        });
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          if (isMounted && summaryData.summary) {
            setBlogSummary(summaryData.summary);
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
      <div className="review-panel animate-slide-up" style={{
        width: '90%', maxWidth: '500px', height: '80vh',
        background: 'rgba(26,21,32,0.95)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(244,114,182,0.3)', borderRadius: '16px',
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
      <div className="review-header" style={{
        padding: '20px', borderBottom: '1px solid rgba(244,114,182,0.1)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
      }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f5f0ff', marginBottom: '4px' }}>{placeName}</h2>
          <div style={{ fontSize: '13px', color: '#8b7fa8' }}>리뷰 및 후기</div>
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none', color: '#8b7fa8',
          fontSize: '20px', cursor: 'pointer'
        }}>
          ✕
        </button>
      </div>

      <div className="review-tabs" style={{ display: 'flex', borderBottom: '1px solid rgba(244,114,182,0.1)' }}>
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

      <div className="review-content custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {isLoading && <div style={{ color: '#8b7fa8', textAlign: 'center', padding: '40px' }}>불러오는 중...</div>}
        {error && <div style={{ color: '#ef4444', textAlign: 'center', padding: '40px' }}>{error}</div>}

        {!isLoading && !error && activeTab === 'youtube' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {videos.length === 0 ? (
              <div style={{ color: '#8b7fa8', textAlign: 'center', padding: '40px' }}>관련 영상이 없습니다.</div>
            ) : (
              videos.map((vid) => (
                <a key={vid.id} href={vid.url} target="_blank" rel="noreferrer" style={{
                  display: 'flex', gap: '12px', textDecoration: 'none', background: 'rgba(255,255,255,0.03)',
                  padding: '12px', borderRadius: '12px', border: '1px solid rgba(244,114,182,0.1)'
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={vid.thumbnail} alt={vid.title} style={{ width: '120px', height: '68px', objectFit: 'cover', borderRadius: '8px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: '13px', color: '#f5f0ff', fontWeight: 500, marginBottom: '6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{stripHtml(vid.title)}</div>
                    <div style={{ fontSize: '11px', color: '#8b7fa8' }}>{vid.channelTitle}</div>
                  </div>
                </a>
              ))
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
                    <div>{blogSummary}</div>
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
                    <div style={{ fontSize: '12px', color: '#8b7fa8', lineHeight: 1.5, marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
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
      </div>
    </div>
  );
}

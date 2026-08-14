'use client';

import React, { useState, useEffect } from 'react';

interface PlaceThumbnailProps {
  query: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function PlaceThumbnail({ query, className, style }: PlaceThumbnailProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const fallbackImg = 'https://placehold.co/150x150/2a2a35/a3a3b2?text=No+Photo';

  useEffect(() => {
    let isMounted = true;
    
    if (!query) {
      setIsLoading(false);
      return;
    }

    const fetchImage = async () => {
      try {
        const res = await fetch(`/api/place-image?query=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.imageUrl) {
            setImageUrl(data.imageUrl);
          }
        }
      } catch (error) {
        console.error('Failed to fetch place image:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchImage();

    return () => {
      isMounted = false;
    };
  }, [query]);

  if (isLoading) {
    return (
      <div 
        className={className} 
        style={{ 
          backgroundColor: 'var(--color-bg-secondary)', 
          animation: 'pulse 1.5s infinite ease-in-out',
          ...style 
        }} 
      />
    );
  }

  if (!imageUrl) {
    return (
      <div 
        className={className} 
        style={{ 
          backgroundColor: 'var(--color-bg-secondary)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'var(--color-text-secondary)',
          fontSize: '10px',
          ...style 
        }}
      >
        <img 
          src={fallbackImg} 
          alt="No Image Available"
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
        />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img 
      src={imgError ? fallbackImg : imageUrl} 
      alt={query}
      className={className}
      style={{ objectFit: 'cover', ...style }}
      onError={() => setImgError(true)}
    />
  );
}

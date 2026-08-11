import { useState, useRef, useCallback } from 'react';

type ResizeMode = 'pixel' | 'percentage';
type Direction = 'horizontal' | 'vertical' | 'both';

interface UseResizableOptions {
  mode: ResizeMode;
  direction?: Direction;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  containerRef?: React.RefObject<HTMLElement | null>;
}

export function useResizable({
  mode,
  direction = 'both',
  initialWidth = 360,
  initialHeight = 400,
  minWidth = 0,
  maxWidth = Infinity,
  minHeight = 0,
  maxHeight = Infinity,
  containerRef,
}: UseResizableOptions) {
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if ('stopPropagation' in e) e.stopPropagation();
    isResizingRef.current = true;
    setIsResizing(true);

    let clientX = 0, clientY = 0;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    resizeStartRef.current = { x: clientX, y: clientY, w: size.width, h: size.height };
    
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : direction === 'vertical' ? 'row-resize' : 'nwse-resize';
    document.body.style.userSelect = 'none';

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      if (!isResizingRef.current) return;
      
      let curX = 0, curY = 0;
      if ('touches' in ev) {
        curX = ev.touches[0].clientX;
        curY = ev.touches[0].clientY;
      } else {
        curX = (ev as MouseEvent).clientX;
        curY = (ev as MouseEvent).clientY;
      }

      if (mode === 'percentage' && containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (direction === 'horizontal' || direction === 'both') {
          const offsetX = curX - rect.left;
          const percentX = (offsetX / rect.width) * 100;
          setSize(s => ({ ...s, width: Math.max(minWidth, Math.min(maxWidth, percentX)) }));
        }
        if (direction === 'vertical' || direction === 'both') {
          const offsetY = curY - rect.top;
          const percentY = (offsetY / rect.height) * 100;
          setSize(s => ({ ...s, height: Math.max(minHeight, Math.min(maxHeight, percentY)) }));
        }
      } else {
        const dx = curX - resizeStartRef.current.x;
        const dy = curY - resizeStartRef.current.y;
        
        const computedMaxW = maxWidth === Infinity ? (typeof window !== 'undefined' ? window.innerWidth * 0.95 : Infinity) : maxWidth;
        const computedMaxH = maxHeight === Infinity ? (typeof window !== 'undefined' ? window.innerHeight * 0.98 : Infinity) : maxHeight;

        setSize(s => ({
          width: direction === 'horizontal' || direction === 'both' ? Math.max(minWidth, Math.min(computedMaxW, resizeStartRef.current.w + dx)) : s.width,
          height: direction === 'vertical' || direction === 'both' ? Math.max(minHeight, Math.min(computedMaxH, resizeStartRef.current.h + dy)) : s.height,
        }));
      }
    };

    const handleEnd = () => {
      isResizingRef.current = false;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
  }, [size.width, size.height, mode, direction, minWidth, maxWidth, minHeight, maxHeight, containerRef]);

  return { size, setSize, handleResizeStart, isMobile, isResizing };
}

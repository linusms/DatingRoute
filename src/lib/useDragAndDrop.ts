import { useState, useRef, useCallback } from 'react';

export function useDragAndDrop<T>(initialList: T[]) {
  const [list, setList] = useState<T[]>(initialList);
  const dragItemIdx = useRef<number | null>(null);
  const dragOverItemIdx = useRef<number | null>(null);

  // Update list safely from outside
  const updateList = useCallback((newList: T[]) => {
    setList(newList);
  }, []);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragItemIdx.current = index;
    // Set dataTransfer for Firefox compatibility
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    
    // Optional: make it slightly transparent while dragging
    setTimeout(() => {
      const target = e.target as HTMLElement;
      target.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragItemIdx.current !== null && dragItemIdx.current !== index) {
      dragOverItemIdx.current = index;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, onReorder?: (newList: T[]) => void) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    target.style.opacity = '1';

    if (dragItemIdx.current !== null && dragOverItemIdx.current !== null) {
      const copyList = [...list];
      const draggedItemContent = copyList[dragItemIdx.current];

      copyList.splice(dragItemIdx.current, 1);
      copyList.splice(dragOverItemIdx.current, 0, draggedItemContent);

      setList(copyList);
      if (onReorder) {
        onReorder(copyList);
      }
    }
    dragItemIdx.current = null;
    dragOverItemIdx.current = null;
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
    dragItemIdx.current = null;
    dragOverItemIdx.current = null;
  };

  return {
    list,
    updateList,
    handleDragStart,
    handleDragEnter,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  };
}

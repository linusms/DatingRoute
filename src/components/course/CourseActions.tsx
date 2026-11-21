'use client';

import { useEffect, useRef, useState } from 'react';

interface MenuItem {
  key: string;
  label: string;
  danger?: boolean;
  onSelect: () => void;
}

interface CourseActionsProps {
  isRouteCreated: boolean;
  canCreateRoute: boolean;
  onCreateRoute: () => void;
  menuItems: MenuItem[];
}

/** "경로 생성" button plus an overflow menu for secondary actions. */
export default function CourseActions({ isRouteCreated, canCreateRoute, onCreateRoute, menuItems }: CourseActionsProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="cb-actions">
      <button className="btn btn-primary cb-actions-main" onClick={onCreateRoute} disabled={!canCreateRoute && !isRouteCreated}>
        {isRouteCreated ? '🔄 다시 생성' : '✨ 경로 생성'}
      </button>
      {menuItems.length > 0 && (
        <div className="cb-menu" ref={menuRef}>
          <button className="cb-menu-trigger" onClick={() => setOpen((v) => !v)} title="추가 기능" aria-haspopup="menu" aria-expanded={open}>
            ⋯
          </button>
          {open && (
            <div className="cb-menu-list" role="menu">
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  role="menuitem"
                  className={`cb-menu-item ${item.danger ? 'danger' : ''}`}
                  onClick={() => { item.onSelect(); setOpen(false); }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

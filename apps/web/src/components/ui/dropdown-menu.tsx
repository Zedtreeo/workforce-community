'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MoreHorizontal } from 'lucide-react';

// ────────────────────────────────────────────────────────
//  Types
// ────────────────────────────────────────────────────────

export interface DropdownMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

export interface DropdownMenuDivider {
  type: 'divider';
}

export type DropdownMenuEntry = DropdownMenuItem | DropdownMenuDivider;

interface DropdownMenuProps {
  items: DropdownMenuEntry[];
  /** Custom trigger element — defaults to MoreHorizontal icon */
  trigger?: React.ReactNode;
  /** Alignment relative to trigger */
  align?: 'left' | 'right';
}

function isDivider(entry: DropdownMenuEntry): entry is DropdownMenuDivider {
  return 'type' in entry && entry.type === 'divider';
}

// ────────────────────────────────────────────────────────
//  DropdownMenu
// ────────────────────────────────────────────────────────

export function DropdownMenu({ items, trigger, align = 'right' }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    },
    [],
  );

  return (
    <div ref={containerRef} className="relative inline-block" onKeyDown={handleKeyDown}>
      {/* Trigger */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="h-8 w-8 flex items-center justify-center rounded-lg text-content-tertiary hover:text-content-primary hover:bg-surface-100 transition-colors"
        aria-label="Actions"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {trigger || <MoreHorizontal size={16} />}
      </button>

      {/* Menu */}
      {open && (
        <div
          className={`absolute z-50 mt-1 min-w-[160px] rounded-lg border border-surface-200 bg-white shadow-lg py-1 animate-in fade-in slide-in-from-top-1 duration-100 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          role="menu"
        >
          {items.map((entry, i) => {
            if (isDivider(entry)) {
              return <div key={`div-${i}`} className="my-1 h-px bg-surface-200" role="separator" />;
            }

            const item = entry as DropdownMenuItem;
            const isDanger = item.variant === 'danger';

            return (
              <button
                key={`item-${i}`}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.onClick();
                }}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${isDanger
                    ? 'text-danger hover:bg-danger/5'
                    : 'text-content-primary hover:bg-surface-50'
                  }
                `.trim()}
              >
                {item.icon && (
                  <span className={`shrink-0 [&>svg]:h-4 [&>svg]:w-4 ${isDanger ? 'text-danger' : 'text-content-tertiary'}`}>
                    {item.icon}
                  </span>
                )}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

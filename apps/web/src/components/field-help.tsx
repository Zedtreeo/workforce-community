'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { HelpCircle, X, ExternalLink } from 'lucide-react';
import { useSession } from '../lib/auth-client';
import { apiFetch } from '../lib/api';

interface HelpData {
  title: string;
  description: string;
  example: string | null;
  validationRule: string | null;
  learnMoreUrl: string | null;
}

// In-memory cache so we don't re-fetch the same tooltip within a session
const helpCache = new Map<string, HelpData | null>();

interface FieldHelpProps {
  /** e.g. "employee.salary" */
  helpKey: string;
  /** Optional: override position. Default 'right' */
  position?: 'top' | 'right' | 'bottom' | 'left';
  /** Optional: size of icon */
  size?: number;
}

export function FieldHelp({ helpKey, position = 'right', size = 14 }: FieldHelpProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState<HelpData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const token = session?.session?.token;

  const loadHelp = useCallback(async () => {
    if (!token || loaded) return;
    setLoaded(true);

    // Check cache first
    if (helpCache.has(helpKey)) {
      setHelp(helpCache.get(helpKey) || null);
      return;
    }

    try {
      const data = await apiFetch<HelpData>(`/kb/help/key/${helpKey}`, { token });
      helpCache.set(helpKey, data);
      setHelp(data);
    } catch {
      helpCache.set(helpKey, null);
    }
  }, [token, helpKey, loaded]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggle = () => {
    if (!open) loadHelp();
    setOpen(!open);
  };

  // Position classes for the tooltip popover
  const positionClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  };

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={handleToggle}
        className="text-content-tertiary hover:text-brand-600 transition-colors focus:outline-none"
        title="Help"
      >
        <HelpCircle size={size} />
      </button>

      {open && (
        <div
          className={`absolute z-50 w-72 bg-white border border-surface-200 rounded-lg shadow-lg p-3 ${positionClasses[position]}`}
        >
          {help ? (
            <div>
              <div className="flex items-start justify-between mb-1.5">
                <h4 className="text-sm font-semibold text-content-primary">{help.title}</h4>
                <button
                  onClick={() => setOpen(false)}
                  className="text-content-tertiary hover:text-content-secondary"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="text-xs text-content-secondary leading-relaxed">{help.description}</p>

              {help.example && (
                <div className="mt-2 px-2 py-1.5 bg-surface-50 rounded-md">
                  <p className="text-[10px] uppercase tracking-wider text-content-tertiary font-medium mb-0.5">Example</p>
                  <p className="text-xs text-brand-700 font-mono">{help.example}</p>
                </div>
              )}

              {help.validationRule && (
                <p className="text-[10px] text-content-tertiary mt-2 italic">{help.validationRule}</p>
              )}

              {help.learnMoreUrl && (
                <a
                  href={help.learnMoreUrl}
                  className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 mt-2"
                >
                  Learn more <ExternalLink size={10} />
                </a>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs text-content-tertiary">No help available for this field.</p>
              <button onClick={() => setOpen(false)} className="text-content-tertiary hover:text-content-secondary">
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

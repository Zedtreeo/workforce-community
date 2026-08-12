'use client';

import { createContext, useContext, useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

const typeStyles: Record<ToastType, { bg: string; icon: string; border: string }> = {
  success: { bg: 'bg-success-light', icon: '✓', border: 'border-success/20' },
  error: { bg: 'bg-danger-light', icon: '✕', border: 'border-danger/20' },
  info: { bg: 'bg-info-light', icon: 'ℹ', border: 'border-info/20' },
  warning: { bg: 'bg-warning-light', icon: '⚠', border: 'border-warning/20' },
};

const typeTextStyles: Record<ToastType, string> = {
  success: 'text-success-dark',
  error: 'text-danger-dark',
  info: 'text-info-dark',
  warning: 'text-warning-dark',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message, duration }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const style = typeStyles[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto animate-slide-up flex items-center gap-3 px-4 py-3 rounded-lg border shadow-md ${style.bg} ${style.border} min-w-[300px] max-w-md`}
            >
              <span className={`text-sm font-bold ${typeTextStyles[t.type]}`}>{style.icon}</span>
              <p className={`text-sm font-medium flex-1 ${typeTextStyles[t.type]}`}>{t.message}</p>
              <button onClick={() => dismiss(t.id)} className={`text-xs opacity-60 hover:opacity-100 ${typeTextStyles[t.type]}`}>✕</button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

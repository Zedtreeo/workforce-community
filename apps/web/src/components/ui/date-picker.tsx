import { forwardRef, InputHTMLAttributes } from 'react';
import { Calendar } from 'lucide-react';

// ────────────────────────────────────────────────────────
//  DatePicker — styled native date input
// ────────────────────────────────────────────────────────

interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  hint?: string;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-content-primary">
            {label}
          </label>
        )}
        <div className="relative">
          <Calendar
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none"
          />
          <input
            ref={ref}
            id={inputId}
            type="date"
            className={`
              w-full h-9 rounded-lg border bg-white pl-9 pr-3 text-sm text-content-primary
              transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
              disabled:bg-surface-100 disabled:cursor-not-allowed disabled:text-content-tertiary
              ${error ? 'border-danger focus:ring-danger' : 'border-surface-200 hover:border-surface-300'}
              ${className}
            `.trim()}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        {hint && !error && <p className="text-xs text-content-tertiary">{hint}</p>}
      </div>
    );
  },
);

DatePicker.displayName = 'DatePicker';

// ────────────────────────────────────────────────────────
//  DateRangePicker — two date inputs side by side
// ────────────────────────────────────────────────────────

interface DateRangePickerProps {
  label?: string;
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  startPlaceholder?: string;
  endPlaceholder?: string;
  error?: string;
  disabled?: boolean;
}

export function DateRangePicker({
  label,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  error,
  disabled,
}: DateRangePickerProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-content-primary">{label}</label>
      )}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Calendar
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none"
          />
          <input
            type="date"
            value={startValue}
            onChange={(e) => onStartChange(e.target.value)}
            max={endValue || undefined}
            disabled={disabled}
            className={`
              w-full h-9 rounded-lg border bg-white pl-9 pr-3 text-sm text-content-primary
              transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
              disabled:bg-surface-100 disabled:cursor-not-allowed disabled:text-content-tertiary
              ${error ? 'border-danger focus:ring-danger' : 'border-surface-200 hover:border-surface-300'}
            `.trim()}
          />
        </div>
        <span className="text-xs text-content-tertiary shrink-0">to</span>
        <div className="relative flex-1">
          <Calendar
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary pointer-events-none"
          />
          <input
            type="date"
            value={endValue}
            onChange={(e) => onEndChange(e.target.value)}
            min={startValue || undefined}
            disabled={disabled}
            className={`
              w-full h-9 rounded-lg border bg-white pl-9 pr-3 text-sm text-content-primary
              transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
              disabled:bg-surface-100 disabled:cursor-not-allowed disabled:text-content-tertiary
              ${error ? 'border-danger focus:ring-danger' : 'border-surface-200 hover:border-surface-300'}
            `.trim()}
          />
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

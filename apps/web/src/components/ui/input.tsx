import { forwardRef, InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-content-primary">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary [&>svg]:h-4 [&>svg]:w-4">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full h-9 rounded-lg border bg-white px-3 text-sm text-content-primary
              placeholder:text-content-tertiary
              transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
              disabled:bg-surface-100 disabled:cursor-not-allowed disabled:text-content-tertiary
              ${icon ? 'pl-9' : ''}
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
  }
);

Input.displayName = 'Input';

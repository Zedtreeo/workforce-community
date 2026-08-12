import { ReactNode } from 'react';

// ────────────────────────────────────────────────────────
//  FormField — standardized label + input + error wrapper
// ────────────────────────────────────────────────────────

interface FormFieldProps {
  /** Field label */
  label: string;
  /** Unique id for the field — passed to htmlFor */
  htmlFor?: string;
  /** Show required asterisk */
  required?: boolean;
  /** Error message */
  error?: string;
  /** Hint text (shown when no error) */
  hint?: string;
  /** The input / select / custom control */
  children: ReactNode;
  /** Additional className for the outer wrapper */
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className = '',
}: FormFieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-content-primary"
      >
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-content-tertiary">{hint}</p>}
    </div>
  );
}

// ────────────────────────────────────────────────────────
//  FormSection — groups related fields with a heading
// ────────────────────────────────────────────────────────

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Grid columns for the field layout */
  columns?: 1 | 2 | 3;
}

export function FormSection({
  title,
  description,
  children,
  columns = 2,
}: FormSectionProps) {
  const gridCls =
    columns === 1
      ? 'grid grid-cols-1 gap-4'
      : columns === 3
        ? 'grid grid-cols-1 md:grid-cols-3 gap-4'
        : 'grid grid-cols-1 md:grid-cols-2 gap-4';

  return (
    <section>
      <h3 className="text-sm font-semibold text-content-primary mb-1 uppercase tracking-wider">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-content-tertiary mb-4">{description}</p>
      )}
      {!description && <div className="mb-4" />}
      <div className={gridCls}>{children}</div>
    </section>
  );
}

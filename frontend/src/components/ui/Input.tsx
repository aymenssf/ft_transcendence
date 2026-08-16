import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  icon?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, icon, trailing, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="w-full">
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-content-secondary"
        >
          {label}
        </label>
      ) : null}

      <div className="relative">
        {icon ? (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-muted"
          >
            {icon}
          </span>
        ) : null}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-10 w-full rounded-xl border bg-bg-secondary px-3 text-sm text-content-primary',
            'placeholder:text-content-muted',
            'transition-colors duration-hover ease-out',
            'focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30',
            'disabled:cursor-not-allowed disabled:opacity-50',
            icon && 'pl-9',
            trailing && 'pr-10',
            error ? 'border-accent-red' : 'border-border',
            className,
          )}
          {...rest}
        />

        {trailing ? (
          <span className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</span>
        ) : null}
      </div>

      {error ? (
        <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-xs text-accent-red">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-content-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

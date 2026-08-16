import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-hero text-[#06060c] font-bold hover:shadow-glow-violet hover:-translate-y-px active:translate-y-0',
  secondary:
    'bg-bg-elevated text-content-primary border border-border-accent hover:border-accent-primary hover:bg-[#20203a]',
  ghost:
    'bg-transparent text-content-secondary border border-transparent hover:bg-bg-elevated hover:text-content-primary',
  danger:
    'bg-transparent text-accent-red border border-accent-red/40 hover:bg-accent-red/10 hover:border-accent-red hover:shadow-glow-red',
  success:
    'bg-accent-green/10 text-accent-green border border-accent-green/40 hover:bg-accent-green/20 hover:border-accent-green hover:shadow-glow-green',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    fullWidth = false,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-heading',
        'transition-all duration-hover ease-out',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
});

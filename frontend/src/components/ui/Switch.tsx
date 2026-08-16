import { useId } from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';
import { cn } from '@/lib/cn';

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  className,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();

  return (
    <div className={cn('flex items-start justify-between gap-6', className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="font-heading text-sm font-bold text-content-primary">
          {label}
        </label>
        {description ? (
          <p className="mt-1 text-sm text-content-secondary">{description}</p>
        ) : null}
      </div>

      <RadixSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-hover ease-out',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked
            ? 'border-accent-primary bg-accent-primary shadow-glow-violet'
            : 'border-border-accent bg-bg-elevated',
        )}
      >
        <RadixSwitch.Thumb
          className={cn(
            'block h-4 w-4 translate-x-1 rounded-full bg-content-primary',
            'transition-transform duration-hover ease-out will-change-transform',
            'data-[state=checked]:translate-x-6',
          )}
        />
      </RadixSwitch.Root>
    </div>
  );
}

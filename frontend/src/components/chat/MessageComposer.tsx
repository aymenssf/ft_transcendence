import { useRef, useState, type FormEvent } from 'react';
import { Send, Smile } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/cn';

const EMOJI = ['🎮', '🔥', '😂', '👍', '🏆', '😅', '💀', '🎯', '⚡', '😎', '🙌', '😭'] as const;

export function MessageComposer({
  onSend,
  disabled = false,
}: {
  onSend: (content: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const trimmed = value.trim();
    if (trimmed === '' || disabled) return;
    onSend(trimmed);
    setValue('');
  };

  const appendEmoji = (emoji: string): void => {
    setValue((current) => current + emoji);
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={submit} className="flex items-center gap-2 border-t border-border p-3">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Insert emoji"
            className={cn(
              'rounded-lg p-2 text-content-secondary transition-colors duration-hover',
              'hover:bg-bg-elevated hover:text-content-primary disabled:opacity-40',
            )}
          >
            <Smile aria-hidden className="h-4 w-4" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="top"
            align="start"
            sideOffset={8}
            className="z-50 grid grid-cols-6 gap-1 rounded-xl border border-border-accent bg-bg-card p-2 shadow-card"
          >
            {EMOJI.map((emoji) => (
              <DropdownMenu.Item
                key={emoji}
                onSelect={() => appendEmoji(emoji)}
                className="cursor-pointer rounded-md p-1.5 text-center text-lg outline-none transition-colors data-[highlighted]:bg-bg-elevated"
              >
                {emoji}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
        aria-label="Message"
        placeholder={disabled ? 'You have blocked this user' : 'Write a message…'}
        className={cn(
          'h-10 min-w-0 flex-1 rounded-xl border border-border bg-bg-secondary px-3.5 text-sm',
          'text-content-primary placeholder:text-content-muted',
          'transition-colors duration-hover focus:border-accent-primary focus:outline-none',
          'focus:ring-2 focus:ring-accent-primary/30 disabled:opacity-50',
        )}
      />

      <button
        type="submit"
        disabled={disabled || value.trim() === ''}
        aria-label="Send message"
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-hero text-[#06060c]',
          'transition-all duration-hover ease-out hover:shadow-glow-violet',
          'disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <Send aria-hidden className="h-4 w-4" />
      </button>
    </form>
  );
}

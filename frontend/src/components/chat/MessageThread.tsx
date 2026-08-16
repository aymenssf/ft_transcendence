import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/States';
import type { ChatMessage } from '@/types';

export function MessageThread({
  messages,
  meId,
}: {
  messages: readonly ChatMessage[];
  meId: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex-1">
        <EmptyState title="No messages yet" description="Say hello to get things started." />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
      {messages.map((message, index) => {
        const isMine = message.senderId === meId;
        const previous = messages[index - 1];
        const grouped = previous?.senderId === message.senderId;

        if (message.type === 'system') {
          return (
            <p key={String(message.id)} className="py-1 text-center text-xs text-content-muted">
              {message.content}
            </p>
          );
        }

        return (
          <div
            key={String(message.id)}
            className={cn('flex items-end gap-2', isMine ? 'flex-row-reverse' : 'flex-row')}
          >
            <div className="w-7 shrink-0">
              {!grouped && !isMine ? (
                <Avatar src={message.senderAvatar} name={message.senderName} size="xs" />
              ) : null}
            </div>

            <div
              className={cn(
                'max-w-[min(68%,32rem)] rounded-2xl px-3.5 py-2',
                isMine
                  ? 'rounded-br-sm bg-accent-primary/18 text-content-primary'
                  : 'rounded-bl-sm bg-bg-elevated text-content-primary',
              )}
            >
              {!grouped && !isMine ? (
                <p className="mb-0.5 font-heading text-xs font-bold text-accent-cyan">
                  {message.senderName}
                </p>
              ) : null}

              <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>

              <time
                dateTime={message.timestamp}
                className={cn(
                  'mt-1 block font-mono text-[10px] text-content-muted',
                  isMine ? 'text-right' : 'text-left',
                )}
              >
                {formatTime(message.timestamp)}
              </time>
            </div>
          </div>
        );
      })}
    </div>
  );
}

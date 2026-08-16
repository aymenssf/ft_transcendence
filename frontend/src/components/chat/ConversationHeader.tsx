import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Ban, MoreVertical, ShieldCheck, Swords } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { usePresenceStore } from '@/stores/presence.store';
import { sendFriendInvite } from '../../friend_invite_handler.js';
import { toast } from '@/stores/ui.store';
import type { Conversation, User } from '@/types';

export function ConversationHeader({
  conversation,
  blocked,
  onToggleBlock,
}: {
  conversation: Conversation;
  blocked: boolean;
  onToggleBlock: (peer: User, block: boolean) => void;
}) {
  const peer = conversation.peer;
  const name = peer?.username ?? conversation.room.name ?? 'Conversation';
  // Group rooms (peer === null) have no single presence to show.
  const status = usePresenceStore((state) =>
    peer ? (state.statuses[peer.id] ?? peer.status ?? 'offline') : undefined,
  );

  const challenge = (): void => {
    if (!peer) return;
    sendFriendInvite(String(peer.id));
    toast.info('Challenge sent', `Waiting for ${peer.username} to respond.`);
  };

  return (
    <header className="flex items-center gap-3 border-b border-border px-5 py-3.5">
      <Avatar src={peer?.avatar} name={name} size="sm" status={status} />

      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-sm font-bold text-content-primary">{name}</p>
        <p className="text-xs text-content-secondary">
          {blocked ? 'Blocked' : peer ? (status === 'online' ? 'Online' : 'Offline') : 'Group'}
        </p>
      </div>

      {blocked ? <Badge tone="red">Blocked</Badge> : null}

      {peer ? (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label={`Conversation options for ${name}`}
              className="rounded-lg p-2 text-content-secondary transition-colors duration-hover hover:bg-bg-elevated hover:text-content-primary"
            >
              <MoreVertical aria-hidden className="h-4 w-4" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 w-48 rounded-xl border border-border-accent bg-bg-card p-1 shadow-card"
            >
              <DropdownMenu.Item
                onSelect={challenge}
                disabled={blocked}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none',
                  'text-content-secondary transition-colors',
                  'data-[highlighted]:bg-bg-elevated data-[highlighted]:text-content-primary',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
                )}
              >
                <Swords aria-hidden className="h-4 w-4" />
                Challenge
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="my-1 h-px bg-border" />

              <DropdownMenu.Item
                onSelect={() => onToggleBlock(peer, !blocked)}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none',
                  'transition-colors',
                  blocked
                    ? 'text-content-secondary data-[highlighted]:bg-accent-green/10 data-[highlighted]:text-accent-green'
                    : 'text-content-secondary data-[highlighted]:bg-accent-red/10 data-[highlighted]:text-accent-red',
                )}
              >
                {blocked ? (
                  <>
                    <ShieldCheck aria-hidden className="h-4 w-4" />
                    Unblock
                  </>
                ) : (
                  <>
                    <Ban aria-hidden className="h-4 w-4" />
                    Block user
                  </>
                )}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ) : null}
    </header>
  );
}

import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { truncate } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { usePresenceStore } from '@/stores/presence.store';
import type { Conversation, User } from '@/types';

export function ConversationList({
  conversations,
  activeRoomId,
  onSelect,
  friends,
  onStartConversation,
  blockedIds,
}: {
  conversations: readonly Conversation[];
  activeRoomId: number | null;
  onSelect: (roomId: number) => void;
  friends: readonly User[];
  onStartConversation: (friend: User) => void;
  blockedIds: ReadonlySet<number>;
  onToggleBlock: (peer: User, block: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const statuses = usePresenceStore((state) => state.statuses);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return conversations;
    return conversations.filter((conversation) =>
      (conversation.peer?.username ?? conversation.room.name ?? '')
        .toLowerCase()
        .includes(needle),
    );
  }, [conversations, query]);

  const availableFriends = friends.filter((friend) => !blockedIds.has(friend.id));

  return (
    <>
      <div className="space-y-3 border-b border-border p-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search conversations"
          aria-label="Search conversations"
          icon={<Search aria-hidden className="h-3.5 w-3.5" />}
        />
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          onClick={() => setPickerOpen(true)}
          icon={<Plus aria-hidden className="h-3.5 w-3.5" />}
        >
          New conversation
        </Button>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <EmptyState
            title={query ? 'No matches' : 'No conversations'}
            description={query ? 'Try a different name.' : 'Start one with a friend.'}
          />
        ) : (
          filtered.map((conversation) => {
            const peer = conversation.peer;
            const name = peer?.username ?? conversation.room.name ?? 'Unknown';
            // Group rooms (peer === null) have no single presence to show.
            const status = peer ? (statuses[peer.id] ?? peer.status ?? 'offline') : undefined;
            const isActive = conversation.room.id === activeRoomId;

            return (
              <li key={conversation.room.id}>
                <button
                  type="button"
                  onClick={() => onSelect(conversation.room.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 border-l-2 px-3 py-3 text-left',
                    'transition-colors duration-hover ease-out',
                    isActive
                      ? 'border-accent-primary bg-accent-primary/8'
                      : 'border-transparent hover:bg-bg-elevated',
                  )}
                >
                  <Avatar src={peer?.avatar} name={name} size="sm" status={status} />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-content-primary">{name}</p>
                    <p className="truncate text-xs text-content-secondary">
                      {conversation.lastMessage
                        ? truncate(conversation.lastMessage.content, 32)
                        : 'No messages yet'}
                    </p>
                  </div>

                  {conversation.unread > 0 ? (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent-primary px-1.5 font-mono text-[10px] font-bold text-[#06060c]">
                      {conversation.unread > 9 ? '9+' : conversation.unread}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })
        )}
      </ul>

      <Modal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="New conversation"
        description="Pick a friend to message."
      >
        {availableFriends.length === 0 ? (
          <EmptyState title="No friends yet" description="Add friends to start a conversation." />
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {availableFriends.map((friend) => (
              <li key={friend.id}>
                <button
                  type="button"
                  onClick={() => {
                    onStartConversation(friend);
                    setPickerOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-hover hover:bg-bg-elevated"
                >
                  <Avatar
                    src={friend.avatar}
                    name={friend.username}
                    size="sm"
                    status={statuses[friend.id] ?? 'offline'}
                  />
                  <span className="truncate text-sm text-content-primary">{friend.username}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}

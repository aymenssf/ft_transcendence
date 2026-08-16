import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { AsyncBoundary, EmptyState, LoadingState, Skeleton } from '@/components/ui/States';
import { ConversationList } from '@/components/chat/ConversationList';
import { MessageThread } from '@/components/chat/MessageThread';
import { MessageComposer } from '@/components/chat/MessageComposer';
import { ConversationHeader } from '@/components/chat/ConversationHeader';
import { useAsync } from '@/hooks/useAsync';
import { useChatEvent, emitChat } from '@/hooks/useChatSocket';
import { chatService } from '@/services/chat.service';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/stores/ui.store';
import { errorMessage } from '@/lib/http';
import type { ChatMessage, ChatRoom, Conversation, User } from '@/types';

export function ChatScreen() {
  const user = useAuthStore((state) => state.user);
  const meId = user?.id ?? 0;

  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [unread, setUnread] = useState<Record<number, number>>({});

  const rooms = useAsync<ChatRoom[]>((signal) => chatService.getChatRooms(signal), []);
  const friends = useAsync<User[]>((signal) => chatService.getFriends(signal), []);
  const blocked = useAsync<User[]>((signal) => chatService.getBlockedUsers(signal), []);

  const blockedIds = useMemo(
    () => new Set((blocked.data ?? []).map((entry) => entry.id)),
    [blocked.data],
  );

  const conversations = useMemo<Conversation[]>(
    () => buildConversations(rooms.data ?? [], meId, unread),
    [rooms.data, meId, unread],
  );

  const activeConversation = conversations.find((c) => c.room.id === activeRoomId) ?? null;

  /** Load history whenever the active room changes. */
  useEffect(() => {
    if (activeRoomId === null) return;

    const controller = new AbortController();
    setMessagesLoading(true);
    setMessagesError(null);

    chatService
      .getRoomMessages(activeRoomId, controller.signal)
      .then((history) => {
        setMessages(history);
        setUnread((current) => ({ ...current, [activeRoomId]: 0 }));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setMessagesError(errorMessage(error));
      })
      .finally(() => setMessagesLoading(false));

    emitChat('join-room', { chatRoomId: activeRoomId });

    return () => {
      controller.abort();
      emitChat('leave-room', { chatRoomId: activeRoomId });
    };
  }, [activeRoomId]);

  /**
   * Live inbound messages.
   *
   * The event name is `message` (not `new-message`) and the payload nests the
   * author under `sender` — both recovered from the previous `chat/chat.ts`,
   * which is the only record of this protocol. Emitted names are `join-room`,
   * `leave-room` and `send-message`, all keyed on `chatRoomId`.
   */
  useChatEvent<RawIncomingMessage>(
    'message',
    useCallback(
      (raw) => {
        if (blockedIds.has(raw.senderId)) return;

        const incoming: ChatMessage = {
          id: raw.id,
          content: raw.content ?? '',
          senderId: raw.senderId,
          senderName: raw.sender?.username ?? raw.senderName ?? 'Unknown',
          senderAvatar: raw.sender?.avatar ?? raw.senderAvatar,
          timestamp: raw.timestamp ?? raw.created_at ?? new Date().toISOString(),
          type: raw.type ?? 'text',
          chatRoomId: raw.chatRoomId,
          metadata: raw.metadata,
        };

        if (raw.chatRoomId === activeRoomId) {
          setMessages((current) => [...current, incoming]);
        } else if (raw.chatRoomId !== undefined) {
          const roomId = raw.chatRoomId;
          setUnread((current) => ({ ...current, [roomId]: (current[roomId] ?? 0) + 1 }));
        }
      },
      [activeRoomId, blockedIds],
    ),
  );

  /**
   * No optimistic append. The server always echoes `send-message` back as a
   * `message` event to every room member, sender included — the old
   * `chat.ts` relied on exactly that and never appended locally. Doing both
   * doubled every outgoing message ("hello" appeared twice) since the socket
   * echo landed on top of an already-rendered local copy.
   */
  const send = (content: string): void => {
    if (activeRoomId === null || content.trim() === '') return;
    emitChat('send-message', { chatRoomId: activeRoomId, content });
  };

  const handleBlock = async (peer: User, block: boolean): Promise<void> => {
    try {
      if (block) await chatService.blockUser(peer.id);
      else await chatService.unblockUser(peer.id);
      blocked.reload();
      toast.success(block ? `Blocked ${peer.username}` : `Unblocked ${peer.username}`);
    } catch (error) {
      toast.error('Action failed', errorMessage(error));
    }
  };

  const startConversation = async (friend: User): Promise<void> => {
    try {
      const room = await chatService.createPrivateChat(friend.id);
      rooms.reload();
      setActiveRoomId(room.id);
    } catch (error) {
      toast.error('Could not open chat', errorMessage(error));
    }
  };

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col">
      <PageHeader title="Chat" />

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-bg-card">
        <aside
          aria-label="Conversations"
          className="flex w-[280px] shrink-0 flex-col border-r border-border"
        >
          <AsyncBoundary
            state={rooms}
            onRetry={rooms.reload}
            loading={
              <div className="space-y-2 p-3">
                {[0, 1, 2, 3].map((index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            }
          >
            {() => (
              <ConversationList
                conversations={conversations}
                activeRoomId={activeRoomId}
                onSelect={setActiveRoomId}
                friends={friends.data ?? []}
                onStartConversation={startConversation}
                blockedIds={blockedIds}
                onToggleBlock={handleBlock}
              />
            )}
          </AsyncBoundary>
        </aside>

        <section aria-label="Messages" className="flex min-w-0 flex-1 flex-col">
          {activeConversation === null ? (
            <EmptyState
              className="flex-1"
              icon={<MessageSquare aria-hidden className="h-5 w-5" />}
              title="Select a conversation"
              description="Pick someone from the list to start chatting."
            />
          ) : (
            <>
              <ConversationHeader
                conversation={activeConversation}
                blocked={
                  activeConversation.peer ? blockedIds.has(activeConversation.peer.id) : false
                }
                onToggleBlock={handleBlock}
              />

              {messagesLoading ? (
                <LoadingState className="flex-1" label="Loading messages…" />
              ) : messagesError ? (
                <EmptyState className="flex-1" title="Could not load messages" description={messagesError} />
              ) : (
                <MessageThread messages={messages} meId={meId} />
              )}

              <MessageComposer
                onSend={send}
                disabled={
                  activeConversation.peer ? blockedIds.has(activeConversation.peer.id) : false
                }
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/** Wire shape of the `message` socket event, per the previous chat/chat.ts. */
interface RawIncomingMessage {
  id: number | string;
  content?: string;
  senderId: number;
  senderName?: string;
  senderAvatar?: string;
  sender?: { username?: string; avatar?: string };
  timestamp?: string;
  created_at?: string;
  type?: ChatMessage['type'];
  chatRoomId?: number;
  metadata?: string | Record<string, unknown>;
}

/**
 * Flattens rooms into the shape the conversation list renders.
 *
 * `peer` only applies to `private` rooms (a 1:1 DM). Public/protected rooms
 * are group spaces with no single "other person" — picking an arbitrary
 * non-self member as `peer` (the previous behaviour) made a room like
 * "General" render with one random member's avatar and an "Offline" presence
 * dot that had nothing to do with the room's actual state.
 */
function buildConversations(
  rooms: readonly ChatRoom[],
  meId: number,
  unread: Record<number, number>,
): Conversation[] {
  return rooms.map((room) => {
    if (room.type !== 'private') {
      return { room, peer: null, lastMessage: null, unread: unread[room.id] ?? 0 };
    }

    const peerMember = room.members?.find((member) => member.userId !== meId);
    const peer = peerMember?.user ?? (peerMember ? ({ id: peerMember.userId, username: room.name || 'Unknown' } as User) : null);

    return { room, peer, lastMessage: null, unread: unread[room.id] ?? 0 };
  });
}

/** Kept for the ref-based auto-scroll used by MessageThread. */
export type { Conversation };
export const useAutoScroll = (dependency: unknown): React.RefObject<HTMLDivElement> => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
  }, [dependency]);
  return ref;
};

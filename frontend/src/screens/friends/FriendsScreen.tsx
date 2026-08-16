import { useMemo, useState } from 'react';
import { Search, UserPlus, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { FriendCard } from '@/components/friends/FriendCard';
import { PendingRequests } from '@/components/friends/PendingRequests';
import { AsyncBoundary, EmptyState, Skeleton } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { chatService } from '@/services/chat.service';
import { usePresenceStore } from '@/stores/presence.store';
import { navigate } from '@/stores/router.store';
import { toast } from '@/stores/ui.store';
import { sendFriendInvite } from '../../friend_invite_handler.js';
import { errorMessage } from '@/lib/http';
import type { FriendRequest, User } from '@/types';

export function FriendsScreen() {
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<User | null>(null);
  const [removing, setRemoving] = useState(false);

  const statuses = usePresenceStore((state) => state.statuses);

  const friends = useAsync<User[]>((signal) => chatService.getFriends(signal), []);
  const requests = useAsync<FriendRequest[]>(
    (signal) => chatService.getPendingRequests(signal),
    [],
  );

  const filtered = useMemo(() => {
    const list = friends.data ?? [];
    const needle = query.trim().toLowerCase();
    if (needle === '') return list;
    return list.filter((friend) => friend.username.toLowerCase().includes(needle));
  }, [friends.data, query]);

  const submitAdd = async (): Promise<void> => {
    const username = addName.trim();
    if (username === '') return;

    setAdding(true);
    setAddError(null);
    try {
      await chatService.sendFriendRequest(username);
      toast.success('Request sent', `Waiting for ${username} to accept.`);
      setAddOpen(false);
      setAddName('');
    } catch (error) {
      setAddError(errorMessage(error));
    } finally {
      setAdding(false);
    }
  };

  const respond = async (request: FriendRequest, accept: boolean): Promise<void> => {
    try {
      await chatService.respondToFriendRequest(request.id, accept);
      requests.reload();
      if (accept) friends.reload();
      toast.success(accept ? 'Friend added' : 'Request declined');
    } catch (error) {
      toast.error('Could not respond', errorMessage(error));
    }
  };

  const confirmRemove = async (): Promise<void> => {
    if (!pendingRemove) return;
    setRemoving(true);
    try {
      await chatService.removeFriend(pendingRemove.id);
      friends.reload();
      toast.success(`Removed ${pendingRemove.username}`);
      setPendingRemove(null);
    } catch (error) {
      toast.error('Could not remove friend', errorMessage(error));
    } finally {
      setRemoving(false);
    }
  };

  const challenge = (friend: User): void => {
    sendFriendInvite(String(friend.id));
    toast.info('Challenge sent', `Waiting for ${friend.username} to respond.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Friends"
        description="Challenge, message and manage your player network."
        action={
          <Button onClick={() => setAddOpen(true)} icon={<UserPlus aria-hidden className="h-4 w-4" />}>
            Add friend
          </Button>
        }
      />

      <PendingRequests requests={requests.data ?? []} onRespond={respond} />

      <div className="max-w-sm">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter friends"
          aria-label="Filter friends"
          icon={<Search aria-hidden className="h-3.5 w-3.5" />}
        />
      </div>

      <AsyncBoundary
        state={friends}
        onRetry={friends.reload}
        loading={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <Skeleton key={index} className="h-40 w-full" />
            ))}
          </div>
        }
        isEmpty={(list) => list.length === 0}
        empty={
          <EmptyState
            icon={<Users aria-hidden className="h-5 w-5" />}
            title="No friends yet"
            description="Send a request to start building your network."
            action={
              <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
                Add a friend
              </Button>
            }
          />
        }
      >
        {() =>
          filtered.length === 0 ? (
            <EmptyState title="No matches" description={`Nobody matches "${query}".`} />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((friend) => (
                <FriendCard
                  key={friend.id}
                  friend={friend}
                  status={statuses[friend.id] ?? friend.status ?? 'offline'}
                  onChallenge={() => challenge(friend)}
                  onRemove={() => setPendingRemove(friend)}
                />
              ))}
            </ul>
          )
        }
      </AsyncBoundary>

      <Modal
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setAddError(null);
        }}
        title="Add a friend"
        description="Enter the exact username of the player you want to add."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={adding}>
              Cancel
            </Button>
            <Button onClick={submitAdd} loading={adding} disabled={addName.trim() === ''}>
              Send request
            </Button>
          </>
        }
      >
        <Input
          value={addName}
          onChange={(event) => setAddName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submitAdd();
          }}
          label="Username"
          placeholder="e.g. jdoe"
          error={addError}
          autoFocus
        />
      </Modal>

      <ConfirmDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemove(null);
        }}
        title="Remove friend"
        message={`${pendingRemove?.username ?? 'This player'} will be removed from your friends list.`}
        confirmLabel="Remove"
        onConfirm={confirmRemove}
        pending={removing}
      />
    </div>
  );
}

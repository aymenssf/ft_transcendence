import { Check, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { FriendRequest } from '@/types';

export function PendingRequests({
  requests,
  onRespond,
}: {
  requests: readonly FriendRequest[];
  onRespond: (request: FriendRequest, accept: boolean) => void;
}) {
  if (requests.length === 0) return null;

  return (
    <section
      aria-label="Pending friend requests"
      className="rounded-xl border border-accent-amber/30 bg-accent-amber/[0.04]"
    >
      <div className="border-b border-border p-5">
        <h3 className="font-heading text-sm font-bold text-content-primary">
          Pending requests
          <Badge tone="amber" className="ml-2">
            {requests.length}
          </Badge>
        </h3>
      </div>

      <ul className="divide-y divide-border">
        {requests.map((request) => {
          const sender = request.sender;
          const name = sender?.username ?? `User ${request.senderId}`;

          return (
            <li key={request.id} className="flex items-center gap-3 p-4">
              <Avatar src={sender?.avatar} name={name} size="sm" />
              <p className="min-w-0 flex-1 truncate text-sm text-content-primary">
                <span className="font-medium">{name}</span>
                <span className="text-content-secondary"> wants to be friends</span>
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => onRespond(request, true)}
                  icon={<Check aria-hidden className="h-3.5 w-3.5" />}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onRespond(request, false)}
                  icon={<X aria-hidden className="h-3.5 w-3.5" />}
                >
                  Decline
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

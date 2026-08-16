import { useRef, useState, type DragEvent } from 'react';
import { Flame, Pencil, Percent, TrendingDown, Trophy, Upload } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { StatCard } from '@/components/ui/StatCard';
import { EloBadge } from '@/components/ui/Badge';
import { AsyncBoundary, Skeleton } from '@/components/ui/States';
import { MatchHistoryTable } from '@/components/dashboard/MatchHistoryTable';
import { useAsync } from '@/hooks/useAsync';
import { useAuthStore } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';
import { gameService } from '@/services/game.service';
import { toast } from '@/stores/ui.store';
import { errorMessage } from '@/lib/http';
import { percent } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Match, UserStats } from '@/types';

export function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const userId = user?.id ?? 0;
  const [editing, setEditing] = useState(false);

  const stats = useAsync<UserStats>(
    (signal) => gameService.getStats(userId, signal),
    [userId],
    { enabled: userId > 0 },
  );

  const matches = useAsync<Match[]>(
    (signal) => gameService.getMatches(userId, signal),
    [userId],
    { enabled: userId > 0 },
  );

  return (
    <div className="space-y-6">
      <section aria-label="Profile" className="overflow-hidden rounded-2xl border border-border bg-bg-card">
        <div className="relative h-40 bg-gradient-hero">
          <div aria-hidden className="absolute inset-0 bg-bg-primary/25 backdrop-blur-[2px]" />
        </div>

        <div className="relative px-6 pb-6">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <Avatar
                src={user?.avatar}
                name={user?.username ?? '?'}
                size="xl"
                status="online"
                className="rounded-full ring-4 ring-bg-card"
              />
              <div className="pb-1">
                <h2 className="font-heading text-2xl font-bold text-content-primary">
                  {user?.username ?? 'Player'}
                </h2>
                <p className="text-sm text-content-secondary">
                  {user?.email ?? 'No email on file'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pb-1">
              <EloBadge elo={stats.data?.elo} />
              <Button
                variant="secondary"
                onClick={() => setEditing(true)}
                icon={<Pencil aria-hidden className="h-3.5 w-3.5" />}
              >
                Edit profile
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Wins"
          value={stats.data?.wins ?? 0}
          tone="green"
          loading={stats.loading}
          icon={<Flame aria-hidden className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Losses"
          value={stats.data?.losses ?? 0}
          tone="red"
          loading={stats.loading}
          icon={<TrendingDown aria-hidden className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Win rate"
          value={stats.data ? percent(stats.data.winRate) : '—'}
          tone="cyan"
          loading={stats.loading}
          icon={<Percent aria-hidden className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="ELO"
          value={stats.data?.elo ?? '—'}
          tone="violet"
          loading={stats.loading}
          icon={<Trophy aria-hidden className="h-3.5 w-3.5" />}
        />
      </section>

      <section aria-label="Match history" className="rounded-xl border border-border bg-bg-card">
        <div className="border-b border-border p-5">
          <h3 className="font-heading text-sm font-bold text-content-primary">Match history</h3>
        </div>

        <AsyncBoundary
          state={matches}
          onRetry={matches.reload}
          loading={
            <div className="space-y-3 p-5">
              {[0, 1, 2, 3, 4].map((index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          }
          isEmpty={(list) => list.length === 0}
        >
          {(list) => <MatchHistoryTable matches={list} />}
        </AsyncBoundary>
      </section>

      <EditProfileModal open={editing} onOpenChange={setEditing} />
    </div>
  );
}

function EditProfileModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const user = useAuthStore((state) => state.user);
  const patchUser = useAuthStore((state) => state.patchUser);

  const [username, setUsername] = useState(user?.username ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = (candidate: File | undefined): void => {
    if (!candidate) return;
    if (!candidate.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (candidate.size > 4 * 1024 * 1024) {
      setError('Images must be smaller than 4 MB.');
      return;
    }
    setError(null);
    setFile(candidate);
    setPreview(URL.createObjectURL(candidate));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files[0]);
  };

  const save = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      if (file) {
        const result = await authService.uploadAvatar(file);
        if (result?.avatar) patchUser({ avatar: result.avatar });
      }

      const trimmed = username.trim();
      if (trimmed !== '' && trimmed !== user?.username) {
        await authService.updateProfile({ username: trimmed });
        patchUser({ username: trimmed });
      }

      toast.success('Profile updated');
      onOpenChange(false);
      setFile(null);
      setPreview(null);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Edit profile"
      description="Change how other players see you."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Input
          label="Username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Your display name"
        />

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-content-secondary">
            Avatar
          </p>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
            }}
            role="button"
            tabIndex={0}
            aria-label="Upload avatar image"
            className={cn(
              'flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-6 text-center',
              'transition-colors duration-hover ease-out',
              dragging
                ? 'border-accent-primary bg-accent-primary/8'
                : 'border-border-accent hover:border-accent-primary/60 hover:bg-bg-elevated',
            )}
          >
            {preview ? (
              <img
                src={preview}
                alt="Avatar preview"
                className="h-20 w-20 rounded-full border border-border-accent object-cover"
              />
            ) : (
              <Upload aria-hidden className="h-6 w-6 text-content-muted" />
            )}

            <div>
              <p className="text-sm text-content-primary">
                {file ? file.name : 'Drop an image here, or click to browse'}
              </p>
              <p className="mt-0.5 text-xs text-content-muted">PNG or JPG, up to 4 MB</p>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => acceptFile(event.target.files?.[0])}
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-accent-red">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

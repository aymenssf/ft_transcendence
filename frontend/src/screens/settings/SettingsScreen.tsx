import { useState } from 'react';
import { AlertTriangle, Copy, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useAuthStore } from '@/stores/auth.store';
import { authService } from '@/services/auth.service';
import { toast } from '@/stores/ui.store';
import { HttpError, errorMessage } from '@/lib/http';
import { navigate } from '@/stores/router.store';

export function SettingsScreen() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" description="Manage your account and security." />

      <section aria-label="Account" className="rounded-xl border border-border bg-bg-card">
        <div className="border-b border-border p-5">
          <h3 className="font-heading text-sm font-bold text-content-primary">Account</h3>
        </div>
        <div className="space-y-4 p-5">
          <Input
            label="Display name"
            defaultValue={user?.username ?? ''}
            readOnly
            hint="Change your display name from the Profile screen."
          />
          <Input
            label="Email"
            defaultValue={user?.email ?? 'Not provided'}
            readOnly
            hint="Managed by your 42 intra account."
          />
          {user?.is_42_user ? (
            <Badge tone="cyan">Signed in with 42</Badge>
          ) : null}
        </div>
      </section>

      <TwoFactorSection />
      <DangerZone />
    </div>
  );
}

function TwoFactorSection() {
  const user = useAuthStore((state) => state.user);
  const patchUser = useAuthStore((state) => state.patchUser);

  const [enabled, setEnabled] = useState(user?.twoFactorEnabled ?? false);
  const [secret, setSecret] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const toggle = async (next: boolean): Promise<void> => {
    setPending(true);
    setError(null);

    try {
      if (next) {
        const result = await authService.enableTwoFactor();
        setSecret(result.secret);
        setQrCode(result.qrCode);
        setEnabled(true);
      } else {
        await authService.disableTwoFactor();
        setSecret(null);
        setQrCode(null);
        setEnabled(false);
        patchUser({ twoFactorEnabled: false });
        toast.success('Two-factor authentication disabled');
      }
    } catch (cause) {
      // A 404 means this deployment does not expose the 2FA module at all —
      // show that plainly rather than a generic failure.
      if (cause instanceof HttpError && cause.status === 404) {
        setUnavailable(true);
      } else {
        setError(errorMessage(cause));
      }
      setEnabled(!next);
    } finally {
      setPending(false);
    }
  };

  const verify = async (): Promise<void> => {
    setPending(true);
    setError(null);
    try {
      await authService.verifyTwoFactor(code.trim());
      patchUser({ twoFactorEnabled: true });
      setSecret(null);
      setQrCode(null);
      setCode('');
      toast.success('Two-factor authentication enabled');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  };

  const copySecret = async (): Promise<void> => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      toast.success('Secret copied to clipboard');
    } catch {
      toast.error('Could not copy', 'Select the text and copy it manually.');
    }
  };

  return (
    <section aria-label="Security" className="rounded-xl border border-border bg-bg-card">
      <div className="border-b border-border p-5">
        <h3 className="font-heading text-sm font-bold text-content-primary">Security</h3>
      </div>

      <div className="space-y-5 p-5">
        <Switch
          checked={enabled}
          onCheckedChange={toggle}
          disabled={pending || unavailable}
          label="Two-factor authentication"
          description={
            unavailable
              ? 'Not available on this server. The auth service does not expose a 2FA endpoint.'
              : 'Require a one-time code from your authenticator app when signing in.'
          }
        />

        {unavailable ? (
          <p className="flex items-start gap-2 rounded-lg border border-accent-amber/30 bg-accent-amber/[0.06] p-3 text-xs text-accent-amber">
            <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            The backend returned 404 for <code className="font-mono">/api/2fa/enable</code>. Enable
            the module server-side to use this setting.
          </p>
        ) : null}

        {secret ? (
          <div className="space-y-4 rounded-xl border border-border bg-bg-secondary p-5">
            <div className="flex items-start gap-2 text-sm text-content-secondary">
              <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" />
              Scan this code with your authenticator app, then enter the six-digit code to confirm.
            </div>

            {qrCode ? (
              <img
                src={qrCode}
                alt="Two-factor authentication QR code"
                className="mx-auto h-44 w-44 rounded-lg border border-border-accent bg-white p-2"
              />
            ) : null}

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-content-secondary">
                Secret key
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-bg-primary px-3 py-2 font-mono text-xs text-content-primary">
                  {secret}
                </code>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={copySecret}
                  aria-label="Copy secret key"
                  icon={<Copy aria-hidden className="h-3.5 w-3.5" />}
                />
              </div>
            </div>

            <div className="flex items-end gap-2">
              <Input
                label="Verification code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="000000"
                inputMode="numeric"
                maxLength={6}
                className="font-mono tracking-[0.3em]"
              />
              <Button onClick={verify} loading={pending} disabled={code.trim().length < 6}>
                Verify
              </Button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-accent-red">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function DangerZone() {
  const logout = useAuthStore((state) => state.logout);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  const deleteAccount = async (): Promise<void> => {
    setPending(true);
    try {
      await authService.deleteAccount();
      await logout();
      navigate('home');
      toast.success('Account deleted');
    } catch (cause) {
      // auth-service has no /user/delete route today (verified: no matching
      // handler in services/auth-service/src). Nothing was deleted — say so
      // plainly instead of a generic failure message.
      if (cause instanceof HttpError && cause.status === 404) {
        toast.error('Not available', 'Account deletion is not supported by this server yet.');
      } else {
        toast.error('Could not delete account', errorMessage(cause));
      }
    } finally {
      setPending(false);
      setConfirming(false);
    }
  };

  return (
    <section aria-label="Danger zone" className="rounded-xl border border-accent-red/30 bg-accent-red/[0.03]">
      <div className="border-b border-accent-red/20 p-5">
        <h3 className="font-heading text-sm font-bold text-accent-red">Danger zone</h3>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="font-heading text-sm font-bold text-content-primary">Delete account</p>
          <p className="mt-1 max-w-md text-sm text-content-secondary">
            Permanently removes your profile, match history and friendships. This cannot be undone.
          </p>
        </div>
        <Button variant="danger" onClick={() => setConfirming(true)}>
          Delete account
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete your account?"
        message="This permanently erases your profile, match history and friendships. This action cannot be undone."
        confirmLabel="Delete permanently"
        onConfirm={deleteAccount}
        pending={pending}
      />
    </section>
  );
}

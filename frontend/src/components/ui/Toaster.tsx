import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useUiStore, type Toast, type ToastVariant } from '@/stores/ui.store';

const ICONS: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const TONES: Record<ToastVariant, string> = {
  success: 'border-accent-green/40 text-accent-green',
  error: 'border-accent-red/40 text-accent-red',
  info: 'border-accent-cyan/40 text-accent-cyan',
  warning: 'border-accent-amber/40 text-accent-amber',
};

function ToastCard({ toast }: { toast: Toast }) {
  const dismiss = useUiStore((state) => state.dismissToast);
  const Icon = ICONS[toast.variant];

  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), 5000);
    return () => window.clearTimeout(timer);
  }, [toast.id, dismiss]);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: 24, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.97 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'pointer-events-auto flex w-80 items-start gap-3 rounded-xl border bg-bg-card/95 p-3.5 shadow-card backdrop-blur',
        TONES[toast.variant],
      )}
    >
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-bold text-content-primary">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-xs text-content-secondary">{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => dismiss(toast.id)}
        className="rounded p-0.5 text-content-muted transition-colors duration-hover hover:text-content-primary"
      >
        <X aria-hidden className="h-3.5 w-3.5" />
      </button>
    </motion.li>
  );
}

export function Toaster() {
  const toasts = useUiStore((state) => state.toasts);

  return (
    <ul
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col gap-2.5"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </ul>
  );
}

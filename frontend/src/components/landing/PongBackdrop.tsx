/**
 * Background layer shared by the Home and Login screens: a Pong ball bouncing
 * between two paddles, driven by two independent CSS animations with different
 * periods so the path never repeats visibly. CSS-only — no rAF loop competing
 * with the real game canvas.
 */
export function PongBackdrop({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-accent-primary/12 blur-3xl" />
      <div className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-accent-cyan/10 blur-3xl" />

      <div
        className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border-accent/40"
        style={{
          maskImage: 'repeating-linear-gradient(to bottom, black 0 16px, transparent 16px 32px)',
          WebkitMaskImage:
            'repeating-linear-gradient(to bottom, black 0 16px, transparent 16px 32px)',
        }}
      />

      <div className="absolute left-[3%] top-1/2 h-28 w-2 -translate-y-1/2 rounded-full bg-accent-primary/50 shadow-glow-violet" />
      <div className="absolute right-[3%] top-1/2 h-28 w-2 -translate-y-1/2 rounded-full bg-accent-cyan/50 shadow-glow-cyan" />

      {!reducedMotion ? (
        <div className="absolute inset-0 animate-ball-x">
          <div className="absolute animate-ball-y">
            <div className="h-3.5 w-3.5 rounded-full bg-content-primary shadow-[0_0_18px_rgba(240,240,255,0.75)]" />
          </div>
        </div>
      ) : null}
    </div>
  );
}

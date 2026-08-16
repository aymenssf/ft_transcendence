import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * The bridge between React and the immutable, DOM-mutating legacy modules.
 *
 * Strategy (see DOM_CONTRACT.md):
 *   1. Legacy needs specific element ids to exist and to be mutable by hand.
 *   2. The design spec wants those same values rendered in a very different
 *      visual treatment than legacy's raw `innerHTML = "3 - 5"` produces.
 *
 * Rather than fight over the nodes, we do both: render the contract elements
 * into a visually-hidden host that legacy owns outright, then MIRROR their
 * values into React state with a MutationObserver and render the real UI from
 * that. Legacy writes; React reads and repaints. Neither clobbers the other.
 *
 * Nodes that must stay interactive (the canvas host, the start and back
 * buttons) are rendered visibly instead, but still as ceded subtrees that React
 * mounts exactly once and never reconciles.
 */

/**
 * Injects a raw HTML string exactly once and never touches it again.
 *
 * Uses a ref + mount guard rather than `dangerouslySetInnerHTML` so that even a
 * changing `html` prop cannot cause React to replace nodes legacy is holding
 * references to — `handleGameConfig` calls `replaceChild` on the start button,
 * which would leave React with a detached node.
 */
export function LegacyHtml({
  html,
  className,
  id,
}: {
  html: string;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const injected = useRef(false);

  useEffect(() => {
    if (ref.current && !injected.current) {
      ref.current.innerHTML = html;
      injected.current = true;
    }
    // `html` is intentionally not a dependency: this mounts once, by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} id={id} className={className} />;
}

/**
 * An empty div that only exists so a legacy module can find it by id and fill
 * it. React renders no children into it, ever.
 */
export function LegacySlot({
  id,
  className,
  as: Tag = 'div',
}: {
  id: string;
  className?: string;
  as?: 'div' | 'span';
}) {
  return <Tag id={id} className={className} />;
}

/**
 * Off-screen host for contract elements that legacy mutates but that we want to
 * render ourselves in a different style. Kept in the layout (not
 * `display: none`) because legacy reads and writes `style.display` on some of
 * these, and a display-toggling parent would make that observable behaviour
 * inconsistent.
 */
export function LegacyContractHost({ html }: { html: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
      style={{ clipPath: 'inset(50%)' }}
    >
      <LegacyHtml html={html} />
    </div>
  );
}

/**
 * Resolves a contract element, warning loudly when it is missing.
 *
 * Every mirror hook below used to `return` silently on a missing element, which
 * is precisely how a broken contract stays invisible: no error, no console
 * output, just a value that never updates. If this warns, an id in
 * DOM_CONTRACT.md has drifted or a hook ran before the element was injected.
 */
function requireElement(elementId: string, hook: string): HTMLElement | null {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(
      `[legacy-dom] ${hook}: #${elementId} not found. The legacy DOM contract is broken — see DOM_CONTRACT.md.`,
    );
  }
  return element;
}

/** Mirrors an element's text content into React state. */
export function useMirroredText(elementId: string, initial = ''): string {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    const element = requireElement(elementId, 'useMirroredText');
    if (!element) return;

    const read = (): void => setValue(element.textContent?.trim() ?? '');
    read();

    const observer = new MutationObserver(read);
    observer.observe(element, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [elementId]);

  return value;
}

/** Mirrors an element attribute (e.g. an `<img src>`) into React state. */
export function useMirroredAttribute(elementId: string, attribute: string): string | null {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    const element = requireElement(elementId, 'useMirroredAttribute');
    if (!element) return;

    const read = (): void => setValue(element.getAttribute(attribute));
    read();

    const observer = new MutationObserver(read);
    observer.observe(element, { attributes: true, attributeFilter: [attribute] });
    return () => observer.disconnect();
  }, [elementId, attribute]);

  return value;
}

/**
 * Parses the score legacy writes as `"3 - 5"` into a pair.
 * Returns nulls until the first `game_update` arrives.
 */
export function useLegacyScore(elementId: string): { left: number | null; right: number | null } {
  const raw = useMirroredText(elementId);

  const match = /(-?\d+)\s*-\s*(-?\d+)/.exec(raw);
  if (!match) return { left: null, right: null };

  return { left: Number(match[1]), right: Number(match[2]) };
}

/**
 * Watches an element's class list for a legacy-applied marker such as
 * `disabled-link`, so React chrome can reflect the same state.
 */
export function useHasClass(elementId: string, className: string): boolean {
  const [present, setPresent] = useState(false);

  useEffect(() => {
    const element = requireElement(elementId, 'useHasClass');
    if (!element) return;

    const read = (): void => setPresent(element.classList.contains(className));
    read();

    const observer = new MutationObserver(read);
    observer.observe(element, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [elementId, className]);

  return present;
}

/** Shared visual frame for the canvas host. React owns the chrome, legacy the inside. */
export function CanvasFrame({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border-accent bg-[#06060c]',
        'shadow-glow-violet',
        className,
      )}
    >
      {/* Centre line, purely decorative — the real game renders into #game-container. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border-accent/60"
        style={{
          maskImage: 'repeating-linear-gradient(to bottom, black 0 12px, transparent 12px 24px)',
          WebkitMaskImage:
            'repeating-linear-gradient(to bottom, black 0 12px, transparent 12px 24px)',
        }}
      />
      {/* Ceded subtree: legacy clears this and appends its own <canvas>. */}
      <LegacySlot id="game-container" className="absolute inset-0" />
    </div>
  );
}

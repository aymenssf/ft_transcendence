/** Presentation helpers. Pure functions, no DOM access. */

/** Zero-padded score, e.g. `3` -> `"03"`. Matches the scoreboard spec. */
export function pad2(value: number): string {
  return String(Math.max(0, Math.trunc(value))).padStart(2, '0');
}

/** `0.6428` -> `"64%"` */
export function percent(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

/** Tolerates the several shapes the stats endpoints return (string | number). */
export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** `"2024-03-14T…"` -> `"14 Mar 2024"`. Returns "—" for unparseable input. */
export function formatDate(input: string | number | Date | undefined | null): string {
  if (input === undefined || input === null || input === '') return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** Compact relative time for chat timestamps: "now", "4m", "3h", "12 Mar". */
export function formatRelative(input: string | number | Date | undefined | null): string {
  if (!input) return '';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d`;

  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date);
}

/** Clock time for message bubbles: "14:32". */
export function formatTime(input: string | number | Date | undefined | null): string {
  if (!input) return '';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Two-letter monogram used as the avatar fallback. */
export function initials(name: string | undefined | null): string {
  if (!name) return '??';
  const parts = name.trim().split(/[\s_\-.]+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

/** Signed ELO delta: `12` -> `"+12"`, `-8` -> `"−8"` (true minus sign). */
export function signedDelta(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return '0';
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

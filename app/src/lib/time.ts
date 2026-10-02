/**
 * All times in this app are Jakarta wall-clock (WIB, UTC+7) — that is what the
 * source exports contain and what the team reads. Nothing is ever stored as
 * UTC, so server-written timestamps have to be converted explicitly rather
 * than taken from `new Date().toISOString()`.
 *
 * No imports here: this module is shared by the browser bundle and the
 * Pages Functions bundle.
 */

const WIB_FORMAT = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hour12: false,
});

/** Current WIB time as 'YYYY-MM-DD HH:MM:SS', whatever the server's clock is set to. */
export function nowWib(date: Date = new Date()): string {
  return WIB_FORMAT.format(date).replace('T', ' ');
}

/**
 * Calendar arithmetic on 'YYYY-MM-DD' strings.
 *
 * These dates carry no time component — they are WIB wall-clock days — so the
 * maths runs through Date.UTC and comes back out as a string. Going via a local
 * `new Date('2026-09-15')` would shift the day for anyone west of Greenwich.
 */
function toUtc(date: string): number {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;

/** '2026-09-29' + 3 -> '2026-10-02'. */
export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Whole days from `from` to `to`. Negative when `to` is the earlier date. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/**
 * Hours between two 'YYYY-MM-DD HH:MM:SS' WIB timestamps. Both sides are the
 * same wall clock, so reading them as UTC leaves the difference exact.
 */
export function hoursBetween(from: string, to: string): number {
  return (wallMs(to) - wallMs(from)) / 3_600_000;
}

/** '2026-10-02 00:30:00' − 12 → '2026-10-01 12:30:00'. Wall clock in, wall clock out. */
export function addHours(timestamp: string, hours: number): string {
  return new Date(wallMs(timestamp) + hours * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');
}

/** A 'YYYY-MM-DD HH:MM:SS' wall-clock time as milliseconds, read as UTC. */
function wallMs(timestamp: string): number {
  const [h, m, s] = (timestamp.slice(11, 19) || '00:00:00').split(':').map(Number);
  return toUtc(timestamp) + ((h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0)) * 1000;
}

/** Every date from `from` to `to`, both inclusive. Empty when `to` precedes `from`. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let ms = toUtc(from); ms <= toUtc(to); ms += DAY_MS) out.push(fromUtc(ms));
  return out;
}

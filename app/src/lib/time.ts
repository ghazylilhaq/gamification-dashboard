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

/** Every date from `from` to `to`, both inclusive. Empty when `to` precedes `from`. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let ms = toUtc(from); ms <= toUtc(to); ms += DAY_MS) out.push(fromUtc(ms));
  return out;
}

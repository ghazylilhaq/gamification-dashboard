import { TIMEZONE_LABEL } from '@/config/fileTypes';

export { nowWib } from './time';

/** Rp1.336.500 — Indonesian grouping, no decimals. Amounts here are whole rupiah. */
const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const plainNumber = new Intl.NumberFormat('id-ID');

export function formatRupiah(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  // Intl renders IDR as "Rp 1.336.500"; the house style has no space.
  return rupiah.format(Math.round(value)).replace(/\s/g, '');
}

/** Rp793rb / Rp1,3jt — for axis labels where the full number will not fit. */
export function formatRupiahCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `Rp${plainNumber.format(round1(value / 1_000_000_000))}mi`;
  if (abs >= 1_000_000) return `Rp${plainNumber.format(round1(value / 1_000_000))}jt`;
  if (abs >= 1_000) return `Rp${plainNumber.format(Math.round(value / 1_000))}rb`;
  return formatRupiah(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return plainNumber.format(value);
}

/** 4,3% — one decimal, Indonesian comma. */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value * 100)}%`;
}

export function formatDelta(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return '0';
  return `${value > 0 ? '+' : '−'}${plainNumber.format(Math.abs(value))}`;
}

export function formatDeltaRupiah(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return formatRupiah(0);
  return `${value > 0 ? '+' : '−'}${formatRupiah(Math.abs(value))}`;
}

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** '2026-09-15' -> '15 Sep'. All dates in this app are already WIB wall clock. */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  const [y, m, d] = date.slice(0, 10).split('-');
  if (!y || !m || !d) return date;
  return `${Number(d)} ${MONTHS_ID[Number(m) - 1] ?? m}`;
}

export function formatDateLong(date: string | null | undefined): string {
  if (!date) return '—';
  const [y, m, d] = date.slice(0, 10).split('-');
  if (!y || !m || !d) return date;
  return `${Number(d)} ${MONTHS_ID[Number(m) - 1] ?? m} ${y}`;
}

/** '2026-09-15 13:51:34' -> '13:51 WIB'. */
export function formatTimeWib(timestamp: string | null | undefined): string {
  if (!timestamp) return '—';
  const time = timestamp.slice(11, 16);
  return time ? `${time} ${TIMEZONE_LABEL}` : '—';
}

/** '2026-09-15 13:51:34' -> '15 Sep, 13:51 WIB'. */
export function formatDateTimeWib(timestamp: string | null | undefined): string {
  if (!timestamp) return '—';
  const date = formatDate(timestamp.slice(0, 10));
  const time = timestamp.slice(11, 16);
  return time ? `${date}, ${time} ${TIMEZONE_LABEL}` : date;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

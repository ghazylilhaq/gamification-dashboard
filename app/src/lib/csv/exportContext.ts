import { csvFileName } from './export';
import type { DataFilter } from '@/lib/metrics/dataset';

/**
 * Turn the active filters into filename parts, so a downloaded file says how
 * it was cut. `rewards_welcome-box_cashback_15sep-15sep.csv` is still
 * self-explanatory a week later in a downloads folder.
 */
export function filterParts(filter: DataFilter, extra: Array<string | null | undefined> = []) {
  const range =
    filter.from || filter.to
      ? `${(filter.from ?? 'start').slice(5)}-to-${(filter.to ?? 'latest').slice(5)}`
      : null;

  return [
    ...extra,
    range,
    filter.showTestData ? 'incl-test-data' : null,
  ];
}

export function exportName(
  base: string,
  filter: DataFilter,
  extra: Array<string | null | undefined> = [],
): string {
  return csvFileName(base, filterParts(filter, extra));
}

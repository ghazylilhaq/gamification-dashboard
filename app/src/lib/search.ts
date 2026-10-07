import { useMemo } from 'react';

/** The fields a row is searchable on. Numbers are matched as their digits. */
export type SearchFields<T> = (row: T) => Array<string | number | null | undefined>;

/**
 * Lowercase, strip accents, collapse whitespace.
 *
 * Reward names arrive from the export with inconsistent spacing and the
 * occasional accented merchant, so "Café  Nero" and "cafe nero" have to meet
 * somewhere.
 */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function haystack<T>(row: T, fields: SearchFields<T>): string {
  return normalize(
    fields(row)
      .filter((v) => v !== null && v !== undefined && v !== '')
      .join(' '),
  );
}

/**
 * True when every whitespace-separated token appears somewhere in the row's
 * searchable fields.
 *
 * Tokens are ANDed, not ORed, so "indomaret 5k" finds that one coupon whatever
 * the word order and each extra word narrows the list rather than widening it.
 * An empty query matches everything.
 */
export function matches<T>(query: string, row: T, fields: SearchFields<T>): boolean {
  const tokens = normalize(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return true;
  const text = haystack(row, fields);
  return tokens.every((token) => text.includes(token));
}

/**
 * The rows a query matches, memoized.
 *
 * Tables filter before they sort — `useTableSort` sorts whatever it is given —
 * so this sits directly in front of it. An empty query returns the identical
 * `rows` reference, which keeps the sort memo from recomputing on keystrokes
 * that change nothing.
 */
export function useSearch<T>(rows: T[], query: string, fields: SearchFields<T>): T[] {
  const trimmed = normalize(query);
  return useMemo(() => {
    if (trimmed === '') return rows;
    return rows.filter((row) => matches(trimmed, row, fields));
    // `fields` is an inline arrow at every call site and would defeat the memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, trimmed]);
}

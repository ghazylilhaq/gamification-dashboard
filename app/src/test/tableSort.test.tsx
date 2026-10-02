// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTableSort, type SortColumns } from '@/hooks/useTableSort';

interface Row {
  name: string;
  spend: number;
  /** Null stands for "not applicable", as it does in the real tables. */
  rate: number | null;
}

const rows: Row[] = [
  { name: 'Beta', spend: 30, rate: 0.5 },
  { name: 'alpha', spend: 10, rate: null },
  { name: 'Gamma', spend: 30, rate: 0.1 },
  { name: 'Delta', spend: 20, rate: null },
];

const columns: SortColumns<Row, 'name' | 'spend' | 'rate'> = {
  name: { label: 'Name', value: (r) => r.name },
  spend: { label: 'Spend', value: (r) => r.spend },
  rate: { label: 'Rate', value: (r) => r.rate },
};

function setup(key: 'name' | 'spend' | 'rate' = 'spend') {
  return renderHook(() => useTableSort(rows, columns, { key }, (r) => r.name));
}

const names = (result: { current: { rows: Row[] } }) => result.current.rows.map((r) => r.name);

describe('useTableSort', () => {
  it('sorts measures biggest first by default', () => {
    const { result } = setup();
    expect(names(result)).toEqual(['Beta', 'Gamma', 'Delta', 'alpha']);
  });

  it('sorts text A→Z by default, ignoring case', () => {
    const { result } = setup('name');
    expect(names(result)).toEqual(['alpha', 'Beta', 'Delta', 'Gamma']);
  });

  it('reverses on a second click of the same column', () => {
    const { result } = setup();
    act(() => result.current.th('spend').onClick());
    expect(result.current.sort.dir).toBe('asc');
    expect(names(result)).toEqual(['alpha', 'Delta', 'Beta', 'Gamma']);
  });

  it('starts a newly clicked column in its own natural direction', () => {
    const { result } = setup();
    act(() => result.current.th('name').onClick());
    expect(result.current.sort).toEqual({ key: 'name', dir: 'asc' });
  });

  it('keeps empty values at the bottom in both directions', () => {
    const { result } = setup('rate');
    expect(names(result)).toEqual(['Beta', 'Gamma', 'alpha', 'Delta']);
    act(() => result.current.th('rate').onClick());
    expect(names(result)).toEqual(['Gamma', 'Beta', 'alpha', 'Delta']);
  });

  it('breaks ties on the tiebreak key so equal rows never shuffle', () => {
    const { result } = setup();
    // Beta and Gamma both spend 30; the name decides, not insertion order.
    expect(names(result).slice(0, 2)).toEqual(['Beta', 'Gamma']);
  });

  it('describes the active order in words', () => {
    const { result } = setup();
    expect(result.current.summary).toBe('spend, highest first');
    act(() => result.current.th('name').onClick());
    expect(result.current.summary).toBe('name, A→Z');
  });

  it('leaves the source rows untouched', () => {
    setup();
    expect(rows.map((r) => r.name)).toEqual(['Beta', 'alpha', 'Gamma', 'Delta']);
  });
});

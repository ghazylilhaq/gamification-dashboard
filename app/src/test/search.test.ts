import { describe, it, expect } from 'vitest';
import { matches, normalize } from '@/lib/search';

interface Row {
  name: string;
  id: number;
  box: string | null;
}

const fields = (r: Row) => [r.name, r.id, r.box];

const rows: Row[] = [
  { name: 'Indomaret Discount of Rp5K', id: 30034, box: 'Daily Box' },
  { name: 'Indomaret Discount of Rp10K', id: 30041, box: 'Welcome Box' },
  { name: 'Café Nero Voucher', id: 30100, box: null },
  { name: 'JD Sports Rp150K', id: 30200, box: 'Fancam Box' },
];

const matching = (query: string) => rows.filter((r) => matches(query, r, fields)).map((r) => r.name);

describe('normalize', () => {
  it('lowercases, strips accents and collapses whitespace', () => {
    expect(normalize('  Café   NERO ')).toBe('cafe nero');
  });
});

describe('matches', () => {
  it('matches regardless of case', () => {
    expect(matching('INDOMARET')).toHaveLength(2);
  });

  it('matches an accented name typed plainly', () => {
    expect(matching('cafe')).toEqual(['Café Nero Voucher']);
  });

  it('ANDs the tokens rather than ORing them, so each word narrows', () => {
    expect(matching('indomaret')).toHaveLength(2);
    expect(matching('indomaret 5k')).toEqual(['Indomaret Discount of Rp5K']);
    // ORing would have returned every Indomaret row plus the JD Sports one.
    expect(matching('indomaret jd')).toEqual([]);
  });

  it('ignores word order', () => {
    expect(matching('5k indomaret')).toEqual(['Indomaret Discount of Rp5K']);
  });

  it('searches numeric fields, so a reward id finds its row', () => {
    expect(matching('30041')).toEqual(['Indomaret Discount of Rp10K']);
  });

  it('searches every field it is given, not just the name', () => {
    expect(matching('fancam')).toEqual(['JD Sports Rp150K']);
  });

  it('tolerates a null field', () => {
    expect(matching('voucher')).toEqual(['Café Nero Voucher']);
  });

  it('matches everything on an empty or whitespace query', () => {
    expect(matching('')).toHaveLength(4);
    expect(matching('   ')).toHaveLength(4);
  });
});

import { describe, it, expect } from 'vitest';
import {
  formatRupiah, formatRupiahCompact, formatNumber, formatPercent,
  formatDate, formatDateTimeWib, formatTimeWib, formatDelta,
} from '@/lib/format';
import { addDays, dateRange, daysBetween } from '@/lib/time';
import { merchantFromName } from '@/config/merchants';

describe('rupiah formatting', () => {
  it('uses Indonesian grouping with no decimals', () => {
    expect(formatRupiah(1_336_500)).toBe('Rp1.336.500');
    expect(formatRupiah(793_000)).toBe('Rp793.000');
    expect(formatRupiah(0)).toBe('Rp0');
  });

  it('renders an unknown amount as a dash rather than Rp0', () => {
    expect(formatRupiah(null)).toBe('—');
    expect(formatRupiah(undefined)).toBe('—');
  });

  it('abbreviates for chart axes', () => {
    expect(formatRupiahCompact(793_000)).toBe('Rp793rb');
    expect(formatRupiahCompact(1_336_500)).toBe('Rp1,3jt');
    expect(formatRupiahCompact(500)).toBe('Rp500');
  });
});

describe('number and percent formatting', () => {
  it('groups counts the Indonesian way', () => {
    expect(formatNumber(1991)).toBe('1.991');
  });

  it('renders the coupon redemption rate as 4,3%', () => {
    expect(formatPercent(32 / 742)).toBe('4,3%');
  });

  it('signs a change with a real minus sign', () => {
    expect(formatDelta(120)).toBe('+120');
    expect(formatDelta(-120)).toBe('−120');
    expect(formatDelta(0)).toBe('0');
  });
});

describe('WIB dates', () => {
  it('formats dates in Indonesian short form', () => {
    expect(formatDate('2026-09-15')).toBe('15 Sep');
  });

  it('labels times as WIB', () => {
    expect(formatTimeWib('2026-09-15 13:51:34')).toBe('13:51 WIB');
    expect(formatDateTimeWib('2026-09-15 13:51:34')).toBe('15 Sep, 13:51 WIB');
  });
});

describe('merchant derivation', () => {
  it('takes the text before " Discount", per the spec', () => {
    expect(merchantFromName('Tokopedia Discount of Rp5K')).toBe('Tokopedia');
    expect(merchantFromName('Indomaret Discount of Rp5K')).toBe('Indomaret');
    expect(merchantFromName("Wendy's Discount of Rp5K")).toBe("Wendy's");
  });

  it('collapses the JD Sports naming variants into one merchant', () => {
    for (const name of [
      'JD Sports Discount of Rp100K',
      'JD Sports 100K Discount',
      'JD Sports Rp150K Discount',
      'JD Sports Rp500k',
      'On Cloudtilt Shoes (JD Sports)',
    ]) {
      expect(merchantFromName(name), name).toBe('JD Sports');
    }
  });

  it('reads the merchant out of "Discount in X Merchant"', () => {
    expect(merchantFromName('15% Discount in Ismaya+ Merchant')).toBe('Ismaya+');
    expect(merchantFromName('Ismaya+ Discount of Rp100K')).toBe('Ismaya+');
  });

  it('reads "by X" as the merchant', () => {
    expect(merchantFromName('Aero Bag by Zena')).toBe('Zena');
    expect(merchantFromName('Prime Bag by Zena')).toBe('Zena');
    expect(merchantFromName('Zena Discount of Rp100K')).toBe('Zena');
    expect(merchantFromName('Rp100k Court Disc by DOOgether')).toBe('DOOgether');
  });

  it('applies the alias table for names that carry no merchant', () => {
    expect(merchantFromName('5 Weverse Jelly')).toBe('Weverse');
    expect(merchantFromName('Weverse Digital Membership')).toBe('Weverse');
    expect(merchantFromName('1 Session in Strong Pilates')).toBe('Strong Pilates');
  });

  it('falls back to the full name when no rule matches', () => {
    expect(merchantFromName('Some Unmapped Prize')).toBe('Some Unmapped Prize');
  });

  it('trims the stray whitespace in the source data', () => {
    expect(merchantFromName('The Coffee Bean & Tea Leaf  Discount of Rp5K'))
      .toBe('The Coffee Bean & Tea Leaf');
  });
});

describe('date arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-09-29', 3)).toBe('2026-10-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-09-15', 0)).toBe('2026-09-15');
  });

  it('counts whole days between two dates, signed', () => {
    expect(daysBetween('2026-09-15', '2026-12-01')).toBe(77);
    expect(daysBetween('2026-12-01', '2026-09-15')).toBe(-77);
    expect(daysBetween('2026-09-15', '2026-09-15')).toBe(0);
  });

  it('builds an inclusive range, empty when the end precedes the start', () => {
    expect(dateRange('2026-09-29', '2026-10-02'))
      .toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
    expect(dateRange('2026-09-15', '2026-09-15')).toEqual(['2026-09-15']);
    expect(dateRange('2026-09-15', '2026-09-14')).toEqual([]);
  });
});

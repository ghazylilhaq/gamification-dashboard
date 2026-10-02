import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, PRIMARY_NAV, MORE_NAV } from '@/app/nav';

describe('navigation', () => {
  it('runs in the agreed reading order', () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      'Overview', 'Trends', 'Activity', 'Blind boxes', 'Rewards', 'Budget', 'Redemption', 'Gacha', 'Admin',
    ]);
  });

  it('keeps the mobile bar to four tabs plus More', () => {
    // A fifth primary item would push "More" off the five-slot bar.
    expect(PRIMARY_NAV).toHaveLength(4);
    expect(PRIMARY_NAV.map((i) => i.label)).toEqual([
      'Overview', 'Trends', 'Activity', 'Rewards',
    ]);
  });

  it('puts the narrower views and the team area under More', () => {
    expect(MORE_NAV.map((i) => i.label)).toEqual(['Blind boxes', 'Budget', 'Redemption', 'Gacha', 'Admin']);
  });

  it('marks only the internal-team area as admin', () => {
    expect(NAV_ITEMS.filter((i) => i.admin).map((i) => i.to)).toEqual(['/admin/upload']);
  });

  it('has a route for every item and no duplicates', () => {
    const paths = NAV_ITEMS.map((i) => i.to);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.every((p) => p.startsWith('/'))).toBe(true);
  });
});

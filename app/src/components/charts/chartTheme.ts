/**
 * Shared chart styling. Colours come from the token file so a series means the
 * same thing on every page; Allo Yellow is deliberately absent because thin
 * strokes and small labels in #FFAF03 are unreadable on white.
 */
export const CHART = {
  boxClaims: 'var(--color-chart-1)',
  gachaClaims: 'var(--color-chart-2)',
  spend: 'var(--color-chart-3)',
  cashback: 'var(--color-chart-4)',
  coupon: 'var(--color-chart-5)',
  gacha: 'var(--color-type-gacha)',
  grid: 'var(--color-chart-grid)',
  axis: 'var(--color-ink-4)',
} as const;

/**
 * Daily trends. Spelled out in full rather than built from an index: Tailwind
 * only emits a theme variable whose name appears literally in the source, so
 * `var(--color-tier-${i})` would resolve to nothing.
 */

/** Stamp tiers, light to dark — an ordinal ramp, one hue. */
export const TIER_COLORS = [
  'var(--color-tier-1)',
  'var(--color-tier-2)',
  'var(--color-tier-3)',
  'var(--color-tier-4)',
  'var(--color-tier-5)',
] as const;

/** Quests, by the key questSeries gives them. The colour follows the quest. */
export const QUEST_COLORS: Record<string, string> = {
  q1: 'var(--color-quest-1)',
  q2: 'var(--color-quest-2)',
  q3: 'var(--color-quest-3)',
  q4: 'var(--color-quest-4)',
  q5: 'var(--color-quest-5)',
  other: 'var(--color-quest-other)',
};

/** Heat-table shading, fewer to more. */
export const HEAT_COLORS = [
  'var(--color-heat-1)',
  'var(--color-heat-2)',
  'var(--color-heat-3)',
  'var(--color-heat-4)',
  'var(--color-heat-5)',
] as const;

export const AXIS_PROPS = {
  stroke: CHART.axis,
  tick: { fill: 'var(--color-ink-4)', fontSize: 11 },
  tickLine: false,
} as const;

export const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 10,
    border: '1px solid var(--color-line-1)',
    boxShadow: '0 4px 12px rgb(26 26 26 / 0.08)',
    fontSize: 12,
  },
  labelStyle: { color: 'var(--color-ink-3)', fontWeight: 600, marginBottom: 4 },
} as const;

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

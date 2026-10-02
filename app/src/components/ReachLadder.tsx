import type { StampLadder } from '@/lib/metrics/claims';
import type { ReachFunnelStep, ReachTotals } from '@/lib/metrics/reach';
import { formatDateTimeWib, formatNumber, formatPercent } from '@/lib/format';

const OPENED = 'var(--color-chart-1)';
/** Warm, because these are users the campaign has not reached yet. */
const NEVER_OPENED = 'var(--color-warn)';

/** Which users the ladder counts, by blindbox_reach.is_onboard_yn. */
export type ReachView = 'all' | 'Y' | 'N';

export const REACH_VIEWS: Array<{ id: ReachView; label: string }> = [
  { id: 'all', label: 'Both' },
  { id: 'Y', label: 'Opened the page' },
  { id: 'N', label: 'Never opened' },
];

/** The figures one view of a step is built from. */
function pick(reach: ReachFunnelStep, view: ReachView) {
  switch (view) {
    case 'Y': return { reached: reach.reachedY, stopped: reach.atY };
    case 'N': return { reached: reach.reachedN, stopped: reach.atN };
    default: return { reached: reach.reached, stopped: reach.atY + reach.atN };
  }
}

/**
 * How far users have got, in the same ladder shape as the Overview's.
 *
 * Each column is one box: everyone whose stamps reach it or beyond. The view
 * narrows that to users who have opened the blindbox page (Y), users who never
 * have (N), or both — and every figure beneath the bar follows the view: the
 * count, the step-down from the box before, how many stop at this box.
 *
 * Claim rate is only shown where it means something. Users who never opened
 * the page cannot claim, so the N view has no claim rate at all.
 *
 * The all-users total sits in a strip above rather than as a column: at 318.463
 * against 20.990 for the Welcome Box it would flatten every other bar. Columns
 * are scaled to the largest box in the current view.
 */
export function ReachLadder({
  totals,
  funnel,
  ladder,
  view,
}: {
  totals: ReachTotals;
  funnel: ReachFunnelStep[];
  ladder: StampLadder;
  view: ReachView;
}) {
  const peak = Math.max(...funnel.map((s) => pick(s, view).reached), 1);
  const steps = ladder.steps.map((step, i) => ({ step, reach: funnel[i]! }));
  const showClaims = view !== 'N';

  return (
    <>
      <ActiveStrip totals={totals} view={view} />

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-micro text-ink-3">
        {view !== 'N' && <Legend color={OPENED} label="Opened the page" />}
        {view !== 'Y' && <Legend color={NEVER_OPENED} label="Never opened the page" />}
        <span className="text-ink-4">Bars count users who reached a box or beyond.</span>
      </div>

      {view === 'N' && (
        <p className="mb-3 text-micro text-ink-4">
          No claim rate here: users who have never opened the page cannot claim. Every one of them past
          the first box has earned a reward they have not seen.
        </p>
      )}
      {showClaims && ladder.dateMismatch && (
        <p className="mb-3 text-micro text-ink-4">
          Claim rates are approximate (≈): claims as of{' '}
          {formatDateTimeWib(ladder.dateMismatch.claimsAsOf)}, reach as of{' '}
          {formatDateTimeWib(ladder.dateMismatch.reachAsOf)}.
        </p>
      )}

      {/* Desktop: a column per box. */}
      <ol className="hidden gap-1 overflow-x-auto pb-2 md:flex">
        {steps.map(({ step, reach }, i) => {
          const { reached } = pick(reach, view);
          const previous = i > 0 ? pick(steps[i - 1]!.reach, view).reached : null;
          return (
            <li key={step.boxId} className="flex min-w-[6.5rem] flex-1 flex-col">
              <div className="flex h-36 flex-col justify-end">
                <StackedColumn reach={reach} view={view} heightPct={(reached / peak) * 100} />
              </div>
              <div className="mt-2 border-t border-line-1 pt-2">
                <p className={`tnum font-display text-sm font-bold ${reached ? 'text-ink-1' : 'text-ink-5'}`}>
                  {formatNumber(reached)}
                </p>
                <p className="truncate text-micro font-semibold text-ink-2" title={step.boxName}>
                  {step.boxName}
                </p>
                <p className="text-micro text-ink-4">{step.stampRequired} stamps</p>
                {reached === 0 ? (
                  <p className="mt-1 text-micro text-ink-5">Nobody yet</p>
                ) : (
                  <StepFigures reach={reach} view={view} previous={previous} step={step} showClaims={showClaims} />
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Mobile: one row per box. */}
      <ol className="space-y-1.5 md:hidden">
        {steps.map(({ step, reach }, i) => {
          const { reached } = pick(reach, view);
          const previous = i > 0 ? pick(steps[i - 1]!.reach, view).reached : null;
          return (
            <li key={step.boxId} className="rounded-control border border-line-1 px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className={`truncate font-semibold ${reached ? 'text-ink-1' : 'text-ink-5'}`}>
                    {step.boxName}
                  </p>
                  <p className="text-micro text-ink-4">{step.stampRequired} stamps</p>
                </div>
                <p className={`shrink-0 tnum font-display font-bold ${reached ? 'text-ink-1' : 'text-ink-5'}`}>
                  {formatNumber(reached)}
                </p>
              </div>
              <StackedRow reach={reach} view={view} widthPct={(reached / peak) * 100} />
              {reached > 0 && (
                <div className="mt-1.5">
                  <StepFigures reach={reach} view={view} previous={previous} step={step} showClaims={showClaims} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}

/** Everyone with a stamp — or the half of them the view is showing. */
function ActiveStrip({ totals, view }: { totals: ReachTotals; view: ReachView }) {
  const total = totals.activeUsers || 1;

  if (view !== 'all') {
    const opened = view === 'Y';
    const count = opened ? totals.onboardY : totals.onboardN;
    const eligible = opened ? totals.eligibleY : totals.eligibleN;
    return (
      <div className="mb-4 rounded-control bg-surface-2 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-micro font-semibold uppercase tracking-wide text-ink-4">
            {opened ? 'Opened the page' : 'Never opened the page'}
          </p>
          <p className="tnum font-display text-base font-bold text-ink-1">{formatNumber(count)}</p>
        </div>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-pill bg-line-2" role="img" aria-label={`${formatPercent(count / total, 1)} of all users with a stamp`}>
          <div className="h-full" style={{ width: `${(count / total) * 100}%`, background: opened ? OPENED : NEVER_OPENED }} />
        </div>
        <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-micro tnum text-ink-2">
          <span>{formatPercent(count / total, 1)} of {formatNumber(totals.activeUsers)} users with a stamp</span>
          <span>
            {formatNumber(eligible)} {opened ? 'can open at least one box' : 'have earned a box without seeing it'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-control bg-surface-2 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-micro font-semibold uppercase tracking-wide text-ink-4">All users with a stamp</p>
        <p className="tnum font-display text-base font-bold text-ink-1">{formatNumber(totals.activeUsers)}</p>
      </div>
      <div
        className="mt-2 flex h-3 w-full overflow-hidden rounded-pill bg-line-2"
        role="img"
        aria-label={`${formatNumber(totals.onboardY)} opened the page, ${formatNumber(totals.onboardN)} never opened it`}
      >
        <div style={{ width: `${(totals.onboardY / total) * 100}%`, background: OPENED }} />
        <div style={{ width: `${(totals.onboardN / total) * 100}%`, background: NEVER_OPENED }} />
      </div>
      <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-micro tnum">
        <span className="text-ink-2">
          <Dot color={OPENED} /> {formatNumber(totals.onboardY)} opened ·{' '}
          {formatPercent(totals.onboardRate, 1)}
        </span>
        <span className="text-ink-2">
          <Dot color={NEVER_OPENED} /> {formatNumber(totals.onboardN)} never opened
        </span>
      </div>
    </div>
  );
}

function StepFigures({
  reach,
  view,
  previous,
  step,
  showClaims,
}: {
  reach: ReachFunnelStep;
  view: ReachView;
  previous: number | null;
  step: StampLadder['steps'][number];
  showClaims: boolean;
}) {
  const { reached, stopped } = pick(reach, view);
  return (
    <div className="mt-1 space-y-0.5 text-micro tnum">
      {view === 'all' ? (
        <>
          <p className="text-ink-2"><Dot color={OPENED} /> {formatNumber(reach.reachedY)} opened</p>
          <p className="text-ink-2"><Dot color={NEVER_OPENED} /> {formatNumber(reach.reachedN)} never</p>
        </>
      ) : (
        // The other half's share, so a single view still says how the box divides.
        reach.reached > 0 && (
          <p className="text-ink-2">{formatPercent(reached / reach.reached, 0)} of all who reached it</p>
        )
      )}
      {previous !== null && previous > 0 && (
        <p className="font-semibold text-ink-3">{formatPercent(reached / previous, 0)} of prev.</p>
      )}
      <p className="text-ink-4">{formatNumber(stopped)} stop here</p>
      {showClaims && <ClaimRate step={step} />}
    </div>
  );
}

/**
 * Box claim rate: claims ÷ onboarded users who reached the box. Only
 * onboarded users can claim, so they are the denominator in every view.
 */
function ClaimRate({ step }: { step: StampLadder['steps'][number] }) {
  if (step.claimRate === null) {
    return <p className="text-ink-4">{formatNumber(step.claimsSinceLaunch)} claims</p>;
  }
  const rate = step.claimRate;
  return (
    <div className="pt-0.5" title="Claims ÷ onboarded users who reached this box">
      <p className="text-ink-2">
        <span className="font-semibold text-ink-1">
          {step.claimRateApproximate ? '≈' : ''}
          {formatPercent(rate, 0)}
        </span>{' '}
        claimed · {formatNumber(step.claimsSinceLaunch)}
      </p>
      <div className="mt-0.5 h-1 w-full overflow-hidden rounded-pill bg-line-2">
        <div
          className="h-full rounded-pill"
          style={{ width: `${Math.min(rate, 1) * 100}%`, background: 'var(--color-success)' }}
        />
      </div>
    </div>
  );
}

/** Shares of the bar per view: both colours for "all", one solid colour otherwise. */
function segments(reach: ReachFunnelStep, view: ReachView) {
  if (view === 'Y') return [{ share: 1, color: OPENED }];
  if (view === 'N') return [{ share: 1, color: NEVER_OPENED }];
  const opened = reach.reached > 0 ? reach.reachedY / reach.reached : 0;
  return [
    { share: opened, color: OPENED },
    { share: 1 - opened, color: NEVER_OPENED },
  ];
}

function StackedColumn({ reach, view, heightPct }: { reach: ReachFunnelStep; view: ReachView; heightPct: number }) {
  if (pick(reach, view).reached === 0) {
    return <div className="h-[4%] w-full rounded-t-control" style={{ background: 'var(--color-line-2)' }} />;
  }
  return (
    // Column stacks bottom-up: opened at the base, never opened above it.
    <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-control" style={{ height: `${Math.max(heightPct, 3)}%` }}>
      {segments(reach, view).map((seg) => (
        <div key={seg.color} style={{ flex: seg.share, background: seg.color }} />
      ))}
    </div>
  );
}

function StackedRow({ reach, view, widthPct }: { reach: ReachFunnelStep; view: ReachView; widthPct: number }) {
  const w = pick(reach, view).reached > 0 ? Math.max(widthPct, 2) : 0;
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-pill bg-line-2">
      <div className="flex h-full" style={{ width: `${w}%` }}>
        {segments(reach, view).map((seg) => (
          <div key={seg.color} style={{ flex: seg.share, background: seg.color }} />
        ))}
      </div>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span aria-hidden className="inline-block size-2 rounded-pill align-middle" style={{ background: color }} />;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Dot color={color} />
      {label}
    </span>
  );
}

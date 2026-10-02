import type { LadderStep, StampLadder as Ladder } from '@/lib/metrics/claims';
import { formatDateTimeWib, formatNumber, formatPercent } from '@/lib/format';
import { NeutralBadge } from './ui/Badge';

/**
 * The climb from opening the blindbox page to the 300-stamp box.
 *
 * With reach data each step is the number of onboarded users whose stamps get
 * them that far, with claims and conversion beneath. Without it, box claims.
 *
 * Horizontal on desktop, vertical on mobile — the same data laid out along
 * whichever axis has room for twelve steps and their labels.
 */
export function StampLadder({ ladder }: { ladder: Ladder }) {
  const reach = ladder.basis === 'reach';
  const headline = (s: LadderStep) => (reach ? (s.reachedY ?? 0) : s.claims);
  const peak = Math.max(ladder.onboard?.value ?? 0, ...ladder.steps.map(headline), 1);

  return (
    <>
      {reach && (
        <p className="mb-3 text-micro text-ink-3">
          Bars are <strong className="text-ink-2">onboarded users who have reached each box</strong>,
          with claims beneath.
          {ladder.dateMismatch && (
            <>
              {' '}Claim rates are approximate (≈): claims are as of{' '}
              {formatDateTimeWib(ladder.dateMismatch.claimsAsOf)} and reach as of{' '}
              {formatDateTimeWib(ladder.dateMismatch.reachAsOf)}. Upload same-day files for an exact rate.
            </>
          )}
        </p>
      )}

      {/* Desktop: a horizontal row of steps. */}
      <ol className="hidden gap-1 overflow-x-auto pb-2 md:flex">
        {ladder.onboard && (
          <FunnelStep
            title="User onboard"
            meta="opened the page"
            value={ladder.onboard.value}
            heightPct={100}
            footnote={`as of ${formatDateTimeWib(ladder.onboard.asOf)}`}
            emphasis
          />
        )}
        {ladder.steps.map((step) => (
          <FunnelStep
            key={step.boxId}
            title={step.boxName}
            meta={`${step.stampRequired} stamps`}
            value={headline(step)}
            heightPct={(headline(step) / peak) * 100}
            step={step}
            reach={reach}
          />
        ))}
      </ol>

      {/* Mobile: the same ladder turned vertical. */}
      <ol className="space-y-1.5 md:hidden">
        {ladder.onboard && (
          <VerticalStep
            title="User onboard"
            meta="opened the page"
            value={ladder.onboard.value}
            widthPct={100}
            emphasis
          />
        )}
        {ladder.steps.map((step) => (
          <VerticalStep
            key={step.boxId}
            title={step.boxName}
            meta={`${step.stampRequired} stamps`}
            value={headline(step)}
            widthPct={(headline(step) / peak) * 100}
            step={step}
            reach={reach}
          />
        ))}
      </ol>
    </>
  );
}

interface StepProps {
  title: string;
  meta: string;
  value: number;
  step?: LadderStep;
  reach?: boolean;
  emphasis?: boolean;
  footnote?: string;
}

/** Claims, conversion and step-down, under the headline figure. */
function StepDetail({ step, reach }: { step: LadderStep; reach: boolean }) {
  if (step.notReached) return <p className="mt-1 text-micro text-ink-5">Not reached yet</p>;
  return (
    <>
      {step.stepDownPct !== null && (
        <p className="mt-1 text-micro font-semibold tnum text-ink-3">
          {formatPercent(step.stepDownPct, 0)} of prev.
        </p>
      )}
      {reach && (
        <p className="text-micro tnum text-ink-4">
          {/* Since launch when a rate is shown, so the two numbers agree. */}
          {formatNumber(step.claimRate !== null ? step.claimsSinceLaunch : step.claims)} claims
          {step.claimRate !== null && (
            <>
              {' · '}
              {step.claimRateApproximate ? '≈' : ''}
              {formatPercent(step.claimRate, 0)} claimed
            </>
          )}
        </p>
      )}
    </>
  );
}

function FunnelStep({ heightPct, ...p }: StepProps & { heightPct: number }) {
  const muted = p.step?.notReached;
  return (
    <li className="flex min-w-[5.5rem] flex-1 flex-col">
      <div className="flex h-32 items-end">
        <div
          className="w-full rounded-t-control transition-all"
          style={{
            height: `${Math.max(heightPct, muted ? 4 : 6)}%`,
            background: muted
              ? 'var(--color-line-2)'
              : p.emphasis
                ? 'var(--color-allo-yellow)'
                : 'var(--color-chart-1)',
          }}
        />
      </div>
      <div className="mt-2 border-t border-line-1 pt-2">
        <p className={`tnum font-display text-sm font-bold ${muted ? 'text-ink-5' : 'text-ink-1'}`}>
          {formatNumber(p.value)}
        </p>
        <p className="truncate text-micro font-semibold text-ink-2" title={p.title}>
          {p.title}
        </p>
        <p className="text-micro text-ink-4">{p.meta}</p>
        {p.step && <StepDetail step={p.step} reach={Boolean(p.reach)} />}
        {p.footnote && <p className="mt-1 text-micro text-ink-4">{p.footnote}</p>}
      </div>
    </li>
  );
}

function VerticalStep({ widthPct, ...p }: StepProps & { widthPct: number }) {
  const muted = p.step?.notReached;
  return (
    <li className="rounded-control border border-line-1 px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className={`truncate font-semibold ${muted ? 'text-ink-5' : 'text-ink-1'}`}>{p.title}</p>
          <p className="text-micro text-ink-4">{p.meta}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`tnum font-display font-bold ${muted ? 'text-ink-5' : 'text-ink-1'}`}>
            {formatNumber(p.value)}
          </p>
          {muted ? (
            <NeutralBadge>Not reached yet</NeutralBadge>
          ) : (
            p.step && <StepDetail step={p.step} reach={Boolean(p.reach)} />
          )}
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-line-2">
        <div
          className="h-full rounded-pill"
          style={{
            width: `${Math.max(widthPct, muted ? 0 : 2)}%`,
            background: p.emphasis ? 'var(--color-allo-yellow)' : 'var(--color-chart-1)',
          }}
        />
      </div>
    </li>
  );
}

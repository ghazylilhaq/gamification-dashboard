import { useMemo, useState } from 'react';
import { useDashboard } from '@/hooks/useDashboard';
import { FirstRun } from '@/components/FirstRun';
import { Card, SectionHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Drawer } from '@/components/ui/Drawer';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';
import { RarityBadge, TypeBadge, WarningBadge, NeutralBadge } from '@/components/ui/Badge';
import { StockBar } from '@/components/StockAlerts';
import { StampLadder } from '@/components/StampLadder';
import { OddsDeviation, OddsVerdictBadge } from '@/components/OddsBar';
import { DataNote, EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { freshnessText } from '@/components/Freshness';
import { boxSummaries, MIN_CLAIMS_FOR_ODDS, type BoxSummary } from '@/lib/metrics/boxes';
import { stampLadder } from '@/lib/metrics/claims';
import { formatNumber, formatPercent, formatRupiah } from '@/lib/format';
import { DownloadButton } from '@/components/DownloadButton';
import { boxColumns, boxRewardColumns } from '@/lib/csv/columns';
import { exportName } from '@/lib/csv/exportContext';
import { csvFileName } from '@/lib/csv/export';

export function Catalog() {
  const { dataset, loading, error, reload, raw, hasAnyData, filter } = useDashboard();
  const [openBoxId, setOpenBoxId] = useState<number | null>(null);

  const boxes = useMemo(() => (dataset ? boxSummaries(dataset) : []), [dataset]);
  const openBox = boxes.find((b) => b.boxId === openBoxId) ?? null;

  if (loading) {
    return (
      <>
        <PageHeader title="Blind boxes" description="What is in each box and how it is performing" />
        <Card className="mb-4"><Skeleton className="h-40" /></Card>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Card key={i}><Skeleton className="h-48" /></Card>
          ))}
        </div>
      </>
    );
  }
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!dataset || !raw) return null;
  if (!hasAnyData || boxes.length === 0) return <FirstRun page="Blind boxes" />;

  const badWeights = boxes.filter((b) => b.weightWarning);
  const drifting = boxes.filter((b) => b.oddsVerdict === 'off-target');
  const judged = boxes.filter((b) => b.oddsVerdict !== 'insufficient');
  const ladder = stampLadder(dataset);

  return (
    <>
      <PageHeader
        title="Blind boxes"
        description="Each box, what is inside it, how much stock it holds, and whether its drop odds are behaving."
        freshness={freshnessText(raw.freshness, ['claims', 'spend'])}
        action={
          <DownloadButton
            fileName={exportName('blind-boxes', filter)}
            columns={boxColumns}
            rows={boxes}
            label="CSV"
          />
        }
      />

      {/* How far users are climbing — the context for everything below. */}
      <Card label="Stamp ladder" className="mb-4">
        <SectionHeader
          title="How far users are getting"
          description={
            ladder.basis === 'reach'
              ? 'Onboarded users reaching each box, with claims'
              : 'Claims per box since launch, ordered by stamps required'
          }
          freshness={freshnessText(raw.freshness, ['claims', 'reach'])}
        />
        <StampLadder ladder={ladder} />
      </Card>

      {drifting.length > 0 && (
        <div className="mb-4">
          <DataNote>
            <strong>
              {drifting.length} box{drifting.length === 1 ? '' : 'es'} {drifting.length === 1 ? 'has' : 'have'} a
              reward dropping at a rate chance does not explain:
            </strong>{' '}
            {drifting.map((b) => b.name).join(', ')}. Open the box to see which reward.
          </DataNote>
        </div>
      )}

      {drifting.length === 0 && judged.length > 0 && (
        <div className="mb-4">
          <DataNote tone="info">
            <strong>Drop odds look healthy.</strong> Across the{' '}
            {formatNumber(judged.length)} box{judged.length === 1 ? '' : 'es'} with enough claims to
            judge, no reward is landing further from its configured weight than sampling noise
            explains. Boxes below {MIN_CLAIMS_FOR_ODDS} claims are not assessed at all.
          </DataNote>
        </div>
      )}

      {badWeights.length > 0 && (
        <div className="mb-4">
          <DataNote>
            <strong>
              {badWeights.length} box{badWeights.length === 1 ? "'s" : 'es’'} configured odds do not
              sum to 100:
            </strong>{' '}
            {badWeights.map((b) => `${b.name} (${formatWeight(b.weightSum)})`).join(', ')}. That is a
            campaign config issue, not something the dashboard can fix.
          </DataNote>
        </div>
      )}

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {boxes.map((box) => (
          <li key={box.boxId}>
            <BoxCard box={box} onOpen={() => setOpenBoxId(box.boxId)} />
          </li>
        ))}
      </ul>

      <Drawer
        open={openBox !== null}
        title={openBox?.name ?? ''}
        subtitle={
          openBox && (
            <>
              <span className="font-mono">ID {openBox.boxId}</span> ·{' '}
              {formatNumber(openBox.stampRequired)} stamps · {formatNumber(openBox.rewardCount)}{' '}
              rewards · {formatNumber(openBox.claims)} claims
            </>
          )
        }
        onClose={() => setOpenBoxId(null)}
      >
        {openBox && <BoxDetail box={openBox} />}
      </Drawer>
    </>
  );
}

function BoxCard({ box, onOpen }: { box: BoxSummary; onOpen: () => void }) {
  const notReached = box.claims === 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${box.name}, ID ${box.boxId}, ${box.stampRequired} stamps, ${box.rewardCount} rewards, ${box.claims} claims`}
      className="flex h-full w-full flex-col rounded-card border border-line-1 bg-surface-1 p-3 text-left shadow-card transition-shadow hover:shadow-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-allo-yellow"
    >
      <div className="mb-2.5 flex items-center justify-center rounded-control bg-surface-2 p-2">
        <ImageWithFallback
          src={box.imageUrl}
          alt={box.name}
          fallbackLabel={box.name}
          className={`h-16 w-full ${notReached ? 'opacity-40' : ''}`}
        />
      </div>

      <p className={`font-semibold ${notReached ? 'text-ink-4' : 'text-ink-1'}`}>{box.name}</p>
      <p className="mt-0.5 text-micro text-ink-4">
        {/* The box id, so a row here can be matched against the raw exports.
            This is blindbox.id / blind_box_id2 (13-24), not the 1-12 value the
            spend files carry in a column of the same name. */}
        <span className="font-mono text-ink-3" title="blindbox.id — matches blind_box_id2 in the claim files">
          ID {box.boxId}
        </span>{' '}
        · {formatNumber(box.stampRequired)} stamps · {formatNumber(box.rewardCount)} rewards
      </p>

      <dl className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-line-2 pt-2">
        <div>
          <dt className="text-micro text-ink-4">Claims</dt>
          <dd className={`tnum font-semibold ${notReached ? 'text-ink-5' : 'text-ink-1'}`}>
            {formatNumber(box.claims)}
          </dd>
        </div>
        <div>
          <dt className="text-micro text-ink-4">Spend</dt>
          <dd className="tnum font-semibold text-ink-1">{formatRupiah(box.spend)}</dd>
        </div>
      </dl>

      {/* Box stock, then the scarcest single reward — the total alone hides it. */}
      <div className="mt-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-micro text-ink-4">Stock left</span>
          <span className="tnum text-micro font-semibold text-ink-2">
            {box.stockLeftPct === null ? '—' : formatPercent(box.stockLeftPct, 1)}
          </span>
        </div>
        <StockBar
          status={box.stockAlertCount > 0 ? 'warning' : 'ok'}
          leftPct={box.stockLeftPct}
          className="mt-1"
        />
        <p className="mt-1 truncate text-micro text-ink-4">
          {formatNumber(box.stockDistributed)} of {formatNumber(box.stockTotal)} used
          {box.worstReward && (
            <>
              {' · lowest '}
              <span className={box.worstReward.status === 'ok' ? '' : 'font-semibold text-warn'}>
                {formatPercent(box.worstReward.leftPct, 0)}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="mt-auto flex flex-wrap gap-1.5 pt-2.5">
        <OddsVerdictBadge verdict={box.oddsVerdict} />
        {box.weightWarning && <WarningBadge>Odds sum {formatWeight(box.weightSum)}</WarningBadge>}
        {box.stockAlertCount > 0 && (
          <WarningBadge>
            {box.stockAlertCount} low stock
          </WarningBadge>
        )}
      </div>
    </button>
  );
}

function BoxDetail({ box }: { box: BoxSummary }) {
  return (
    <>
      <dl className="mb-4 grid grid-cols-2 gap-3 rounded-control bg-surface-2 p-3">
        <Stat label="Claims" value={formatNumber(box.claims)} />
        <Stat label="Spend" value={formatRupiah(box.spend)} />
        <Stat
          label="Stock left"
          value={box.stockLeftPct === null ? '—' : formatPercent(box.stockLeftPct, 1)}
          hint={`${formatNumber(box.stockDistributed)} of ${formatNumber(box.stockTotal)} used`}
        />
        <Stat
          label="Rewards claimed"
          value={`${formatNumber(box.rewardsClaimed)} of ${formatNumber(box.rewardCount)}`}
        />
      </dl>

      {box.worstReward && box.worstReward.status !== 'ok' && (
        <div className="mb-4">
          <DataNote>
            <strong>{box.worstReward.name}</strong> is the scarcest reward here at{' '}
            {formatPercent(box.worstReward.leftPct, 0)} left, even though the box as a whole reads{' '}
            {box.stockLeftPct === null ? '—' : formatPercent(box.stockLeftPct, 1)}.
          </DataNote>
        </div>
      )}

      {box.weightWarning && (
        <div className="mb-4">
          <DataNote>
            Configured odds sum to {formatWeight(box.weightSum)}, not 100, so every listed chance
            below is approximate.
          </DataNote>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-bold text-ink-1">Drop odds vs. actual</h3>
        <div className="flex items-center gap-2">
          <OddsVerdictBadge verdict={box.oddsVerdict} />
          <DownloadButton
            fileName={csvFileName('box-rewards', [box.name, String(box.boxId)])}
            columns={boxRewardColumns}
            rows={box.rewards}
          />
        </div>
      </div>

      {box.oddsVerdict === 'insufficient' ? (
        <div className="mb-4">
          <DataNote tone="info">
            {box.claims === 0
              ? 'Nobody has reached this box yet, so there is nothing to compare against.'
              : `Only ${formatNumber(box.claims)} claims so far — under ${MIN_CLAIMS_FOR_ODDS}, an observed share is mostly noise, so no verdict is given.`}
          </DataNote>
        </div>
      ) : (
        <p className="mb-3 text-micro text-ink-4">
          &ldquo;Set&rdquo; is the configured weight, &ldquo;got&rdquo; is the share users actually
          received. A gap is only flagged once it is larger than sampling noise explains at this
          claim count.
        </p>
      )}

      <div className="mb-3">
        <DataNote tone="info">
          <strong>Two bases per row.</strong> Claimed is the selected date range, from the daily
          claims export. Redeemed, rate and spend are cumulative, from the latest spend snapshot, so
          a narrowed range can show fewer claims than redemptions.
        </DataNote>
      </div>

      <ul className="space-y-3.5">
        {box.rewards.map((reward) => (
          <li key={reward.rewardId} className="border-b border-line-2 pb-3.5 last:border-b-0 last:pb-0">
            <div className="flex gap-3">
              <ImageWithFallback
                src={reward.imageUrl}
                alt={reward.name}
                fallbackLabel={reward.name}
                className="size-11 shrink-0 rounded-control"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-semibold text-ink-1" title={reward.name}>
                    {reward.name}
                  </p>
                  {reward.verdict !== 'on-target' && reward.verdict !== 'insufficient' && (
                    <OddsVerdictBadge verdict={reward.verdict} />
                  )}
                </div>
                {/* blindbox_reward.id — the key the claim and spend exports
                    join on, so a row here can be traced back to the raw data. */}
                <p
                  className="mt-0.5 font-mono text-micro text-ink-4"
                  title="blindbox_reward.id — reward_id in the claim files, id in the spend files"
                >
                  ID {reward.rewardId}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <RarityBadge rarity={reward.rarity} />
                  <TypeBadge type={reward.type} />
                  {reward.status === 'PENDING' && <NeutralBadge>Pending</NeutralBadge>}
                  {reward.value ? (
                    <span className="text-micro text-ink-3">{formatRupiah(reward.value)}</span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-2.5 space-y-2.5">
              {/* Odds read as two numbers rather than two bars, so the single
                  bar in the row is stock — the thing that actually runs out. */}
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-micro text-ink-4">
                  Odds{' '}
                  <span className="tnum text-ink-2">{formatOdds(reward.weight)}</span> set ·{' '}
                  <span className="tnum font-semibold text-ink-1">
                    {reward.actualPct === null ? '—' : formatOdds(reward.actualPct)}
                  </span>{' '}
                  got
                </span>
                <OddsDeviation row={reward} />
              </div>

              <dl className="grid grid-cols-3 gap-2 border-t border-line-2 pt-2">
                <MiniStat label="Claimed" value={formatNumber(reward.claims)} hint="range" />
                <MiniStat
                  label="Redeemed"
                  value={reward.type === 'CASHBACK' ? 'auto' : formatNumber(reward.redeemed)}
                  hint={
                    reward.type === 'CASHBACK'
                      ? 'credited'
                      : reward.redemptionRate === null
                        ? 'no rate yet'
                        : `${formatPercent(reward.redemptionRate)} of ${formatNumber(reward.couponClaimed)}`
                  }
                />
                <MiniStat label="Spend" value={formatRupiah(reward.spend)} hint="total" />
              </dl>

              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-micro text-ink-4">Stock left</span>
                  <span className="tnum text-micro text-ink-4">
                    {reward.stockLeftPct === null
                      ? 'no stock set'
                      : `${formatPercent(reward.stockLeftPct, 0)} · ${formatNumber(reward.stockDistributed)}/${formatNumber(reward.stockTotal)} used`}
                  </span>
                </div>
                {reward.stockLeftPct !== null && (
                  <StockBar status={reward.stockStatus} leftPct={reward.stockLeftPct} className="mt-1" />
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The reward-row version of Stat: same shape, sized for a three-up grid. */
function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-micro text-ink-4">{label}</dt>
      <dd className="tnum font-semibold text-ink-1">{value}</dd>
      {hint && <dd className="truncate text-micro text-ink-4">{hint}</dd>}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-micro text-ink-4">{label}</dt>
      <dd className="tnum font-display text-base font-bold text-ink-1">{value}</dd>
      {hint && <dd className="text-micro text-ink-4">{hint}</dd>}
    </div>
  );
}

/** Drop odds are percentages already, and only carry decimals when they need to. */
function formatOdds(pct: number): string {
  return formatPercent(pct / 100, pct % 1 === 0 ? 0 : 2);
}

function formatWeight(sum: number): string {
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(sum)}%`;
}

export function EmptyCatalog() {
  return <EmptyState title="No boxes configured" />;
}

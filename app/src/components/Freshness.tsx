import { useDashboard } from '@/hooks/useDashboard';
import { formatTimeWib } from '@/lib/format';
import type { Freshness } from '@/lib/types';

/**
 * "Claims as of 12:36 WIB · Spend as of 13:51 WIB".
 *
 * The five exports are pulled at different times, so the header states all of
 * them and each panel restates the one it depends on.
 */
export function FreshnessLine({ sources = ['claims', 'spend', 'gacha'] }: { sources?: Source[] }) {
  const { raw } = useDashboard();
  if (!raw) return null;

  const parts = sources
    .map((s) => {
      const stamp = SOURCE_MAP[s](raw.freshness);
      return stamp ? `${LABELS[s]} as of ${formatTimeWib(stamp)}` : null;
    })
    .filter(Boolean);

  if (parts.length === 0) return null;
  return <>{parts.join(' · ')}</>;
}

export type Source = 'claims' | 'spend' | 'gacha' | 'dailySpend' | 'reach' | 'activity';

const LABELS: Record<Source, string> = {
  claims: 'Claims',
  spend: 'Spend',
  gacha: 'Gacha',
  dailySpend: 'Daily spend',
  reach: 'Reach',
  activity: 'Activity',
};

const SOURCE_MAP: Record<Source, (f: Freshness) => string | null> = {
  claims: (f) => f.reward_snapshot ?? f.daily_rewards ?? null,
  spend: (f) => f.spend_snapshot ?? null,
  gacha: (f) => f.daily_gacha ?? null,
  dailySpend: (f) => f.daily_spend ?? null,
  reach: (f) => f.reach_snapshot ?? null,
  activity: (f) => f.activity_snapshot ?? null,
};

/** Convenience for a panel that depends on exactly one source. */
export function freshnessText(
  freshness: Freshness,
  sources: Source[],
): string | undefined {
  const parts = sources
    .map((s) => {
      const stamp = SOURCE_MAP[s](freshness);
      return stamp ? `${LABELS[s]} as of ${formatTimeWib(stamp)}` : null;
    })
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

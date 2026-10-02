import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { api, type BootstrapResponse } from '@/lib/api';
import { buildDataset, type DataFilter, type Dataset } from '@/lib/metrics/dataset';
import { LAUNCH_DATE } from '@/config/fileTypes';

interface DashboardState {
  loading: boolean;
  error: string | null;
  raw: BootstrapResponse | null;
  /** Null until the data has loaded. */
  dataset: Dataset | null;
  filter: DataFilter;
  setShowTestData: (value: boolean) => void;
  setRange: (from: string | null, to: string | null) => void;
  /** Earliest and latest dates present in the data, for the range picker. */
  bounds: { min: string; max: string } | null;
  /**
   * False on a freshly created database, before anything has been uploaded.
   * Pages show a first-run state rather than a dozen separate empty panels.
   */
  hasAnyData: boolean;
  reload: () => void;
}

const DashboardContext = createContext<DashboardState | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [raw, setRaw] = useState<BootstrapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<DataFilter>({ showTestData: false, from: null, to: null });

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .bootstrap()
      .then((data) => setRaw(data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  // The whole campaign is a few thousand rows, so every filter change is just
  // a recompute here — no refetch, no loading state.
  const dataset = useMemo(() => (raw ? buildDataset(raw, filter) : null), [raw, filter]);

  const bounds = useMemo(() => {
    if (!raw) return null;
    const dates = [
      ...raw.dailyRewards.map((r) => r.claim_date),
      ...raw.dailyGacha.map((r) => r.claim_date),
      ...raw.dailySpend.map((r) => r.date),
    ].sort();
    const min = filter.showTestData ? dates[0] : LAUNCH_DATE;
    return dates.length ? { min: min ?? LAUNCH_DATE, max: dates[dates.length - 1]! } : null;
  }, [raw, filter.showTestData]);

  const hasAnyData = Boolean(
    raw && (raw.boxes.length > 0 || raw.rewards.length > 0 || raw.dailyRewards.length > 0),
  );

  const value: DashboardState = {
    loading,
    error,
    raw,
    dataset,
    filter,
    bounds,
    hasAnyData,
    setShowTestData: (showTestData) =>
      // Clearing the range avoids a confusing empty view when the picker is
      // still narrowed to pre-launch dates that just got hidden.
      setFilter((f) => ({ ...f, showTestData, from: null, to: null })),
    setRange: (from, to) => setFilter((f) => ({ ...f, from, to })),
    reload: load,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardState {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used inside a DashboardProvider');
  return ctx;
}

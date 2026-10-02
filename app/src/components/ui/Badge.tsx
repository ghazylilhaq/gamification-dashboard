import type { ReactNode } from 'react';
import type { StockStatus } from '@/lib/metrics/stock';

/**
 * One colour mapping for each categorical scale, used identically on every
 * page so a colour always means the same thing.
 */

const RARITY: Record<string, { label: string; className: string }> = {
  COMMON: { label: 'Common', className: 'bg-rarity-common-bg text-rarity-common' },
  RARE: { label: 'Rare', className: 'bg-rarity-rare-bg text-rarity-rare' },
  SUPER_RARE: { label: 'Super Rare', className: 'bg-rarity-super-bg text-rarity-super' },
};

const REWARD_TYPE: Record<string, { label: string; className: string }> = {
  CASHBACK: { label: 'Cashback', className: 'bg-type-cashback-bg text-type-cashback' },
  COUPON: { label: 'Coupon', className: 'bg-type-coupon-bg text-type-coupon' },
  GACHA: { label: 'Gacha', className: 'bg-type-gacha-bg text-type-gacha' },
};

const STOCK: Record<StockStatus, { label: string; className: string }> = {
  ok: { label: 'OK', className: 'bg-success-bg text-success' },
  warning: { label: 'Low stock', className: 'bg-warn-bg text-warn' },
  out: { label: 'Out', className: 'bg-danger-bg text-danger' },
  'no-stock': { label: 'No stock set', className: 'bg-line-2 text-ink-4' },
};

function Pill({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-pill px-2 py-0.5 text-micro font-semibold whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

export function RarityBadge({ rarity }: { rarity: string }) {
  const meta = RARITY[rarity] ?? { label: rarity, className: 'bg-line-2 text-ink-3' };
  return <Pill className={meta.className}>{meta.label}</Pill>;
}

export function TypeBadge({ type }: { type: string }) {
  const meta = REWARD_TYPE[type] ?? { label: type, className: 'bg-line-2 text-ink-3' };
  return <Pill className={meta.className}>{meta.label}</Pill>;
}

export function StockBadge({ status }: { status: StockStatus }) {
  return <Pill className={STOCK[status].className}>{STOCK[status].label}</Pill>;
}

export function WarningBadge({ children }: { children: ReactNode }) {
  return <Pill className="bg-warn-bg text-warn">{children}</Pill>;
}

export function NeutralBadge({ children }: { children: ReactNode }) {
  return <Pill className="bg-line-2 text-ink-3">{children}</Pill>;
}

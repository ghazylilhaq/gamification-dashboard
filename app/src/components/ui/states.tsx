import type { ReactNode } from 'react';
import { Card } from './Card';
import { Button } from './Button';

/** A neutral placeholder with the same footprint as the content it replaces. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-control bg-line-2 ${className}`} />;
}

export function LoadingCard({ lines = 3 }: { lines?: number }) {
  return (
    <Card>
      <Skeleton className="mb-3 h-4 w-32" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="mb-2 h-3" />
      ))}
    </Card>
  );
}

export function LoadingKpis({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <Skeleton className="mb-3 h-3 w-20" />
          <Skeleton className="mb-2 h-7 w-24" />
          <Skeleton className="h-3 w-16" />
        </Card>
      ))}
    </div>
  );
}

/**
 * Nothing to show, and that is a legitimate state rather than a fault —
 * so it explains why and, where possible, what to do about it.
 */
export function EmptyState({
  title,
  description,
  action,
  icon = '—',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-control border border-dashed border-line-1 px-6 py-10 text-center">
      <span aria-hidden className="mb-2 text-lg text-ink-5">{icon}</span>
      <p className="font-semibold text-ink-2">{title}</p>
      {description && <p className="mt-1 max-w-sm text-ink-4">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-control border border-danger/25 bg-danger-bg px-4 py-4 text-center sm:text-left"
    >
      <p className="font-semibold text-danger">{title}</p>
      <p className="mt-1 text-ink-2">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * A standing caveat about the data itself, as opposed to an error. Used for
 * the known daily-spend gap and for partial days.
 */
export function DataNote({
  tone = 'warn',
  children,
}: {
  tone?: 'warn' | 'info';
  children: ReactNode;
}) {
  const styles =
    tone === 'warn'
      ? 'border-warn/25 bg-warn-bg text-ink-2'
      : 'border-info/25 bg-info-bg text-ink-2';
  return (
    <p className={`rounded-control border px-3 py-2 text-micro leading-relaxed ${styles}`}>
      {children}
    </p>
  );
}

import type { ReactNode } from 'react';

/** Page title, one-line purpose, and the freshness of the data behind it. */
export function PageHeader({
  title,
  description,
  freshness,
  action,
}: {
  title: string;
  description: string;
  freshness?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-bold text-ink-1">{title}</h1>
        <p className="mt-0.5 text-ink-3">{description}</p>
        {freshness && <p className="mt-0.5 text-micro text-ink-4">{freshness}</p>}
      </div>
      {action}
    </header>
  );
}

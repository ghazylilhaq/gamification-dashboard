import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  padded = true,
  label,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  /** Accessible name, so assistive tech can navigate between panels. */
  label?: string;
}) {
  return (
    <section
      aria-label={label}
      className={`rounded-card border border-line-1 bg-surface-1 shadow-card ${padded ? 'p-4 sm:p-5' : ''} ${className}`}
    >
      {children}
    </section>
  );
}

/**
 * A section heading with its own data-freshness line. Every panel names the
 * export it was built from, because the five files are pulled at different
 * times of day and a number is not interpretable without knowing which.
 */
export function SectionHeader({
  title,
  freshness,
  action,
  description,
}: {
  title: string;
  freshness?: string;
  action?: ReactNode;
  description?: string;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-base font-bold text-ink-1 sm:text-lg">{title}</h2>
        {description && <p className="mt-0.5 text-ink-3">{description}</p>}
        {freshness && <p className="mt-0.5 text-micro text-ink-4">{freshness}</p>}
      </div>
      {action}
    </header>
  );
}

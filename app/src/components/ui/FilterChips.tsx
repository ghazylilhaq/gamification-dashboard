export interface ChipOption<T extends string | number> {
  value: T;
  label: string;
  count?: number;
}

/**
 * A row of filter chips. `null` is the "all" state and is always offered
 * first, so there is a way back to the unfiltered view.
 *
 * The chips wrap rather than scroll: a hidden chip is a filter nobody knows is
 * there, and a dozen boxes do not fit on one line on a phone.
 */
export function FilterChips<T extends string | number>({
  legend,
  options,
  selected,
  onChange,
  allLabel = 'All',
  className = '',
}: {
  legend: string;
  options: ChipOption<T>[];
  selected: T | null;
  onChange: (value: T | null) => void;
  allLabel?: string;
  /** Usually `grow`, to give a long chip row the width before it wraps. */
  className?: string;
}) {
  return (
    <fieldset className={`min-w-0 ${className}`}>
      <legend className="mb-1.5 text-micro font-semibold uppercase tracking-wide text-ink-4">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        <Chip active={selected === null} onClick={() => onChange(null)}>
          {allLabel}
        </Chip>
        {options.map((o) => (
          <Chip key={String(o.value)} active={selected === o.value} onClick={() => onChange(o.value)}>
            {o.label}
            {o.count !== undefined && (
              <span className={`ml-1 tnum ${selected === o.value ? 'text-ink-2' : 'text-ink-4'}`}>
                {o.count}
              </span>
            )}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`shrink-0 rounded-pill border px-3 py-1.5 font-semibold whitespace-nowrap transition-colors ${
        active
          ? 'border-allo-yellow bg-allo-yellow-tint text-ink-1'
          : 'border-line-1 bg-surface-1 text-ink-3 hover:border-ink-5 hover:text-ink-1'
      }`}
    >
      {children}
    </button>
  );
}

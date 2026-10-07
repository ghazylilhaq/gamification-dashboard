import { useId } from 'react';

/**
 * A text filter for a table, built to stand next to `FilterChips` in the same
 * filter row: same legend treatment, same control styling as `SortSelect`.
 *
 * It is a narrowing control like the chips, not a separate mode — the caller
 * filters its rows before sorting them, so the table, the phone card list and
 * the CSV export all narrow together.
 */
export function SearchInput({
  value,
  onChange,
  legend = 'Search',
  placeholder = 'Name, ID, merchant…',
  hint,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  legend?: string;
  placeholder?: string;
  /** Usually the match count, so a screen reader hears what survived. */
  hint?: string;
  className?: string;
}) {
  const id = useId();

  return (
    <div className={`min-w-0 ${className}`}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-micro font-semibold uppercase tracking-wide text-ink-4"
      >
        {legend}
      </label>
      <div className="relative">
        <span aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4">
          ⌕
        </span>
        <input
          id={id}
          type="search"
          value={value}
          placeholder={placeholder}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange(e.target.value)}
          // Escape clears rather than closing anything, since there is no
          // panel here — the fastest way back to the full list.
          onKeyDown={(e) => {
            if (e.key === 'Escape' && value !== '') {
              e.preventDefault();
              onChange('');
            }
          }}
          className="w-full rounded-control border border-line-1 bg-surface-1 py-1.5 pl-7 pr-8 text-ink-1 placeholder:text-ink-5 focus:border-ink-5 focus:outline-none"
        />
        {value !== '' && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onChange('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-control px-1.5 py-0.5 text-ink-4 hover:text-ink-1"
          >
            ✕
          </button>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} aria-live="polite" className="mt-1 text-micro text-ink-4">
          {hint}
        </p>
      )}
    </div>
  );
}

import { Chip } from './FilterChips';

/**
 * Independent on/off chips, for a filter where several options can be live at
 * once. Nothing selected means "no filter" rather than "nothing" — callers
 * read an empty array as the combined view, which is why there is no separate
 * "all" chip to get back to: switching every chip off is that state.
 */
export function ToggleChips<T extends string>({
  legend,
  options,
  selected,
  onChange,
  hint,
  className = '',
}: {
  legend: string;
  options: Array<{ value: T; label: string }>;
  selected: T[];
  onChange: (values: T[]) => void;
  /** Shown beside the legend — usually what an empty selection means. */
  hint?: string;
  className?: string;
}) {
  const toggle = (value: T) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <fieldset className={`min-w-0 ${className}`}>
      <legend className="mb-1.5 text-micro font-semibold uppercase tracking-wide text-ink-4">
        {legend}
        {hint && <span className="ml-1.5 font-normal normal-case tracking-normal">{hint}</span>}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Chip key={o.value} active={selected.includes(o.value)} onClick={() => toggle(o.value)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

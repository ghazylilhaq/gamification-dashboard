import { Chip } from './FilterChips';

/**
 * A short, mutually exclusive choice — two or three options, always one
 * selected. Unlike FilterChips there is no "all" state to return to.
 *
 * A group of pressed-state buttons rather than a radiogroup: the chips carry
 * aria-pressed, which is toggle-button semantics and would be invalid on a
 * radio.
 */
export function SegmentedControl<T extends string>({
  legend,
  options,
  selected,
  onChange,
  className = '',
}: {
  legend: string;
  options: Array<{ value: T; label: string }>;
  selected: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={legend} className={`flex gap-1.5 ${className}`}>
      {options.map((o) => (
        <Chip key={o.value} active={selected === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

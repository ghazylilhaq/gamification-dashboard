import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  // Allo Yellow carries the primary action. Ink text on yellow, never white —
  // white on #FFAF03 fails contrast.
  primary: 'bg-allo-yellow text-ink-1 hover:bg-allo-yellow-tint disabled:bg-line-1 disabled:text-ink-5',
  secondary: 'border border-line-1 bg-surface-1 text-ink-2 hover:bg-surface-3 disabled:text-ink-5',
  ghost: 'text-ink-3 hover:bg-surface-3 hover:text-ink-1',
  danger: 'bg-danger text-white hover:opacity-90',
};

export function Button({
  variant = 'secondary',
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-control px-3 py-2 font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * A side panel for detail that would otherwise need its own page.
 *
 * Slides in from the right on desktop and up from the bottom on a phone, where
 * a full-height right-hand panel would leave no room for the list behind it.
 */
export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape closes, and focus moves into the panel so a keyboard user is not
  // left behind in the list.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink-1/25" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-card bg-surface-1 shadow-panel sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[28rem] sm:max-h-none sm:rounded-none"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line-1 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-ink-1">{title}</h2>
            {subtitle && <div className="mt-0.5 text-micro text-ink-3">{subtitle}</div>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="-mr-1 shrink-0 rounded-control px-2 py-1 text-ink-3 hover:bg-surface-3 hover:text-ink-1"
          >
            Close
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
      </div>
    </>
  );
}

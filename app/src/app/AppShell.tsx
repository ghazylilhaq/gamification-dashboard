import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { MORE_NAV, NAV_ITEMS, PRIMARY_NAV } from './nav';
import { FreshnessLine } from '@/components/Freshness';
import { DateRangePicker } from '@/components/DateRangePicker';
import { useDashboard } from '@/hooks/useDashboard';

export function AppShell() {
  const { filter, setShowTestData, raw } = useDashboard();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-line-1 bg-surface-1/95 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <Link to="/" className="min-w-0 shrink-0">
              <p className="text-micro font-semibold uppercase tracking-widest text-allo-yellow-deep">
                Allo Bank
              </p>
              <h1 className="font-display text-base font-bold leading-tight text-ink-1 sm:text-lg">
                Blind Box Season 2
              </h1>
            </Link>

            <p className="order-last w-full text-micro text-ink-4 lg:order-none lg:w-auto lg:flex-1">
              <FreshnessLine />
            </p>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:block">
                <DateRangePicker />
              </div>
              <TestDataToggle checked={filter.showTestData} onChange={setShowTestData} />
              {raw?.viewer.canUpload && (
                <Link
                  to="/admin/upload"
                  className="rounded-control bg-allo-yellow px-3 py-2 font-semibold text-ink-1 transition-colors hover:bg-allo-yellow-tint"
                >
                  Upload
                </Link>
              )}
            </div>
          </div>

          <div className="sm:hidden pb-2">
            <DateRangePicker />
          </div>

          {/* Desktop navigation. Admin is pushed to the right and divided off,
              so the internal-team area never reads as another report. */}
          <nav className="hidden items-center gap-1 overflow-x-auto md:flex" aria-label="Sections">
            {NAV_ITEMS.filter((i) => !i.admin).map((item) => (
              <DesktopLink key={item.to} to={item.to} label={item.label} />
            ))}
            <span className="mx-2 h-5 w-px bg-line-1" aria-hidden />
            {NAV_ITEMS.filter((i) => i.admin).map((item) => (
              <DesktopLink key={item.to} to={item.to} label={item.label} admin />
            ))}
          </nav>
        </div>
      </header>

      {isAdmin && (
        <div className="border-b border-line-1 bg-surface-3">
          <p className="mx-auto max-w-[1400px] px-4 py-2 text-micro text-ink-3 sm:px-6">
            Internal team area · changes here are visible to everyone on the dashboard
          </p>
        </div>
      )}

      <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-5 sm:px-6 md:pb-10">
        <Outlet />
      </main>

      <MobileTabBar open={moreOpen} onToggleMore={() => setMoreOpen((v) => !v)} />
    </div>
  );
}

function DesktopLink({ to, label, admin }: { to: string; label: string; admin?: boolean }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `-mb-px border-b-2 px-3 py-2.5 font-semibold whitespace-nowrap transition-colors ${
          isActive
            ? 'border-allo-yellow text-ink-1'
            : `border-transparent hover:text-ink-1 ${admin ? 'text-ink-4' : 'text-ink-3'}`
        }`
      }
    >
      {label}
    </NavLink>
  );
}

function TestDataToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-micro text-ink-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-pill transition-colors ${
          checked ? 'bg-allo-yellow' : 'bg-line-1'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-pill bg-surface-1 shadow-card transition-all ${
            checked ? 'left-[1.125rem]' : 'left-0.5'
          }`}
        />
      </button>
      <span className="hidden whitespace-nowrap sm:inline">Test data</span>
      <span className="sr-only">Show pre-launch test data</span>
    </label>
  );
}

/** The four primary tabs, and More for everything else. */
function MobileTabBar({ open, onToggleMore }: { open: boolean; onToggleMore: () => void }) {
  const location = useLocation();
  const moreActive = MORE_NAV.some((i) => location.pathname.startsWith(i.to) && i.to !== '/');

  return (
    <>
      {open && (
        <>
          <div
            className="fixed inset-0 z-30 bg-ink-1/20 md:hidden"
            onClick={onToggleMore}
            aria-hidden
          />
          <div className="fixed bottom-[4.25rem] left-3 right-3 z-40 overflow-hidden rounded-card border border-line-1 bg-surface-1 shadow-raised md:hidden">
            {MORE_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onToggleMore}
                className="flex items-center justify-between border-b border-line-2 px-4 py-3 font-semibold text-ink-2 last:border-b-0"
              >
                {item.label}
                {item.admin && (
                  <span className="text-micro font-normal text-ink-4">Internal team</span>
                )}
              </NavLink>
            ))}
          </div>
        </>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-line-1 bg-surface-1 pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Sections"
      >
        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => open && onToggleMore()}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 py-2.5 text-micro font-semibold ${
                isActive ? 'text-ink-1' : 'text-ink-4'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  aria-hidden
                  className={`h-0.5 w-6 rounded-pill ${isActive ? 'bg-allo-yellow' : 'bg-transparent'}`}
                />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={onToggleMore}
          aria-expanded={open}
          className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-micro font-semibold ${
            moreActive || open ? 'text-ink-1' : 'text-ink-4'
          }`}
        >
          <span
            aria-hidden
            className={`h-0.5 w-6 rounded-pill ${moreActive ? 'bg-allo-yellow' : 'bg-transparent'}`}
          />
          More
        </button>
      </nav>
    </>
  );
}

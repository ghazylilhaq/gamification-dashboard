import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from '@/app/nav';
import { useDashboard } from '@/hooks/useDashboard';
import { questName } from '@/config/quests';
import { matches } from '@/lib/search';
import type { SearchHandoff } from '@/hooks/useSearchHandoff';

/** The kinds of thing the search knows about, in the order they are listed. */
const GROUPS = ['Rewards', 'Blind boxes', 'Activities', 'Pages'] as const;
type Group = (typeof GROUPS)[number];

interface Entry {
  key: string;
  group: Group;
  label: string;
  subtitle?: string;
  route: string;
  /** Applied by the destination page via `useSearchHandoff`. */
  handoff?: SearchHandoff;
}

/** One common word should not produce a hundred-row dropdown. */
const PER_GROUP = 6;

/**
 * One field that searches the whole campaign: every reward, box and activity
 * by name, plus the section names themselves.
 *
 * It answers "where do I look at X", which the per-table searches cannot —
 * they only help once you already know which page X lives on. Picking a result
 * navigates and hands the term to that page's own search, so the row is found
 * rather than merely nearby.
 *
 * The index is built from the dataset primitives, not the metric row builders,
 * so the always-loaded shell does not pull the per-page metrics into the main
 * bundle for the sake of a list of names.
 */
export function GlobalSearch({ className = '' }: { className?: string }) {
  const { dataset, raw } = useDashboard();
  const navigate = useNavigate();
  // useId's value contains characters that are not valid in a CSS selector,
  // which breaks the accessible-name lookup for a <label for>. These ids only
  // ever need to be unique, so strip them down.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];

    for (const reward of dataset?.rewards ?? []) {
      const box = reward.blind_box_id === null ? null : dataset?.boxById.get(reward.blind_box_id);
      out.push({
        key: `reward-${reward.id}`,
        group: 'Rewards',
        label: reward.name_en,
        subtitle: [reward.rarity, reward.type, box?.name_en].filter(Boolean).join(' · '),
        route: '/rewards',
        handoff: { query: reward.name_en },
      });
    }

    for (const box of dataset?.boxesByStamp ?? []) {
      out.push({
        key: `box-${box.id}`,
        group: 'Blind boxes',
        label: box.name_en,
        subtitle: `${box.stamp_required} stamps`,
        route: '/catalog',
        handoff: { boxId: box.id },
      });
    }

    for (const activity of raw?.activities ?? []) {
      out.push({
        key: `activity-${activity.id}`,
        group: 'Activities',
        label: activity.name_en,
        subtitle: questName(activity.quest_id),
        route: '/activity',
        handoff: { query: activity.name_en },
      });
    }

    for (const item of NAV_ITEMS) {
      out.push({
        key: `page-${item.to}`,
        group: 'Pages',
        label: item.label,
        subtitle: item.admin ? 'Internal team' : undefined,
        route: item.to,
      });
    }

    return out;
  }, [dataset, raw]);

  /** The capped results per group, plus how many were left out. */
  const results = useMemo(() => {
    if (query.trim() === '') return [];
    const found = entries.filter((e) => matches(query, e, (x) => [x.label, x.subtitle]));
    return GROUPS.flatMap((group) => {
      const all = found.filter((e) => e.group === group);
      if (all.length === 0) return [];
      return [{ group, shown: all.slice(0, PER_GROUP), hidden: all.length - PER_GROUP }];
    });
  }, [entries, query]);

  // Flattened, because the arrow keys move across group boundaries.
  const flat = results.flatMap((r) => r.shown);
  const open = flat.length > 0 || (query.trim() !== '' && results.length === 0);

  // Any new query starts at the first result.
  useEffect(() => setActive(0), [query]);

  // Cmd/Ctrl-K focuses from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // A click anywhere else dismisses, the same instinct as the Drawer backdrop.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setQuery('');
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function go(entry: Entry) {
    setQuery('');
    inputRef.current?.blur();
    navigate(entry.route, entry.handoff ? { state: { search: entry.handoff } } : undefined);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      setQuery('');
      return;
    }
    if (flat.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const entry = flat[Math.min(active, flat.length - 1)];
      if (entry) go(entry);
    }
  }

  // Nothing to search before the data lands, or on a fresh install.
  if (!dataset) return null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <span aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4">
        ⌕
      </span>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-label="Search rewards, boxes, activities and pages"
        aria-expanded={open}
        aria-controls={`${id}-results`}
        aria-autocomplete="list"
        aria-activedescendant={flat[active] ? `${id}-${flat[active].key}` : undefined}
        autoComplete="off"
        value={query}
        placeholder="Search everything"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        className="w-full rounded-control border border-line-1 bg-surface-1 py-2 pl-7 pr-3 text-ink-1 placeholder:text-ink-5 focus:border-ink-5 focus:outline-none"
      />

      <p aria-live="polite" className="sr-only">
        {query.trim() === ''
          ? ''
          : `${flat.length} result${flat.length === 1 ? '' : 's'} for ${query}`}
      </p>

      {open && (
        <div
          id={`${id}-results`}
          role="listbox"
          aria-label="Search results"
          className="absolute right-0 top-full z-50 mt-1 max-h-[70vh] w-full min-w-[18rem] overflow-y-auto rounded-card border border-line-1 bg-surface-1 py-1 shadow-raised"
        >
          {flat.length === 0 ? (
            <p className="px-3 py-2.5 text-ink-4">No matches for “{query}”</p>
          ) : (
            results.map(({ group, shown, hidden }) => (
              <div key={group} role="group" aria-label={group}>
                <p className="px-3 pb-1 pt-2 text-micro font-semibold uppercase tracking-wide text-ink-4">
                  {group}
                </p>
                {shown.map((entry) => {
                  const index = flat.indexOf(entry);
                  return (
                    <div
                      key={entry.key}
                      id={`${id}-${entry.key}`}
                      role="option"
                      aria-selected={index === active}
                      // mousedown would fight the dismiss-on-outside-click
                      // handler; the pointer selects on click.
                      onMouseEnter={() => setActive(index)}
                      onClick={() => go(entry)}
                      className={`cursor-pointer px-3 py-2 ${
                        index === active ? 'bg-allo-yellow-tint' : ''
                      }`}
                    >
                      <p className="truncate font-semibold text-ink-1">{entry.label}</p>
                      {entry.subtitle && (
                        <p className="truncate text-micro text-ink-4">{entry.subtitle}</p>
                      )}
                    </div>
                  );
                })}
                {hidden > 0 && (
                  <p className="px-3 pb-1 text-micro text-ink-5">
                    +{hidden} more in {group.toLowerCase()} — narrow the search
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

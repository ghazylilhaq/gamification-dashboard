import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * What the global search hands to the page it navigates to: either a term to
 * pre-fill that page's own search box, or a box to open.
 */
export interface SearchHandoff {
  query?: string;
  boxId?: number;
}

interface SearchLocationState {
  search?: SearchHandoff;
}

/**
 * Applies a handoff from the global search, then clears it.
 *
 * It travels in react-router's location state rather than the URL, so nothing
 * about it is bookmarkable — which matches every other filter on these pages.
 * Clearing it after one read matters: without that, navigating away and back,
 * or any later re-render, would snap the page back to the term the user has
 * since edited.
 */
export function useSearchHandoff(apply: (handoff: SearchHandoff) => void): void {
  const location = useLocation();
  const navigate = useNavigate();
  const handoff = (location.state as SearchLocationState | null)?.search;

  useEffect(() => {
    if (!handoff) return;
    apply(handoff);
    navigate(location.pathname, { replace: true, state: null });
    // Only a new handoff should re-run this; `apply` is an inline arrow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff, location.pathname]);
}

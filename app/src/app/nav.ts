export interface NavItem {
  to: string;
  label: string;
  /** Shown in the mobile bottom bar; the rest live under "More". */
  primary: boolean;
  /** Part of the internal-team area, kept visually separate from reporting. */
  admin?: boolean;
}

/**
 * Reading order: where the campaign stands, how that is moving day by day,
 * then the activity that earns stamps, the boxes those stamps unlock, the
 * rewards inside them, what it all costs, and the two narrower views.
 *
 * The mobile bar has five slots: four primary tabs and "More". Trends is read
 * daily, so it takes a tab; Blind boxes is a reference view and moves to More.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Overview', primary: true },
  { to: '/trends', label: 'Trends', primary: true },
  { to: '/activity', label: 'Activity', primary: true },
  { to: '/catalog', label: 'Blind boxes', primary: false },
  { to: '/rewards', label: 'Rewards', primary: true },
  { to: '/budget', label: 'Budget', primary: false },
  { to: '/redemption', label: 'Redemption', primary: false },
  { to: '/gacha', label: 'Gacha', primary: false },
  { to: '/admin/upload', label: 'Admin', primary: false, admin: true },
];

export const PRIMARY_NAV = NAV_ITEMS.filter((i) => i.primary);
export const MORE_NAV = NAV_ITEMS.filter((i) => !i.primary);

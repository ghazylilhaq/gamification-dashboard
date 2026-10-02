// Icon.jsx — minimal Lucide-derived inline SVG set used by the Allo mobile UI kit.
// Stand-in: production should swap to Allo's bespoke icon SVGs.

const ICONS = {
  home:    <><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-7h6v7"/></>,
  send:    <><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></>,
  scan:    <><path d="M3 7V5a2 2 0 012-2h2"/><path d="M17 3h2a2 2 0 012 2v2"/><path d="M21 17v2a2 2 0 01-2 2h-2"/><path d="M7 21H5a2 2 0 01-2-2v-2"/><path d="M7 12h10"/></>,
  card:    <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></>,
  user:    <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/></>,
  arrowL:  <><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></>,
  arrowR:  <><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></>,
  arrowUp: <><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></>,
  arrowDn: <><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></>,
  plus:    <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  bell:    <><path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a2 2 0 003.4 0"/></>,
  search:  <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></>,
  settings:<><path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24"/><circle cx="12" cy="12" r="3"/></>,
  bolt:    <><path d="M13 2L3 14h9l-1 8 10-12h-9z"/></>,
  wallet:  <><path d="M20 12V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2v-1"/><path d="M14 12h7"/></>,
  pig:     <><path d="M19 11h2a1 1 0 011 1v3a1 1 0 01-1 1h-2"/><path d="M5 7h11a5 5 0 015 5v3a5 5 0 01-5 5H7l-2 2v-2a5 5 0 010-10z"/><circle cx="9" cy="12" r="0.5" fill="currentColor"/></>,
  trend:   <><path d="M3 17l6-6 4 4 8-8"/><path d="M21 7h-5M21 7v5"/></>,
  shop:    <><path d="M3 7h18l-2 12a2 2 0 01-2 2H7a2 2 0 01-2-2L3 7z"/><path d="M8 7V5a4 4 0 018 0v2"/></>,
  bank:    <><path d="M3 10l9-6 9 6"/><path d="M5 10v9M19 10v9M9 10v9M15 10v9M3 21h18"/></>,
  globe:   <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></>,
  more:    <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  check:   <><path d="M20 6L9 17l-5-5"/></>,
  close:   <><path d="M18 6L6 18M6 6l12 12"/></>,
  star:    <><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></>,
  history: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  clock:   <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  copy:    <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></>,
  eye:     <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff:  <><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0112 5c6 0 10 7 10 7a14 14 0 01-3.5 4.1M6.6 6.6A14 14 0 002 12s4 7 10 7c1.6 0 3-.4 4.4-1"/></>,
};

function Icon({ name, size = 22, stroke = 1.75, color = "currentColor", fill = "none" }) {
  const path = ICONS[name];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}>
      {path}
    </svg>
  );
}

window.Icon = Icon;

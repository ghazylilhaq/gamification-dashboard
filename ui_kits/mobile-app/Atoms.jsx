// Atoms.jsx — small atomic components (Button, Field, Chip, Pill, StatusBar, TopBar, BottomNav)

const C = {
  yellow: '#FFAF03',
  yellowTint: '#FFE39B',
  ink: '#333',
  inkDeep: '#1A1A1A',
  ink3: '#5C5C5C',
  ink4: '#8A8A8A',
  line: '#E6E6E6',
  line2: '#F0F0F0',
  bg2: '#FAFAFA',
  bg3: '#F5F5F5',
  white: '#fff',
  success: '#1F9D55',
  successBg: '#E6F6EC',
  danger: '#D14343',
};
window.AlloC = C;

function Button({ children, variant = 'primary', size = 'md', icon, onClick, full, disabled, style }) {
  const sizes = {
    sm: { padding: '8px 14px', fontSize: 13 },
    md: { padding: '14px 22px', fontSize: 15 },
    lg: { padding: '18px 28px', fontSize: 16 },
  };
  const variants = {
    primary:   { background: C.yellow, color: C.ink, boxShadow: '0 8px 20px rgba(255,175,3,0.35)' },
    secondary: { background: C.ink, color: C.white },
    ghost:     { background: 'transparent', color: C.ink, border: `1.5px solid ${C.ink}` },
    tertiary:  { background: C.bg2, color: C.ink },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      fontFamily: "'Inter', sans-serif", fontWeight: 600, borderRadius: 999, border: 0,
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      transition: 'transform 150ms cubic-bezier(.2,0,0,1), opacity 150ms',
      width: full ? '100%' : 'auto',
      opacity: disabled ? 0.5 : 1,
      ...sizes[size], ...variants[variant], ...style,
    }}
    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', help, error, prefix, suffix }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <label style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>{label}</label>}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        border: `1.5px solid ${error ? C.danger : (focus ? C.yellow : C.line)}`,
        borderRadius: 12, padding: '12px 14px', background: C.white,
        boxShadow: focus ? '0 0 0 4px rgba(255,175,3,0.18)' : 'none',
        transition: '120ms',
      }}>
        {prefix && <span style={{ color: C.ink4, fontSize: 15 }}>{prefix}</span>}
        <input
          type={type} value={value || ''} onChange={e => onChange?.(e.target.value)}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          placeholder={placeholder}
          style={{
            flex: 1, border: 0, outline: 'none', fontFamily: "'Inter', sans-serif",
            fontSize: 15, color: C.ink, background: 'transparent', minWidth: 0,
          }}
        />
        {suffix}
      </div>
      {help && !error && <span style={{ fontSize: 12, color: C.ink4 }}>{help}</span>}
      {error && <span style={{ fontSize: 12, color: C.danger }}>{error}</span>}
    </div>
  );
}

function Chip({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 500,
      padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
      background: active ? C.yellow : C.bg3,
      color: C.ink, border: 0, transition: '120ms',
    }}>{children}</button>
  );
}

function Pill({ children, tone = 'default' }) {
  const tones = {
    default: { background: C.bg3, color: C.ink },
    success: { background: C.successBg, color: C.success },
    danger:  { background: '#FCE8E8', color: C.danger },
    yellow:  { background: C.yellow, color: C.ink },
  };
  return (
    <span style={{
      fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 600,
      padding: '3px 8px', borderRadius: 999, ...tones[tone],
    }}>{children}</span>
  );
}

function StatusBar({ dark }) {
  const fg = dark ? C.white : C.ink;
  return (
    <div style={{
      height: 44, padding: '0 24px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', color: fg, fontFamily: "'Inter', sans-serif",
      fontSize: 14, fontWeight: 600, flexShrink: 0,
    }}>
      <span>9:41</span>
      <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="16" height="10" viewBox="0 0 16 10" fill={fg}><rect x="0" y="6" width="2" height="4" rx="0.5"/><rect x="4" y="4" width="2" height="6" rx="0.5"/><rect x="8" y="2" width="2" height="8" rx="0.5"/><rect x="12" y="0" width="2" height="10" rx="0.5"/></svg>
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke={fg} strokeWidth="1.2"><path d="M1 4a8 8 0 0112 0M3 6a5 5 0 018 0M6 8a1.5 1.5 0 011 0"/></svg>
        <svg width="22" height="10" viewBox="0 0 22 10" fill="none" stroke={fg} strokeWidth="1"><rect x="0.5" y="0.5" width="18" height="9" rx="2"/><rect x="2" y="2" width="14" height="6" rx="1" fill={fg}/><rect x="19" y="3" width="2" height="4" rx="0.5" fill={fg}/></svg>
      </span>
    </div>
  );
}

function TopBar({ title, leading, trailing, dark }) {
  return (
    <div style={{
      height: 56, padding: '0 16px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', flexShrink: 0,
      color: dark ? C.white : C.ink,
    }}>
      <div style={{ width: 40 }}>{leading}</div>
      <div style={{
        fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 17,
        letterSpacing: '-0.01em',
      }}>{title}</div>
      <div style={{ width: 40, display: 'flex', justifyContent: 'flex-end' }}>{trailing}</div>
    </div>
  );
}

function IconButton({ icon, onClick, dark }) {
  return (
    <button onClick={onClick} style={{
      width: 40, height: 40, borderRadius: 12, border: 0, cursor: 'pointer',
      background: dark ? 'rgba(255,255,255,0.12)' : C.bg2,
      color: dark ? C.white : C.ink,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name={icon} size={20} />
    </button>
  );
}

function BottomNav({ tab, onTab }) {
  const tabs = [
    { id: 'home',    icon: 'home',    label: 'Beranda' },
    { id: 'history', icon: 'history', label: 'Riwayat' },
    { id: 'scan',    icon: 'scan',    label: 'QRIS', big: true },
    { id: 'card',    icon: 'card',    label: 'Kartu' },
    { id: 'me',      icon: 'user',    label: 'Akun' },
  ];
  return (
    <div style={{
      height: 76, flexShrink: 0, background: C.white,
      borderTop: `1px solid ${C.line2}`,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around',
      padding: '8px 8px 16px',
    }}>
      {tabs.map(t => {
        const active = t.id === tab;
        if (t.big) {
          return (
            <button key={t.id} onClick={() => onTab?.(t.id)} style={{
              border: 0, cursor: 'pointer', background: 'transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 600, color: C.ink,
              transform: 'translateY(-12px)',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 999, background: C.yellow,
                boxShadow: '0 8px 20px rgba(255,175,3,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={t.icon} size={24} stroke={2} />
              </div>
              <span style={{ marginTop: 4 }}>{t.label}</span>
            </button>
          );
        }
        return (
          <button key={t.id} onClick={() => onTab?.(t.id)} style={{
            border: 0, background: 'transparent', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            fontFamily: "'Inter', sans-serif", fontSize: 10, fontWeight: 500,
            color: active ? C.ink : C.ink4, padding: 4,
          }}>
            <Icon name={t.icon} size={22} stroke={active ? 2.2 : 1.7} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, { Button, Field, Chip, Pill, StatusBar, TopBar, BottomNav, IconButton });

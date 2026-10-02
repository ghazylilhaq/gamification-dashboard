// Cards.jsx — BalanceCard, QuickGrid, PromoCard, TxnRow, GoalCard, Sheet

function BalanceCard({ amount = "Rp 4.250.000", hidden, onToggle }) {
  return (
    <div style={{
      background: AlloC.ink, color: AlloC.white, borderRadius: 24,
      padding: '20px 22px', boxShadow: '0 12px 28px rgba(51,51,51,0.18)',
      position: 'relative', overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Decorative yellow blob */}
      <div style={{
        position: 'absolute', right: -40, top: -40, width: 160, height: 160,
        borderRadius: 999, background: AlloC.yellow, opacity: 0.18,
      }}/>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
        textTransform: 'uppercase', opacity: 0.7, marginBottom: 6,
      }}>Saldo aktif</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          fontFamily: "'Satoshi', sans-serif", fontWeight: 900,
          fontSize: 32, letterSpacing: '-0.03em',
        }}>
          {hidden ? 'Rp ••••••••' : amount}
        </div>
        <button onClick={onToggle} style={{
          background: 'rgba(255,255,255,0.12)', border: 0, color: AlloC.white,
          width: 32, height: 32, borderRadius: 999, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={hidden ? 'eyeOff' : 'eye'} size={16} />
        </button>
      </div>
      <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
        <button style={{
          flex: 1, padding: '10px 14px', borderRadius: 999, border: 0, cursor: 'pointer',
          background: AlloC.yellow, color: AlloC.ink, fontFamily: "'Inter', sans-serif",
          fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center',
          justifyContent: 'center', gap: 6,
        }}>
          <Icon name="plus" size={16} stroke={2.2} /> Top up
        </button>
        <button style={{
          flex: 1, padding: '10px 14px', borderRadius: 999, cursor: 'pointer',
          background: 'rgba(255,255,255,0.12)', color: AlloC.white,
          border: '1.5px solid rgba(255,255,255,0.25)',
          fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Icon name="send" size={16} /> Transfer
        </button>
      </div>
    </div>
  );
}

const PRODUCTS = [
  { id: 'pay',       label: 'Pay',         icon: 'wallet', tint: '#FFE39B' },
  { id: 'paylater',  label: 'PayLater',    icon: 'clock',  tint: '#FAD0E8' },
  { id: 'grow',      label: 'Grow',        icon: 'pig',    tint: '#B1EFCE' },
  { id: 'deposito',  label: 'Deposito',    icon: 'bank',   tint: '#CCE2E8' },
  { id: 'bisnis',    label: 'Bisnis',      icon: 'trend',  tint: '#D7D9FF' },
  { id: 'explore',   label: 'Explore',     icon: 'globe',  tint: '#B1EFCE' },
  { id: 'shop',      label: 'Belanja',     icon: 'shop',   tint: '#FFE39B' },
  { id: 'more',      label: 'Lainnya',     icon: 'more',   tint: '#F0F0F0' },
];

function QuickGrid({ onPick }) {
  return (
    <div style={{
      background: AlloC.white, borderRadius: 20, padding: 16,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)', flexShrink: 0,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, rowGap: 16 }}>
        {PRODUCTS.map(p => (
          <button key={p.id} onClick={() => onPick?.(p.id)} style={{
            background: 'transparent', border: 0, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 16, background: p.tint,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: AlloC.ink,
            }}>
              <Icon name={p.icon} size={22} stroke={1.8} />
            </div>
            <span style={{
              fontFamily: "'Inter', sans-serif", fontSize: 11, fontWeight: 500,
              color: AlloC.ink,
            }}>{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PromoCard({ eyebrow = 'Promo', title, body, cta = 'Cek sekarang', tone = 'yellow' }) {
  const tones = {
    yellow: { bg: AlloC.yellow, fg: AlloC.ink },
    dark:   { bg: AlloC.ink,    fg: AlloC.white },
  };
  const t = tones[tone];
  return (
    <div style={{
      background: t.bg, color: t.fg, borderRadius: 20, padding: '16px 18px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 6px 18px rgba(51,51,51,0.06)', flexShrink: 0,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.12em',
          textTransform: 'uppercase', opacity: 0.65, marginBottom: 4,
        }}>{eyebrow}</div>
        <div style={{
          fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 18,
          letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 4,
        }}>{title}</div>
        <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.4 }}>{body}</div>
      </div>
      <div style={{
        width: 56, height: 56, borderRadius: 16, flexShrink: 0,
        background: tone === 'yellow' ? 'rgba(51,51,51,0.08)' : 'rgba(255,175,3,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 30,
      }}>🎁</div>
    </div>
  );
}

function TxnRow({ icon = 'arrowUp', tint = AlloC.yellowTint, title, sub, amount, incoming, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '12px 16px', border: 0, background: 'transparent',
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, background: tint,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: AlloC.ink, flexShrink: 0,
      }}>
        <Icon name={icon} size={18} stroke={2} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: AlloC.ink, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 11, color: AlloC.ink4 }}>{sub}</div>
      </div>
      <div style={{
        fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 14,
        color: incoming ? AlloC.success : AlloC.ink, letterSpacing: '-0.01em',
      }}>{amount}</div>
    </button>
  );
}

function GoalCard({ title, emoji, current, target, color = AlloC.yellow }) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  return (
    <div style={{
      background: AlloC.white, borderRadius: 20, padding: 18,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)', flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, background: `${color}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>{emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 16,
            color: AlloC.ink, letterSpacing: '-0.01em',
          }}>{title}</div>
          <div style={{ fontSize: 11, color: AlloC.ink4 }}>{pct}% tercapai</div>
        </div>
      </div>
      <div style={{
        height: 8, background: AlloC.line2, borderRadius: 999, overflow: 'hidden',
        marginBottom: 8,
      }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999 }}/>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: AlloC.ink3 }}>
        <span style={{ fontWeight: 600, color: AlloC.ink }}>Rp {current.toLocaleString('id-ID')}</span>
        <span>dari Rp {target.toLocaleString('id-ID')}</span>
      </div>
    </div>
  );
}

function Sheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, background: 'rgba(26,26,26,0.4)',
      display: 'flex', alignItems: 'flex-end', zIndex: 50,
      animation: 'alloFade 200ms cubic-bezier(.2,0,0,1)',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', background: AlloC.white,
        borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '12px 20px 24px',
        animation: 'alloSlideUp 220ms cubic-bezier(.2,0,0,1)',
      }}>
        <div style={{
          width: 40, height: 4, borderRadius: 999, background: AlloC.line,
          margin: '0 auto 14px',
        }}/>
        {title && <div style={{
          fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 18,
          letterSpacing: '-0.015em', marginBottom: 14,
        }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

Object.assign(window, { BalanceCard, QuickGrid, PromoCard, TxnRow, GoalCard, Sheet, PRODUCTS });

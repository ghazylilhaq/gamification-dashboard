// Screens.jsx — full-screen compositions for the Allo mobile UI kit click-thru.

function ScreenSplash({ onContinue }) {
  return (
    <div style={{
      flex: 1, background: AlloC.yellow, display: 'flex', flexDirection: 'column',
      padding: '0 28px', position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative blob */}
      <div style={{
        position: 'absolute', top: -120, right: -80, width: 320, height: 320,
        borderRadius: 999, background: '#FFC73B', opacity: 0.6,
      }}/>
      <div style={{
        position: 'absolute', bottom: -100, left: -60, width: 240, height: 240,
        borderRadius: 999, background: '#FFD96B', opacity: 0.5,
      }}/>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
        <img
          src="../../assets/logo/horizontal/01-color.png"
          alt="allobank"
          style={{ height: 56, width: 'auto', display: 'block', marginBottom: 18 }}
        />
        <div style={{
          fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 22,
          fontStyle: 'italic', letterSpacing: '-0.02em', color: AlloC.ink, opacity: 0.85,
        }}>Experience a Simple Life.</div>
      </div>
      <div style={{ paddingBottom: 32, position: 'relative', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Button variant="secondary" size="lg" full onClick={onContinue}>Masuk</Button>
        <Button variant="ghost" size="lg" full>Buka rekening baru</Button>
      </div>
    </div>
  );
}

function ScreenSignIn({ onSignIn, onBack }) {
  const [phone, setPhone] = React.useState('081234567890');
  return (
    <div style={{ flex: 1, background: AlloC.white, display: 'flex', flexDirection: 'column' }}>
      <TopBar
        leading={<IconButton icon="arrowL" onClick={onBack} />}
        title=""
      />
      <div style={{ padding: '8px 24px 24px', flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <div style={{
            fontFamily: "'Satoshi', sans-serif", fontWeight: 900, fontSize: 32,
            letterSpacing: '-0.025em', lineHeight: 1.05, color: AlloC.ink, marginBottom: 8,
          }}>Hai, selamat datang!</div>
          <div style={{ fontSize: 14, color: AlloC.ink3, lineHeight: 1.5 }}>
            Masuk pakai nomor HP yang terdaftar di Allo Bank.
          </div>
        </div>
        <Field label="Nomor HP" value={phone} onChange={setPhone} prefix="🇮🇩 +62" />
        <div style={{ flex: 1 }}/>
        <Button variant="primary" size="lg" full onClick={onSignIn}>Lanjutkan</Button>
        <div style={{ textAlign: 'center', fontSize: 12, color: AlloC.ink4 }}>
          Belum punya akun? <span style={{ color: AlloC.ink, fontWeight: 600 }}>Daftar di sini</span>
        </div>
      </div>
    </div>
  );
}

function ScreenHome({ onProduct, onTransfer }) {
  const [hidden, setHidden] = React.useState(false);
  return (
    <div style={{ flex: 1, background: AlloC.bg2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Yellow header backdrop */}
      <div style={{
        background: AlloC.yellow, padding: '8px 20px 80px', position: 'relative',
      }}>
        <TopBar
          leading={<div style={{
            width: 40, height: 40, borderRadius: 999, background: AlloC.ink, color: AlloC.yellow,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Satoshi', sans-serif", fontWeight: 900, fontSize: 16,
          }}>S</div>}
          title=""
          trailing={<div style={{ display: 'flex', gap: 8 }}>
            <IconButton icon="search" />
            <IconButton icon="bell" />
          </div>}
        />
        <div style={{ padding: '0 4px', marginTop: 4 }}>
          <div style={{ fontSize: 13, color: AlloC.ink, opacity: 0.7 }}>Halo,</div>
          <div style={{
            fontFamily: "'Satoshi', sans-serif", fontWeight: 900, fontSize: 24,
            letterSpacing: '-0.02em', color: AlloC.ink,
          }}>Sari Wijaya 👋</div>
        </div>
      </div>
      <div style={{
        flex: 1, padding: '0 16px 16px', marginTop: -64,
        display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto',
      }}>
        <BalanceCard hidden={hidden} onToggle={() => setHidden(h => !h)} />
        <QuickGrid onPick={onProduct} />
        <PromoCard
          eyebrow="allo Grow · Promo"
          title="Bunga 7% p.a. untuk goal pertama kamu"
          body="Mulai dari Rp 10.000. Cair kapan saja."
          tone="dark"
        />
        <div style={{
          background: AlloC.white, borderRadius: 20, padding: '4px 0',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)', flexShrink: 0,
        }}>
          <div style={{
            padding: '14px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{
              fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 15,
              letterSpacing: '-0.01em', color: AlloC.ink,
            }}>Aktivitas terkini</div>
            <span style={{ fontSize: 12, color: AlloC.ink3, fontWeight: 600 }}>Lihat semua</span>
          </div>
          <TxnRow icon="arrowUp" tint="#FFE39B" title="Transfer ke Sari" sub="BCA · 12 Mei, 14:32" amount="- Rp 250.000" onClick={onTransfer}/>
          <div style={{ height: 1, background: AlloC.line2, margin: '0 16px' }}/>
          <TxnRow icon="bolt"    tint="#B1B5FF" title="PLN Token"          sub="Berhasil · 12 Mei"      amount="- Rp 100.000" />
          <div style={{ height: 1, background: AlloC.line2, margin: '0 16px' }}/>
          <TxnRow icon="arrowDn" tint="#B1EFCE" title="Top up dari BCA"     sub="12 Mei, 09:14"          amount="+ Rp 1.000.000" incoming />
        </div>
      </div>
    </div>
  );
}

function ScreenGrow({ onBack }) {
  return (
    <div style={{ flex: 1, background: AlloC.bg2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ background: AlloC.bg2, padding: '0 8px' }}>
        <TopBar
          leading={<IconButton icon="arrowL" onClick={onBack} />}
          title="allo Grow"
          trailing={<IconButton icon="more" />}
        />
      </div>
      <div style={{ flex: 1, padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14, overflow: 'auto' }}>
        <div style={{
          background: AlloC.yellow, borderRadius: 24, padding: 22, color: AlloC.ink,
          position: 'relative', overflow: 'hidden', flexShrink: 0,
        }}>
          <img
            src="../../assets/products/grow/02.png"
            alt="allo Grow"
            style={{ height: 26, width: 'auto', display: 'block', marginBottom: 14 }}
          />
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
            opacity: 0.7, marginBottom: 6,
          }}>Total tabungan</div>
          <div style={{
            fontFamily: "'Satoshi', sans-serif", fontWeight: 900, fontSize: 36,
            letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 4,
          }}>Rp 5.450.000</div>
          <div style={{ fontSize: 12, color: AlloC.ink, opacity: 0.7 }}>Bunga bulan ini · Rp 28.500</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Button variant="secondary" size="sm" icon="plus">Setor</Button>
            <Button variant="ghost"     size="sm" icon="arrowDn">Tarik</Button>
          </div>
        </div>

        <div style={{
          fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 16,
          letterSpacing: '-0.01em', color: AlloC.ink, marginTop: 6, padding: '0 4px',
        }}>Goal kamu</div>

        <GoalCard title="Liburan Bali" emoji="🌴" current={3100000} target={5000000} color="#4597A8"/>
        <GoalCard title="Dana darurat" emoji="🛡️" current={2350000} target={10000000} color="#FFAF03"/>
        <GoalCard title="MacBook"      emoji="💻" current={750000}  target={20000000} color="#E947A5"/>

        <Button variant="ghost" size="md" full icon="plus">Buat goal baru</Button>
      </div>
    </div>
  );
}

function ScreenTransfer({ onBack, onSent }) {
  const [amount, setAmount] = React.useState('250000');
  const formatted = 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
  return (
    <div style={{ flex: 1, background: AlloC.white, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TopBar
        leading={<IconButton icon="arrowL" onClick={onBack} />}
        title="Transfer"
      />
      <div style={{ flex: 1, padding: '4px 20px 20px', display: 'flex', flexDirection: 'column', gap: 18, overflow: 'auto' }}>
        <div style={{
          background: AlloC.bg2, borderRadius: 16, padding: 14,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 999, background: AlloC.yellow,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Satoshi', sans-serif", fontWeight: 900, color: AlloC.ink, fontSize: 16,
          }}>BC</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: AlloC.ink4, marginBottom: 2 }}>Kepada</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: AlloC.ink }}>Budi Cahyono</div>
            <div style={{ fontSize: 11, color: AlloC.ink4 }}>BCA · 1234 5678 9012</div>
          </div>
          <span style={{ fontSize: 12, color: AlloC.ink, fontWeight: 600 }}>Ganti</span>
        </div>
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ fontSize: 12, color: AlloC.ink4, marginBottom: 8 }}>Nominal transfer</div>
          <div style={{
            fontFamily: "'Satoshi', sans-serif", fontWeight: 900, fontSize: 40,
            letterSpacing: '-0.03em', color: AlloC.ink,
          }}>{formatted}</div>
          <div style={{ fontSize: 12, color: AlloC.ink4, marginTop: 6 }}>Saldo Rp 4.250.000</div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[100000, 250000, 500000, 1000000].map(n => (
            <Chip key={n} active={String(n) === amount} onClick={() => setAmount(String(n))}>
              Rp {n.toLocaleString('id-ID')}
            </Chip>
          ))}
        </div>
        <Field label="Catatan (opsional)" placeholder="Contoh: bayar makan siang" />
        <div style={{ flex: 1 }}/>
        <Button variant="primary" size="lg" full onClick={onSent}>Kirim sekarang</Button>
      </div>
    </div>
  );
}

function ScreenProfile({ onBack }) {
  const items = [
    { icon: 'user',     label: 'Profil & verifikasi' },
    { icon: 'card',     label: 'Kartu & rekening' },
    { icon: 'bell',     label: 'Notifikasi' },
    { icon: 'settings', label: 'Pengaturan' },
    { icon: 'star',     label: 'Allo Prime' },
  ];
  return (
    <div style={{ flex: 1, background: AlloC.bg2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ background: AlloC.yellow, padding: '8px 8px 28px' }}>
        <TopBar leading={<IconButton icon="arrowL" onClick={onBack} />} title="Akun" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 16px 4px' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 999, background: AlloC.ink, color: AlloC.yellow,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Satoshi', sans-serif", fontWeight: 900, fontSize: 24,
          }}>S</div>
          <div>
            <div style={{
              fontFamily: "'Satoshi', sans-serif", fontWeight: 900, fontSize: 22,
              letterSpacing: '-0.02em', color: AlloC.ink,
            }}>Sari Wijaya</div>
            <div style={{ fontSize: 12, color: AlloC.ink, opacity: 0.7 }}>+62 812 3456 7890</div>
          </div>
        </div>
      </div>
      <div style={{ padding: '16px', flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: AlloC.white, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          {items.map((it, i) => (
            <div key={it.label} style={{
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
              borderBottom: i < items.length - 1 ? `1px solid ${AlloC.line2}` : 'none',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 12, background: AlloC.bg3,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={it.icon} size={18} />
              </div>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: AlloC.ink }}>{it.label}</div>
              <Icon name="arrowR" size={16} color={AlloC.ink4} />
            </div>
          ))}
        </div>
        <Button variant="ghost" size="md" full>Keluar</Button>
      </div>
    </div>
  );
}

Object.assign(window, {
  ScreenSplash, ScreenSignIn, ScreenHome, ScreenGrow, ScreenTransfer, ScreenProfile,
});

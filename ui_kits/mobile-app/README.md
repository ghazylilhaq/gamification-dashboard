# Allo Bank — Mobile App UI Kit

> **Source disclosure:** This UI kit is a **best-effort reconstruction** based on:
> - The 2024/2025 Allo Bank Brand Guidelines deck (`uploads/UPDATED VERSION - BRAND GUIDELINES Preview.pptx`)
> - Product moodboard slides (`assets/products/*.jpg`) — Allo Grow, Allo Deposito, Allo PayLater, Bank Activities
> - Logo applications on phone home screen (`assets/logo/logo-on-phone-home.jpg`)
>
> **No production codebase or Figma file was provided**, so component anatomy, exact type sizes, navigation transitions, and screen flows are inferred. Suitable for **mocks, prototypes, and concept work** — not as a 1:1 reference of the live Allo app. Please re-attach the codebase or Figma so we can iterate to pixel parity.

## Open `index.html`

A click-thru of the Allo Bank consumer app:

1. **Splash + Sign in** — yellow hero, `allobank` wordmark, phone-number entry.
2. **Home / Beranda** — saldo card, product shortcut grid (Pay, PayLater, Grow, Deposito, Bisnis, Explore), promo banner, recent activity.
3. **Product detail — allo Grow** — savings goal with progress, top-up CTA, transactions list.
4. **Send / Transfer** — recipient picker, nominal entry, confirmation.
5. **Profile** — settings list, user info, light/dark mode of section dividers.

## Components

| File | Purpose |
|------|---------|
| `Phone.jsx` | iPhone-shaped frame for the screens. |
| `StatusBar.jsx` | Faux iOS status bar in raisin-black or white. |
| `TopBar.jsx` | App bar with leading icon + title + trailing icon. |
| `BalanceCard.jsx` | Hero "saldo aktif" card — yellow surface or white-with-yellow-stripe variant. |
| `QuickGrid.jsx` | 4-column product shortcut grid. |
| `PromoCard.jsx` | Marketing banner (yellow / dark variants). |
| `TxnRow.jsx` | Transaction list row. |
| `BottomNav.jsx` | 5-tab bottom navigation. |
| `Button.jsx` | Pill primary / secondary / ghost. |
| `Field.jsx` | Text input with label. |
| `Chip.jsx` | Filter chip. |
| `Icon.jsx` | Inline-SVG icon set (Lucide-derived) used throughout the kit. |
| `Pill.jsx` | Status badge. |
| `Sheet.jsx` | Bottom-sheet container. |

## Caveats

- **Icons**: Lucide-derived inline SVGs. Substitute with Allo's bespoke icon set when available.
- **Photography**: not used inside the app shell here — the brand uses photography mostly in marketing.
- **Flow**: clicking through is purely visual; nothing connects to a backend.

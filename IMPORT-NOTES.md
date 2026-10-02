# Import notes — Allo Bank Design System

Imported from the Claude Design project
`dd2ee7b3-c423-46c4-a7a2-2f4b68703942` ("Allo Bank Design System")
via the `claude_design` MCP (`DesignSync` → `get_file`).

## What was imported

All 91 files from the requested list, plus 23 asset files those files
reference and would otherwise render broken without:

- `assets/logo/vertical/01–04.png` (used by `preview/brand-wordmark.html`)
- `assets/products/{pay,pay-plus,prime,grow,deposito,paylater,instant-cash,explore,bisnis}/{01,02}.png`
  (used by `preview/brand-product-wordmarks.html` and `ui_kits/mobile-app/Screens.jsx`)
- `assets/photography/photo-style.jpg` (used by `preview/brand-photography.html`)

## ⚠️ 16 files are INCOMPLETE (truncated at 192 KB)

`DesignSync.get_file` caps a single read at 256 KiB of base64, which is
192 KiB of binary. Every file below is larger than that in the source
project, so what landed on disk is the first 192 KiB only and the file
is **not valid**. Each one is exactly 196608 bytes — that size is the
tell.

| Path | Effect |
|------|--------|
| `fonts/Inter-Regular.ttf` | won't parse; `@font-face` falls back to Helvetica/Arial |
| `fonts/Inter-Medium.ttf` | same |
| `fonts/Inter-SemiBold.ttf` | same |
| `fonts/Inter-Bold.ttf` | same |
| `fonts/Inter-Black.ttf` | same |
| `assets/templates/template-bg-black.png` | renders partially / not at all |
| `assets/templates/template-bg-yellow.png` | same |
| `assets/icons/icon-styles-outline-duotone-fill.jpg` | renders top portion only |
| `assets/logo/dos-and-donts.jpg` | same |
| `assets/logo/kv-applications-with-typography.jpg` | same |
| `assets/logo/tagline-experience-simple-life.jpg` | same |
| `assets/photography/photo-style.jpg` | same |
| `assets/type/satoshi-list.jpg` | same |
| `assets/type/type-style-combinations.jpg` | same |
| `assets/type/typography-details.jpg` | same |
| `assets/type/typography-fails.jpg` | same |

Everything else verified intact (PNG `IEND`, JPEG `FFD9`, fonts parse).

**To fix:** download these 16 from the Claude Design project UI and drop
them in place. The 7 Satoshi faces — the brand display face, the one
that actually matters — all came through complete.

## Not imported

Present in the source project but outside the requested scope:

- `decks/Weekly Reporting Template.html` (referenced as a card in `_ds_manifest.json`)
- `assets/products/*.jpg` (4 moodboard slides)
- `assets/photography/*.jpg` (4 others)
- `assets/brand/`, `assets/colors/` extras already covered
- `uploads/*.pptx` (the two source decks; both well over the read cap)
- `.thumbnail`

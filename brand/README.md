# OpenCTEM brand

Two design directions, both shipped as concept v3 after iteration. Pick one
when you're ready to lock the brand; treat the other as a sketch.

## Files

| File | What it is |
|---|---|
| [`mark.svg`](./mark.svg) | **Direction B** — tilted asymmetric loop with growing-weight segments, gap ticks, and a fat marker dot |
| [`mark-letterform.svg`](./mark-letterform.svg) | **Direction C** — chunky lowercase C with five subtle notches and a marker dot in the opening |
| [`logo-letterform.svg`](./logo-letterform.svg) | Direction C inside the wordmark `openctem` (the C *is* the brand letter) |
| [`app-icon.svg`](./app-icon.svg) | Direction C on a deep-ink rounded square (favicon, PWA, dock) |
| [`compare.html`](./compare.html) | Side-by-side compare page — open in a browser to view both directions at 16/24/48/96/180px in light + dark mode |

## Design rationale (the part that matters)

Both directions encode the same insight: **OpenCTEM is a 5-stage continuous
cycle** (Scoping → Discovery → Prioritization → Validation → Mobilization,
loop). The mark *is* that architecture, not a metaphor for it. No shield,
no eye, no lock — those are clichés security vendors have already used.

- **Direction B** keeps the literal cycle: 5 arcs around an open loop. The
  five arcs grow in stroke weight as you go around, mirroring how context
  accumulates with each pass. Tilted -12° so it reads as kinetic, not
  static. A faint echo ring sits behind it for depth. The marker dot is
  the protagonist — it's the only colour element.
- **Direction C** keeps the same 5-segment math but bends it into a
  chunky letter C. The C stands for **C**TEM and **C**ontinuous; the five
  notches in the curve are visible above ~32px (FedEx hidden-arrow trick).
  The marker dot sits inside the C opening like a tongue. The big win
  here is brand-name fusion: the C in `openctem` *is* the mark — remove
  it and the wordmark breaks.

## Colour system

Single accent over a deep-ink ground. Picked specifically to **avoid**
the gradient-indigo-pink trend that every AI startup ships in 2024-2026.

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0A1628` | Primary mark, body text on light surfaces |
| `--paper` | `#FAFAF9` | Background on light, mark colour on dark |
| `--teal` | `#0D9488` | Marker dot in light contexts |
| `--teal-bright` | `#14B8A6` | Marker dot in dark contexts |
| `--muted` | `#525252` | Secondary text |

The marker is the **only** element that ever takes the accent colour. The
rest of the mark uses `currentColor`, so it inherits whatever theme it's
dropped into. This means a single SVG file works on light, dark, print,
and any future theme without modification.

## Typography

System font stack: `-apple-system, system-ui, "Segoe UI", Inter, sans-serif`.

Wordmark is set lowercase (`openctem`) at weight 600 with letter-spacing
`-1` to feel compact and dev-tool-like. No webfont dependency, no licence
to manage, native rendering everywhere. Same approach as Linear, Vercel,
Resend, Cursor.

## Honest caveats (read these before launch)

This is **concept v3**, authored by an AI engineer alongside the launch
checklist. It's a *thinking tool*, not a final brand asset. Specifically:

- **Neither direction will stop you scrolling on Twitter.** That's the
  test for a brand intended for public launch. Reaching that bar needs a
  human designer with 10+ years of experience and 2-4 weeks of iteration
  with real-user feedback. Budget: $3-10K minimum, or 15-30M VND for a
  Vietnamese freelance designer on Behance.
- **Neither has been trademark-searched.** The chunky C is broad enough
  that a clearance search is mandatory before any commercial use.
- **No production exports yet.** PNG fallbacks, Apple touch icons,
  Android adaptive icons, Windows tiles, OG image templates — all pending.
- **No accessibility audit.** Contrast ratios on the teal accent against
  every brand surface need verification (target: WCAG AA = 4.5:1 for text,
  3:1 for UI components).

## Recommended path forward

1. **Right now:** use Direction C as a placeholder in README, dashboard
   header, and dev environment. Document the 6-month replacement deadline.
2. **Before public launch:** hire a designer to refine (or replace) one
   of these directions with proper testing and production assets.
3. **Don't:** apply for trademark, print physical merchandise, or run
   paid marketing using these files as-is.

If you decide to keep one direction and ship it, the SVGs above are
production-ready as drop-in components — they use `currentColor` so they
work in any theme, and the geometry is precise to two decimal places.

---

*Previous concept iterations (v1 shield+iris, v2 symmetric loop) are kept
in git history; both were honest sketches superseded by this version.*

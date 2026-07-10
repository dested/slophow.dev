# slopshow — UI / Visual Language

> Source of truth for how this looks and feels. Follow it for anything visual.
> Keep it current as part of finishing a UI change — same discipline as cliffnotes.

## North star

**The tabloid broadsheet of AI slop.** Warm paper, heavy ink, one acid accent — a zine/arcade
marquee that's in on the joke but executed with real precision. Self-aware, punchy, never sloppy in
craft. Signature move: AI metadata printed as a literal thermal receipt. Failure looks like
(a) generic SaaS minimalism — soft grays, rounded-xl, no voice; (b) actual mess — random colors,
broken grids, joke overriding usability. The joke is in the copy and the artifacts (receipts,
stamps, tickers); the layout underneath is disciplined.

1. **Hard edges, hard shadows** — 2px ink borders + offset block shadows (`shadow-hard`), radius 0.
2. **Mono for data, display for shouting** — receipts/labels/stats in Spline Sans Mono caps;
   headlines in Archivo pushed wide and black (`font-display`); body in regular Archivo.
3. **One accent** — acid chartreuse (`--acid`) for CTAs, highlights, featured stamps. Profile
   mastheads may use a preset accent (`ACCENTS` in `src/lib/fmt.ts`); nothing else gets color.
4. **Paper, not white** — cream background with a faint halftone dot grid (set on `body`).

## Tokens

CSS variables in `src/styles/app.css` (`:root`), exposed via `@theme inline`. All oklch.
**Committed light theme** — there is no dark mode; don't add `.dark` styles piecemeal.

| Token                  | Value                    | Use                                                            |
| ---------------------- | ------------------------ | -------------------------------------------------------------- |
| `--paper` / background | `oklch(0.967 0.012 90)`  | page canvas (warm cream)                                       |
| `--ink` / foreground   | `oklch(0.245 0.022 65)`  | text, borders, primary buttons, shadows                        |
| `--acid`               | `oklch(0.888 0.213 122)` | THE accent: CTAs, highlights, ticker                           |
| card                   | `oklch(0.988 0.007 90)`  | raised surfaces                                                |
| secondary / muted      | `oklch(0.928 0.015 89)`  | subtle fills, prompt blocks                                    |
| muted-foreground       | `oklch(0.49 0.024 70)`   | secondary text                                                 |
| destructive            | `oklch(0.6 0.21 32)`     | delete, errors                                                 |
| border                 | `oklch(0.855 0.02 82)`   | hairlines on inputs ONLY — structural borders are `border-ink` |
| `--radius`             | `0rem`                   | hard corners everywhere                                        |

Tailwind color classes available: `bg-paper`, `text-ink`, `bg-acid`, `border-ink` + the shadcn set.

## Typography

Fonts load from Google Fonts in `index.html`: **Archivo** (variable, width axis) + **Spline Sans
Mono**. These two are the brand — don't add more.

| Role           | Class                          | Notes                                                                                                                   |
| -------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Shouting       | `font-display` (+ `uppercase`) | Archivo 900, stretched 118%; hero `text-[clamp(2.8rem,9vw,7rem)]`, page H1 `text-4xl md:text-5xl`, card title `text-lg` |
| Eyebrow / data | `label-mono`                   | mono, 11px, bold, 0.14em tracking, caps — section labels, receipt lines, stat chips, nav links                          |
| Body           | default (Archivo 400)          | paragraphs, form values                                                                                                 |
| Receipt body   | `font-mono text-[0.8rem]`      | inside `Receipt` only                                                                                                   |

## Brand utilities (app.css)

`font-display` · `label-mono` · `shadow-hard` (5px) / `shadow-hard-sm` (3px) / `shadow-hard-acid` ·
`animate-marquee` (pair with doubled content) · `receipt-rule` (dashed divider) · `barcode` ·
`tear-edge` (zigzag receipt bottom) · `reveal` (staggered load-in; set `--i` per item). All respect
`prefers-reduced-motion`.

## Components

| Component                | File                                   | Notes                                                                                                                                                                    |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Receipt`                | `src/components/slop/receipt.tsx`      | the signature element; renders "NO RECEIPTS PROVIDED" state when empty                                                                                                   |
| `ProjectCard`            | `src/components/slop/project-card.tsx` | border-2 + shadow-hard, hover lift + tiny rotate, receipt strip footer, Featured/Draft stamps                                                                            |
| `Cover`                  | `src/components/slop/cover.tsx`        | image or deterministic pattern art from project id; `showTitle={false}` for small thumbs                                                                                 |
| `Stamp` / `SectionLabel` | `src/components/slop/stamp.tsx`        | rotated rubber stamp; `★ LABEL ———` section headers                                                                                                                      |
| `Ticker`                 | `src/components/slop/ticker.tsx`       | acid marquee strip (home only)                                                                                                                                           |
| `ChipsInput`             | `src/components/slop/chips-input.tsx`  | tags with datalist suggestions                                                                                                                                           |
| `Button`                 | `src/components/ui/button.tsx`         | brand-restyled shadcn: mono caps, border-2, shadow that collapses on hover. Variants: default (ink), **accent** (acid — primary CTAs), outline, destructive, ghost, link |
| shadcn primitives        | `src/components/ui/`                   | Card/Input/Label/Textarea keep hairline borders (forms stay quiet)                                                                                                       |

Signature patterns:

```tsx
// Section
<SectionLabel>Fresh slop</SectionLabel>

// Primary CTA
<Link to="/new" className={buttonVariants({ variant: 'accent', size: 'lg' })}>Post your slop</Link>

// Hard-edged panel
<div className="border-ink bg-card shadow-hard border-2 p-8">…</div>

// Draft/notice banner
<div className="border-ink bg-secondary label-mono border-2 border-dashed px-4 py-3">…</div>
```

## Layout

Content column is `mx-auto max-w-6xl px-5` (wider than the template's 5xl — cards need room).
Header/footer run full-width with `border-ink border-b-2`/`border-t-2`; the profile masthead and
home hero are full-bleed color bands with the column inside. Grids: `grid gap-6 sm:grid-cols-2
md:grid-cols-3`; featured first card spans 2 (`big`).

## States

- **Loading:** `label-mono text-muted-foreground` "Loading…"
- **Empty:** hard-bordered card, `font-display` headline + one wry muted line + accent CTA
  ("The stage is empty." / "Nothing on display.")
- **Moderation status:** hard-bordered mono pills — `bg-acid` (approved), `bg-secondary` (pending),
  `bg-destructive text-white` (rejected). Used in Backstage rows (`/admin`) and as owner-facing
  banners on the project page / editor / dashboard.
- **Pending:** disable + swap label ("Saving…")
- **Errors:** inline `text-destructive text-sm`; route errors → brand 404 ("No such slop").
- **Embed player:** when a project plays an embedded URL (no zip), a small `label-mono
text-muted-foreground text-xs` caption sits under the frame linking the embed hostname —
  "Embedded from `<host>` — if it stays blank, the site blocks embedding." The editor's embed URL
  input lives under the zip dropzone in "The thing itself" (standard `Input` + `label-mono` label).

## Voice / copy

In on the joke, deadpan, never mean toward the builder. Nouns: slop(s), builders, gawks (views),
the show. Receipt shouts in mono caps ("TOTAL DAMAGE", "THANK YOU FOR SLOPPING"); UI chrome stays
short and imperative ("Post your slop", "Run it", "Publish it"). Wordmark is lowercase `slopshow*`
(the asterisk is part of it). No emoji in UI (unicode glyphs ★ ✦ ▶ ⛶ are fine). Don't overdo it:
one joke per screen region.

## Don'ts

- ❌ Rounded corners, soft/large blur shadows — elevation is `shadow-hard*` only.
- ❌ New colors or Tailwind palette classes (`bg-lime-400`) — tokens only; the accent is `--acid`.
- ❌ Dark mode additions — committed light theme.
- ❌ Extra fonts, or display-weight type for body-length text.
- ❌ `allow-same-origin` on the player iframe (security, not style, but it ships in a component).
- ❌ Naked stat numbers — counts go through `fmtCount`/`plural` in `label-mono`.
- ❌ Template leftovers: `max-w-5xl` columns, default shadcn button look, "tan-starter" copy.

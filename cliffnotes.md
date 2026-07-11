# slopshow — CliffNotes

> Living map of the project. Read this before any coding session.
> Last updated: 2026-07-10. Visual language → `ui.md` · human quickstart → `README.md`.

## What this is

**slopshow.dev** — a showcase for AI-built creations. Builders get a profile page, upload their
projects as static zips (served in sandboxed iframes), and every project prints "AI receipts":
models used, estimated cost, build time, % human-written, and the prompts. Public feeds (featured /
hot / fresh), per-project stats (views/plays/clicks), admin featuring. Built on the tan-starter
template: Express 5 + Vite SSR, React Router 7, tRPC v11, Prisma 7, better-auth, Tailwind v4.

## Quick Reference

- **Dev:** `bun run dev` (http://localhost:3000 — see the port gotcha below)
- **Type-check:** `bun run typecheck` (`tsgo --noEmit`)
- **Build:** `bun run build` → `dist/client` + `dist/server`
- **Test:** `bun run test:e2e` (Playwright; isolated DB `slopshow_test` on :3100; pass
  `E2E_DATABASE_URL` if your local Postgres creds differ from `postgres:postgres`)
- **Deploy:** `docker compose up -d --build` (app + Postgres + `uploads` volume) or Render blueprint
- **Health:** `GET /healthz` (pings the DB)
- **Day-one facts:** server-only code lives in `./server/` (never import into `src/*` except
  `import type`); uploaded files live under `DATA_DIR` (`./data`, gitignored).

## Stack

Same as tan-starter (see template docs) plus: `fflate` (zip extraction), GitHub OAuth via
better-auth `socialProviders` (env-gated), raw-body uploads (no multipart), Docker deploy.

## Directory structure

```
server.ts                Express entry. Adds slopshow mounts: /api/upload/bundle,
                         /api/upload/image, /api/hit (stats beacon), /run/:id/:ver/* (sandboxed
                         bundle serving), /files/images (covers). Dev AND prod.
server/
├── env.ts               zod env: DATABASE_URL, BETTER_AUTH_*, GITHUB_CLIENT_ID/SECRET (optional),
│                        ADMIN_EMAILS, DATA_DIR. Exports adminEmails + githubEnabled flags.
├── auth.ts              better-auth: email/pw + GitHub (when configured); additionalFields
│                        username/isAdmin on session.user; user-create hook claims a username
│                        and grants admin from ADMIN_EMAILS.
├── usernames.ts         RESERVED_USERNAMES (must cover every top-level route!), slugify,
│                        isValidUsername, generateUsername.
├── bundles.ts           zip validation/extraction (fflate) to DATA_DIR/bundles/<id>/<ver>/,
│                        cover image save/delete, resolveBundleFile (traversal-safe serving).
├── stats.ts             visitorHashFor (sha256 ip|ua|day — rotates daily), recordEvent
│                        (dedupe + counter bump in one tx), dailySeries (raw SQL group-by).
├── router.ts            appRouter: config, me, profile.{update,byUsername},
│                        projects.{home,browse,get,mine,create,update,delete,stats},
│                        admin.{list,review,setFeatured,remove}. PUBLIC_WHERE gate =
│                        published && moderationStatus:approved. Exports ProjectCard type.
├── trpc.ts              createContext + public/protectedProcedure (unchanged from template)
├── prisma.ts / logger.ts  unchanged from template
src/
├── app/
│   ├── routes.tsx       Route table + loaders. Fixed routes FIRST, then /:username and
│   │                    /:username/:slug catch-alls. prefetch() helper SSR-prefetches tRPC.
│   ├── layout.tsx       nav (wordmark, Browse, Dashboard, +Post slop, @me, Settings) + footer
│   ├── home.tsx         / — ticker, hero, featured/hot/fresh grids, manifesto strip
│   ├── browse.tsx       /browse — all published, Newest/Most-gawked toggle
│   ├── profile.tsx      /:username — accent masthead + collection grid
│   ├── project.tsx      /:username/:slug — player iframe (RUN IT), receipt, prompts, owner
│   │                    card, view/play/click beacons, admin feature button
│   ├── editor.tsx       /new + /:username/:slug/edit — metadata form, zip dropzone, cover
│   │                    upload, publish/unpublish, delete
│   ├── dashboard.tsx    /dashboard — project rows (Live/In review/Rejected) + expandable stats
│   ├── admin.tsx        /admin — Backstage: moderation queue (approve/reject/feature/delete),
│   │                    filter tabs + search (admin-only)
│   ├── settings.tsx     /settings — username/bio/links/accent picker
│   ├── sign-in.tsx / sign-up.tsx  auth cards + GitHubButton
│   └── error-boundary.tsx  404 / error page, brand-styled
├── components/
│   ├── slop/            brand components: receipt.tsx (THE signature element), project-card.tsx,
│   │                    cover.tsx (deterministic placeholder art), ticker.tsx, stamp.tsx,
│   │                    chips-input.tsx, github-button.tsx
│   └── ui/              shadcn primitives (button restyled for brand, card, input, label, textarea)
├── lib/
│   ├── api.ts           sendHit beacon + uploadBundle/uploadImage (raw-body fetch)
│   ├── fmt.ts           fmtCost/fmtHours/fmtCount/fmtBytes/plural/fmtDate + ACCENTS presets
│   └── use-page-title.ts  document.title per page
prisma/schema.prisma     User(+profile fields) / Session / Account / Verification / Project /
                         StatEvent
Dockerfile + docker-compose.yml   VPS deploy (app + postgres + uploads volume)
e2e/smoke.spec.ts        signed-out pages + full sign-up→post→publish→receipt flow
data/                    (gitignored) DATA_DIR: bundles/<projectId>/<version>/, images/
```

## File map (concept → path)

| Concept / task                  | Location                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Add a page / route              | `src/app/<name>.tsx` + `src/app/routes.tsx` (BEFORE the :username catch-alls; add the path to `RESERVED_USERNAMES`) |
| tRPC procedures                 | `server/router.ts`                                                                                                  |
| Upload / zip handling           | `server/bundles.ts` + mounts in `server.ts`                                                                         |
| Stats recording / queries       | `server/stats.ts` + `/api/hit` in `server.ts`                                                                       |
| Receipt / card look             | `src/components/slop/receipt.tsx`, `project-card.tsx`                                                               |
| Auth config / username claiming | `server/auth.ts`, `server/usernames.ts`                                                                             |
| Design tokens / brand utilities | `src/styles/app.css` (see `ui.md`)                                                                                  |
| Env vars                        | `server/env.ts` + `.env.example` + `docker-compose.yml`                                                             |

## Routes / URLs

| Route                                  | Serves                               | File                       |
| -------------------------------------- | ------------------------------------ | -------------------------- |
| `/`                                    | Landing: featured/hot/fresh          | `src/app/home.tsx`         |
| `/browse`                              | All published projects               | `src/app/browse.tsx`       |
| `/new`                                 | Create draft (protected)             | `src/app/editor.tsx`       |
| `/dashboard`                           | Your projects + stats (protected)    | `src/app/dashboard.tsx`    |
| `/settings`                            | Profile customization (protected)    | `src/app/settings.tsx`     |
| `/admin`                               | Backstage moderation queue (admin)   | `src/app/admin.tsx`        |
| `/sign-in` · `/sign-up`                | Auth                                 | `src/app/sign-{in,up}.tsx` |
| `/:username`                           | Builder profile                      | `src/app/profile.tsx`      |
| `/:username/:slug`                     | Project page (player + receipt)      | `src/app/project.tsx`      |
| `/:username/:slug/edit`                | Editor (owner)                       | `src/app/editor.tsx`       |
| `/run/:projectId/:ver/*`               | Sandboxed bundle files (CSP sandbox) | `server.ts`                |
| `/files/images/*`                      | Cover images (static)                | `server.ts`                |
| `/api/upload/bundle`                   | POST raw zip (?projectId=)           | `server.ts`                |
| `/api/upload/image`                    | POST raw image                       | `server.ts`                |
| `/api/hit`                             | POST stats beacon {projectId, kind}  | `server.ts`                |
| `/api/auth/*` `/api/trpc/*` `/healthz` | template mounts                      | `server.ts`                |

## Systems

### Hosted bundles (the core feature)

Upload: client POSTs the zip bytes raw (`src/lib/api.ts`) → `extractBundle` validates (no `..`/
absolute/drive paths, ≤2000 files, must contain `index.html`; a single wrapping folder is
auto-stripped) → files land in `DATA_DIR/bundles/<projectId>/<version>/`; version bumps on each
upload and old versions are deleted. Serving: `/run/:id/:version/*` sends files with
`Content-Security-Policy: sandbox allow-scripts allow-pointer-lock allow-forms allow-modals` and
**no allow-same-origin** — the bundle gets an opaque origin whether iframed or opened directly, so
uploaded JS can't touch slopshow cookies/storage. The iframe in `project.tsx` sets the same sandbox
attribute (kept in sync by hand). The version in the URL makes aggressive caching safe.

**Absolute-path fixup** (the thing that makes arbitrary Vite/CRA builds "just run"): bundles are
hosted at the subpath `/run/:id/:ver/`, but build tools default to root-absolute URLs (`/assets/x.js`,
and `public/` assets as `/tiles/y.png`) that assume the app owns the origin root — served from a
subpath they 404, and from the opaque-origin sandbox read as CORS errors. We fix it at **serve time,
no rebuild required** (`server/bundles.ts` → `renderBundleHtml`/`renderBundleCss`, wired into the
`/run` handler in `server.ts`): (1) rewrite absolute `src`/`href`/`poster` in HTML and `url(/…)` in
CSS to the bundle base; (2) inject a runtime shim at the top of `<head>` that patches
`fetch`/`XHR`/element `src`·`href`·`setAttribute` so JS-constructed absolute paths (`/tiles/…`) get
rewritten too; (3) send `Access-Control-Allow-Origin: *` on `/run` responses — module scripts and
`crossorigin` stylesheets/fonts are fetched in CORS mode from the null origin and are blocked without
it. HTML/CSS use `must-revalidate` (rewritten per-request); other assets stay `immutable`. Remaining
gaps needing per-bundle subdomains (not built): CSS `url()` inside `<style>` blocks isn't rewritten,
and client-side routers that expect to own `/` still won't match paths.

**Upload hardening** (`server/bundles.ts`): zip-bomb guard rejects **before** decompressing via
fflate's `unzipSync` `filter` (each entry's `originalSize` from the zip header) — >50MB/file or

> 200MB total throws, so a tiny crafted zip can't OOM the box. An **extension allowlist**
> (`ALLOWED_EXTENSIONS`: html/js/css/json/wasm/images/audio/video/glb·gltf·bin/fonts/txt·md·xml·…)
> rejects anything non-static (e.g. `.exe`), naming the offenders; `resolveBundleFile` re-checks it at
> serve time (defense in depth). Cover images are validated by **magic bytes** (`sniffImage`), not the
> Content-Type header, and `/files/images` sends `X-Content-Type-Options: nosniff`. Uploads are
> rate-limited to **20/user/hour** (bundle + image share the bucket → 429; `server/rate-limit.ts`),
> and `projects.create` caps a user at **100 projects**.

**Alternative source — embed a URL** (`Project.embedUrl`, https-only): instead of a zip, a builder
can paste a URL that plays in the same sandboxed iframe. Player source priority in `project.tsx` is
**bundle → embedUrl → cover art only**; both playable sources share `IFRAME_SANDBOX` and fire the
same play/click beacons. An embed-mode player shows a mono caption linking the embed hostname
("if it stays blank, the site blocks embedding"). Set it under the zip dropzone in the editor.

### Stats

Client beacons (`sendHit`): `view` on project-page mount, `play` on RUN IT, `click` on external
link. Server (`recordEvent`): drops bots, hashes visitor (ip|ua|day|secret — rotates daily, no raw
IPs stored), dedupes per project+kind+visitor, and increments the project's denormalized counter in
the same transaction (so feeds sort without aggregating). Unpublished projects record nothing.
Dashboard reads `projects.stats`: totals + 14-day daily series + top referrers.

### Usernames & profiles

Claimed automatically on signup (slugified name/email, deduped) via better-auth's user-create hook;
editable in `/settings`. `RESERVED_USERNAMES` in `server/usernames.ts` must contain every top-level
path — `/:username` is a catch-all. Profile accent (masthead color) comes from `ACCENTS` presets in
`src/lib/fmt.ts`.

### Moderation / admin

`User.isAdmin` (granted at signup when email ∈ `ADMIN_EMAILS`) unlocks **Backstage** (`/admin`,
nav link + route guarded by `requireAdmin`). **Approval gate:** a project is publicly visible only
when `published && moderationStatus === 'approved'` (the `PUBLIC_WHERE` filter, spread into every
public query — home/browse/profile-of-others/`projects.get`). New projects and re-uploaded bundles
land as `pending`; owners publish into a review queue, an admin approves (→ live) or rejects (→
stays hidden, with a `reviewNote` shown back to the owner on the project/editor/dashboard).
Procedures: `admin.list` (queue with filter tabs pending/approved/rejected/drafts/all + search +
counts), `admin.review` ({decision, note}), `admin.setFeatured`, `admin.remove` (hard delete any
project + files). Admins also see Approve/Reject/Feature inline on the project page; owners/admins
can still preview their own non-live projects. Featuring still drives home's featured shelf
(ordered by `featuredAt`). Re-uploading a bundle on an approved project resets it to `pending`
(see `server.ts` upload handler) so unreviewed content can't silently swap in.

### Link previews / per-page SSR head

`index.html` has an `<!--app-head-->` placeholder (the static title/OG tags were removed).
`entry-server.tsx` `render()` builds a `head` string after the loaders resolve — it reads the
matched route (`routerContext.matches` leaf `route.path`/`params`) and pulls the already-prefetched
data straight out of the query cache (`queryClient.getQueryData(trpc.….queryOptions(…).queryKey)`,
no extra DB hit). Project pages get `«title» by @user — slopshow` + tagline/excerpt + absolute
`og:image` (cover) + `summary_large_image`; profile pages get `@username — slopshow` + bio;
everything else gets the site-wide default. **Only published+approved projects get a rich head** —
drafts/pending/rejected and 404s fall back to the default (no leaked titles). All interpolated
user input is HTML-escaped. `server.ts` swaps the placeholder for `head` (function replacer, so `$`
in user content is safe). The client-side `usePageTitle` still handles client navigations.

## Data model

Template auth models plus: `User` profile fields (username unique, bio, website, githubHandle,
twitterHandle, accent, isAdmin) · `Project` (slug unique per owner, title/tagline/description,
coverImage, externalUrl, embedUrl (https-only embed source), published/featured, moderationStatus
(pending|approved|rejected) + reviewNote/reviewedAt, receipts:
models[]/tools[]/costUsd/buildHours/humanPercent/promptNotes,
bundleVersion/bundleSize, denormalized view/play/clickCount) · `StatEvent` (projectId, kind,
visitorHash, referrer). Projects are created as drafts (`published: false`, `moderationStatus:
pending`); the owner's Publish button submits them to the admin review queue, not straight to live.

## Gotchas & hard rules

- All template gotchas still apply (`~/*` alias, server-only imports, Express 5, `.env` loading,
  `db:generate` after schema edits, JSON-safe tRPC returns, no `asChild`, Tailwind v4 tokens).
- **New fixed route? Reserve the name** in `server/usernames.ts` or a user can squat it and the
  route table will shadow their profile anyway (fixed routes match first).
- **Never add `allow-same-origin`** to the bundle iframe sandbox or the `/run` CSP header —
  that's the entire security model for hosting arbitrary uploaded HTML/JS.
- **Windows dev: port 3000 may be double-bound.** Windows lets two processes listen on 3000
  without an error; if another dev server is running, requests race. Run
  `PORT=3005 BETTER_AUTH_URL=http://localhost:3005 bun run dev` when in doubt.
- Local Postgres credentials live in the gitignored `.env` (never commit them). e2e needs
  `E2E_DATABASE_URL` pointing at your test DB, e.g.
  `E2E_DATABASE_URL=postgres://postgres:<your-password>@localhost:5432/slopshow_test`.
- Playwright screenshots pass `animations: 'disabled'` — the marquee/reveal animations are
  otherwise flaky in pixel diffs.
- Uploads are raw-body POSTs (`express.raw`), NOT multipart — keep client and server in sync.
- **Stored URLs must be http(s)** — `externalUrl`/`website`/`embedUrl` go through `httpish`/
  `httpsOnly` in `router.ts` (zod `.url()` alone accepts `javascript:…`, an XSS vector once rendered
  as an href). Reuse those helpers for any new user-supplied URL. `embedUrl` is https-only.
- The `/run` CSP sandbox and `project.tsx` `IFRAME_SANDBOX` must stay identical and must NOT include
  `allow-downloads`/`allow-popups`/`allow-same-origin`.
- Receipt numeric fields (`costUsd`, `buildHours`, `humanPercent`) are nullable — "not reported"
  is a meaningful state the receipt renders differently.

## Status

- **Done** — full product: auth (email + optional GitHub), auto-claimed usernames, project CRUD
  with drafts, zip upload → sandboxed hosting, cover images, receipts, profiles with accent
  customization, home/browse feeds, stats (beacons, dedupe, dashboard chart, referrers), admin
  featuring + moderation queue (approval gate: publish → review → approve/reject at /admin),
  embed-a-URL alternative to zip uploads, upload hardening (zip-bomb/extension/magic-byte/rate
  limits), SSR per-page OG meta tags, brand design system, e2e suite (4 passing), Docker deploy
  files. Verified end-to-end in a real browser 2026-07-10.
- **Not built** — pagination on browse (takes 60), email verification, per-visitor rate limiting on
  `/api/hit` (uploads are limited; hits aren't), S3-compatible storage driver (local disk only),
  likes/comments, GitHub OAuth app creds (env is wired, user must create the app).
- **Next:** deploy to the VPS behind the slopshow.dev domain; create the GitHub OAuth app; seed a
  few real projects before launch.

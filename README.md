# slopshow\*

**The gallery for AI-built games, toys, apps and other beautiful garbage.**

You spent $40 and a weekend making a game about a sad vacuum cleaner. That deserves an audience.
slopshow gives every builder a page, hosts their creations (upload a zip, it runs in the browser),
and prints the receipts: what model built it, what it cost, how long it took, and what percent a
human actually typed.

## Features

- **Hosted creations** — zip up a static build (`index.html` at the root), drop it in, and it runs
  in a sandboxed iframe on your project page. No more GitHub Pages nobody visits.
- **AI receipts** — every project shows models, tools, estimated spend, build time, and the
  human/robot split, printed as a literal thermal receipt.
- **Builder pages** — `slopshow.dev/you` with a bio, links, a customizable masthead, and your
  whole collection.
- **Stats** — views, plays, and click-throughs per project (deduped per visitor per day), with a
  14-day chart and top referrers on your dashboard.
- **Featured & fresh** — a curated featured shelf plus hot-this-week and newest feeds.
- **Prompts included** — share the magic words that did the heavy lifting.

## Stack

Bun · Express 5 + Vite SSR · React Router 7 · tRPC v11 · Prisma 7 + Postgres · better-auth
(email/password + GitHub OAuth) · Tailwind v4. See `cliffnotes.md` for the map and `ui.md` for the
visual language.

## Run it

```sh
bun install
createdb slopshow            # or point .env at any Postgres
cp .env.example .env         # fill in BETTER_AUTH_SECRET etc.
bun run db:push
bun run dev                  # → http://localhost:3000
```

## Deploy (VPS / Docker)

```sh
BETTER_AUTH_SECRET=$(openssl rand -base64 32) docker compose up -d --build
```

Uploaded bundles/images live in the `uploads` volume (`DATA_DIR=/data`). Set `BETTER_AUTH_URL` to
your public origin and `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` for the GitHub sign-in button
(callback: `<origin>/api/auth/callback/github`). `ADMIN_EMAILS` grants featuring powers.

## Tests

```sh
bun run typecheck
bun run test:e2e             # Playwright, isolated DB on :3100
```

---

_Yes, a model built this site too. 2% human._

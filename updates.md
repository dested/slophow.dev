# Updates

Terse task log. Newest first.

- **2026-07-11** — Gave dev a named URL via **portless** (vercel-labs, added as devDep). `bun run dev`
  now runs `portless run cross-env BETTER_AUTH_URL=https://slopshow.localhost bun --watch server.ts`
  → serves at `https://slopshow.localhost` (portless injects a random `PORT`, server already reads
  `process.env.PORT`; `BETTER_AUTH_URL` set to match so auth cookies/redirects work). `portless.json`
  pins the name `slopshow`. Old raw script kept as `dev:raw`. Verified: home SSR returns 200 with the
  right `<title>` through the named HTTPS URL.

- **2026-07-11** — Fixed uploaded bundles that use root-absolute asset paths (Vite/CRA default) 404ing
  + CORS-erroring when served from `/run/:id/:ver/`. Serve-time fix, no rebuild needed: rewrite
  absolute `src`/`href`/`url(/…)` in HTML/CSS to the bundle base, inject a runtime shim
  (`fetch`/`XHR`/element setters) for JS-constructed absolute paths like `/tiles/…`, and add
  `Access-Control-Allow-Origin: *` to `/run` (opaque-origin sandbox needs it for module scripts &
  crossorigin stylesheets). `server/bundles.ts` (`renderBundleHtml`/`renderBundleCss`) + `/run`
  handler in `server.ts`. Verified end-to-end against a real 833-file bundle.

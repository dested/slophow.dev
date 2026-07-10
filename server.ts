import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { toNodeHandler } from 'better-auth/node'
import express from 'express'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { auth } from './server/auth'
import {
  ensureDataDirs,
  extractBundle,
  imagesDir,
  resolveBundleFile,
  saveImage,
  UploadError,
} from './server/bundles'
import { env } from './server/env'
import { formatError, log, requestLogger, startupBanner } from './server/logger'
import { prisma } from './server/prisma'
import { rateLimit } from './server/rate-limit'
import { appRouter } from './server/router'
import { createContext } from './server/trpc'
import { recordEvent, STAT_KINDS, type StatKind } from './server/stats'

// Uploads are cheap to abuse (disk + CPU on extraction). Cap per user per hour.
const UPLOADS_PER_HOUR = 20
const UPLOAD_WINDOW_MS = 60 * 60 * 1000

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProd = process.env.NODE_ENV === 'production'
const PORT = Number(process.env.PORT ?? 3000)

const resolve = (p: string) => path.resolve(__dirname, p)

// Requests with a file extension that reach the SSR catch-all are misses
// (favicon.ico, source maps, stray .png). Render the SPA only for extension-less
// paths so these 404 fast instead of returning a full HTML doc with status 200.
const LOOKS_LIKE_FILE = /\.[a-zA-Z0-9]+$/

async function createServer() {
  const app = express()
  app.disable('x-powered-by')

  // One tidy log line per request (status + timing), asset noise filtered out.
  app.use(requestLogger(isProd))

  // Liveness/readiness probe — pings the DB. Used by Render's health check.
  app.get('/healthz', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      res.json({ status: 'ok', uptime: process.uptime() })
    } catch (e) {
      log.error(`healthz db check failed: ${formatError(e)}`)
      res.status(503).json({ status: 'error', error: 'database unreachable' })
    }
  })

  // better-auth handler — mounted BEFORE express.json() (better-auth reads
  // the raw body itself).
  app.all('/api/auth/*splat', toNodeHandler(auth))

  // ————— slopshow: uploads, stats beacon, hosted bundles —————

  ensureDataDirs()
  // Real client IPs for visitor hashing when behind a reverse proxy.
  app.set('trust proxy', 1)

  const sessionFromReq = async (req: express.Request) => {
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers.set(key, value)
    }
    return auth.api.getSession({ headers })
  }

  // Zip upload → extracted bundle. Raw body (not multipart): the client POSTs
  // the file bytes directly with the project id in the query string.
  app.post(
    '/api/upload/bundle',
    express.raw({ type: () => true, limit: '100mb' }),
    async (req, res) => {
      try {
        const session = await sessionFromReq(req)
        if (!session) return void res.status(401).json({ error: 'Sign in first.' })
        if (!rateLimit(`upload:${session.user.id}`, UPLOADS_PER_HOUR, UPLOAD_WINDOW_MS)) {
          return void res.status(429).json({
            error: "Whoa, that's a lot of uploads. Take a breather and try again shortly.",
          })
        }
        const projectId = String(req.query.projectId ?? '')
        const project = await prisma.project.findUnique({ where: { id: projectId } })
        if (!project || project.ownerId !== session.user.id) {
          return void res.status(404).json({ error: 'Project not found.' })
        }
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          return void res.status(400).json({ error: 'Empty upload.' })
        }
        const version = project.bundleVersion + 1
        const { size, fileCount } = extractBundle(project.id, version, req.body)
        await prisma.project.update({
          where: { id: project.id },
          data: {
            bundleVersion: version,
            bundleSize: size,
            // New content re-enters the moderation queue — an approved project
            // can't silently swap in a different (unreviewed) bundle.
            ...(project.moderationStatus === 'approved'
              ? { moderationStatus: 'pending', reviewNote: null, reviewedAt: null }
              : {}),
          },
        })
        res.json({ version, size, fileCount })
      } catch (e) {
        if (e instanceof UploadError) return void res.status(400).json({ error: e.message })
        log.error(`bundle upload failed: ${formatError(e)}`)
        res.status(500).json({ error: 'Upload failed.' })
      }
    }
  )

  // Cover image upload — returns the stored filename; the client attaches it
  // to a project via projects.update.
  app.post(
    '/api/upload/image',
    express.raw({ type: 'image/*', limit: '8mb' }),
    async (req, res) => {
      try {
        const session = await sessionFromReq(req)
        if (!session) return void res.status(401).json({ error: 'Sign in first.' })
        if (!rateLimit(`upload:${session.user.id}`, UPLOADS_PER_HOUR, UPLOAD_WINDOW_MS)) {
          return void res.status(429).json({
            error: "Whoa, that's a lot of uploads. Take a breather and try again shortly.",
          })
        }
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          return void res.status(400).json({ error: 'Empty upload.' })
        }
        const name = saveImage(req.headers['content-type'] ?? '', req.body)
        res.json({ name })
      } catch (e) {
        if (e instanceof UploadError) return void res.status(400).json({ error: e.message })
        log.error(`image upload failed: ${formatError(e)}`)
        res.status(500).json({ error: 'Upload failed.' })
      }
    }
  )

  // Stats beacon: {projectId, kind: view|play|click}. Deduped per visitor per
  // day server-side; always 204 so the client never cares.
  app.post('/api/hit', express.json({ limit: '2kb' }), async (req, res) => {
    res.status(204).end()
    try {
      const { projectId, kind } = req.body ?? {}
      if (typeof projectId !== 'string' || !STAT_KINDS.includes(kind)) return
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { published: true },
      })
      if (!project?.published) return
      await recordEvent(projectId, kind as StatKind, req)
    } catch (e) {
      log.error(`stat hit failed: ${formatError(e)}`)
    }
  })

  // Hosted bundles. The CSP sandbox (deliberately NO allow-same-origin) gives
  // every bundle an opaque origin — uploaded HTML/JS can run but can't touch
  // slopshow cookies or storage, embedded or opened directly.
  const RUN_HEADERS = {
    'Content-Security-Policy': 'sandbox allow-scripts allow-pointer-lock allow-forms allow-modals',
    'X-Content-Type-Options': 'nosniff',
    // The version is in the URL, so aggressive caching is safe.
    'Cache-Control': 'public, max-age=31536000, immutable',
  }
  app.get('/run/:projectId/:version{/*splat}', (req, res) => {
    const { projectId, version } = req.params as { projectId: string; version: string }
    const splat = (req.params as Record<string, unknown>).splat
    const rel = Array.isArray(splat) ? splat.join('/') : typeof splat === 'string' ? splat : ''
    const file = resolveBundleFile(projectId, version, rel)
    if (!file) return void res.status(404).type('txt').end('Not found')
    res.sendFile(file, { headers: RUN_HEADERS, dotfiles: 'deny' })
  })

  // Uploaded cover images.
  app.use(
    '/files/images',
    express.static(imagesDir, {
      immutable: true,
      maxAge: '30d',
      index: false,
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    })
  )

  app.use(
    '/api/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, type, path: trpcPath, input }) {
        log.error(`[trpc] ${type} ${trpcPath ?? '<unknown>'} ${error.code} — ${error.message}`, {
          input,
        })
        if (error.code === 'INTERNAL_SERVER_ERROR' && error.stack) {
          console.error(error.stack)
        }
      },
    })
  )

  let vite: Awaited<ReturnType<typeof import('vite').createServer>> | undefined

  if (!isProd) {
    vite = await (
      await import('vite')
    ).createServer({
      root: __dirname,
      // Explicit HMR port — without it vite logs "Port undefined is already in
      // use" in middleware mode.
      server: { middlewareMode: true, hmr: { port: 24678 } },
      appType: 'custom',
    })
    app.use(vite.middlewares)
  } else {
    app.use(
      (await import('compression')).default(),
      express.static(resolve('./dist/client'), { index: false })
    )
  }

  const indexProd = isProd ? fs.readFileSync(resolve('./dist/client/index.html'), 'utf-8') : ''

  app.use(async (req, res) => {
    // Unmatched API routes return JSON, never the HTML SPA.
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'Not found' })
      return
    }
    // Only GET requests for extension-less paths are SSR navigations.
    if (req.method !== 'GET' || LOOKS_LIKE_FILE.test(req.path)) {
      res.status(404).type('txt').end('Not found')
      return
    }
    try {
      let template: string
      let render: typeof import('./src/entry-server').render

      if (!isProd && vite) {
        template = fs.readFileSync(resolve('./index.html'), 'utf-8')
        template = await vite.transformIndexHtml(req.originalUrl, template)
        render = (await vite.ssrLoadModule('/src/entry-server.tsx')).render
      } else {
        template = indexProd
        // @ts-ignore — produced by `vite build --ssr`; may not exist before first build
        render = (await import('./dist/server/entry-server.js')).render
      }

      const { html: appHtml, status, head, dehydratedState } = await render(req)

      const stateScript = `<script>window.__SSR_STATE__ = ${jsonForScript({ dehydratedState })}</script>`
      // Function replacers: head/appHtml carry user content that may include `$`,
      // which String.replace would otherwise treat as a substitution pattern.
      const html = template
        .replace('<!--app-head-->', () => head)
        .replace('<!--app-state-->', stateScript)
        .replace('<!--app-html-->', () => appHtml)

      res.status(status).set({ 'Content-Type': 'text/html' }).end(html)
    } catch (e: unknown) {
      if (e instanceof Response) {
        const location = e.headers.get('location')
        if (location) {
          res.redirect(e.status, location)
        } else {
          const body = await e.text()
          res.status(e.status).end(body)
        }
        return
      }
      if (!isProd && vite) vite.ssrFixStacktrace(e as Error)
      log.error(`SSR render failed for ${req.method} ${req.originalUrl}`)
      console.error(formatError(e))
      res
        .status(500)
        .type('txt')
        .end(isProd ? 'Internal Server Error' : formatError(e))
    }
  })

  app.listen(PORT, () => {
    startupBanner({
      port: PORT,
      isProd,
      databaseUrl: env.DATABASE_URL,
      routes: [
        '/',
        '/browse',
        '/new',
        '/dashboard',
        '/settings',
        '/healthz',
        '/api/trpc',
        '/api/auth',
        '/run',
      ],
    })
  })
}

// JSON for safe inline-script embedding: escape `<` so `</script>` can't
// terminate the script tag.
function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

createServer().catch((e) => {
  log.error('failed to start server')
  console.error(formatError(e))
  process.exit(1)
})

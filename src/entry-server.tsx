import type * as express from 'express'
import { dehydrate, QueryClient, type DehydratedState } from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { createTRPCOptionsProxy, type TRPCOptionsProxy } from '@trpc/tanstack-react-query'
import ReactDomServer from 'react-dom/server'
import { StaticRouterProvider, createStaticHandler, createStaticRouter } from 'react-router-dom'
import { auth, type Session } from '../server/auth'
import { env } from '../server/env'
import { appRouter } from '../server/router'
import App from './App'
import { routes, type SsrLoaderContext } from './app/routes'

export async function render(req: express.Request): Promise<{
  html: string
  status: number
  session: Session | null
  head: string
  dehydratedState: DehydratedState
}> {
  const fetchRequest = expressToFetch(req)

  const session = await auth.api.getSession({ headers: fetchRequest.headers })

  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000 } },
  })

  const trpcServer = createTRPCOptionsProxy({
    router: appRouter,
    ctx: { session },
    queryClient,
  })

  const { query, dataRoutes } = createStaticHandler(routes)
  const ssrContext: SsrLoaderContext = { session, queryClient, trpc: trpcServer }
  const routerContext = await query(fetchRequest, { requestContext: ssrContext })

  if (routerContext instanceof Response) throw routerContext

  // Per-page <head> for link previews, built from the matched route + the data
  // the loaders already prefetched into the query cache (no extra DB hit).
  const head = buildHead(routerContext.matches, queryClient, trpcServer)

  const router = createStaticRouter(dataRoutes, routerContext)

  // Loopback tRPC client for any non-prefetched query that runs during render.
  // Prefetched queries land in queryClient cache and won't hit this.
  const cookieHeader = req.headers.cookie
  const trpcClient = createTRPCClient<typeof appRouter>({
    links: [
      httpBatchLink({
        url: `http://localhost:${process.env.PORT ?? 3000}/api/trpc`,
        headers: () => (cookieHeader ? { cookie: cookieHeader } : {}),
      }),
    ],
  })

  const html = ReactDomServer.renderToString(
    <App queryClient={queryClient} trpcClient={trpcClient} dehydratedState={null}>
      <StaticRouterProvider router={router} context={routerContext} />
    </App>
  )

  // statusCode reflects loader-thrown Responses and unmatched-route 404s, so
  // the server returns the right HTTP status (not a blanket 200).
  return {
    html,
    status: routerContext.statusCode,
    session,
    head,
    dehydratedState: dehydrate(queryClient),
  }
}

// ————— per-page <head> —————

const SITE = 'slopshow'
const DEFAULT_TITLE = 'slopshow — show off the stuff you built with AI'
const DEFAULT_DESCRIPTION =
  'The gallery for AI-built games, toys, apps and other beautiful garbage. Upload it, share one link, show the receipts — model, cost, build time, and how much of it you actually wrote.'
const DEFAULT_OG_DESCRIPTION =
  'Upload your AI-built creations, share one link, show the receipts: model, cost, build time, % human-written.'

// title / tagline / bio are user input — escape before interpolating into HTML.
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderHead(fields: {
  title: string
  description: string
  ogTitle?: string
  ogDescription?: string
  ogType?: string
  ogImage?: string | null
}): string {
  const ogTitle = fields.ogTitle ?? fields.title
  const ogDescription = fields.ogDescription ?? fields.description
  const tags = [
    `<title>${esc(fields.title)}</title>`,
    `<meta name="description" content="${esc(fields.description)}" />`,
    `<meta property="og:title" content="${esc(ogTitle)}" />`,
    `<meta property="og:description" content="${esc(ogDescription)}" />`,
    `<meta property="og:type" content="${esc(fields.ogType ?? 'website')}" />`,
    `<meta property="og:site_name" content="${SITE}" />`,
    `<meta name="twitter:card" content="${fields.ogImage ? 'summary_large_image' : 'summary'}" />`,
  ]
  if (fields.ogImage) tags.push(`<meta property="og:image" content="${esc(fields.ogImage)}" />`)
  return tags.join('\n    ')
}

type ProjectHeadData = {
  title: string
  tagline: string | null
  description: string | null
  coverImage: string | null
  published: boolean
  moderationStatus?: string
}
type ProfileHeadData = { user: { username: string | null; bio: string | null } }

function buildHead(
  matches: { params: Record<string, string | undefined>; route: { path?: string } }[],
  queryClient: QueryClient,
  trpc: TRPCOptionsProxy<typeof appRouter>
): string {
  const leaf = matches[matches.length - 1]
  const path = leaf?.route.path
  const params = leaf?.params ?? {}

  if (path === ':username/:slug' && params.username && params.slug) {
    const data = queryClient.getQueryData(
      trpc.projects.get.queryOptions({ username: params.username, slug: params.slug }).queryKey
    ) as ProjectHeadData | undefined
    // Only public (published + approved) projects get a rich head — never leak a
    // draft/pending/rejected title, even when the owner or an admin is viewing.
    if (data && data.published && data.moderationStatus === 'approved') {
      const excerpt = data.description ? data.description.replace(/\s+/g, ' ').slice(0, 200) : ''
      return renderHead({
        title: `${data.title} by @${params.username} — ${SITE}`,
        description: data.tagline || excerpt || DEFAULT_DESCRIPTION,
        ogType: 'article',
        ogImage: data.coverImage ? `${env.BETTER_AUTH_URL}/files/images/${data.coverImage}` : null,
      })
    }
  }

  if (path === ':username' && params.username) {
    const data = queryClient.getQueryData(
      trpc.profile.byUsername.queryOptions({ username: params.username }).queryKey
    ) as ProfileHeadData | undefined
    if (data?.user) {
      const uname = data.user.username ?? params.username
      return renderHead({
        title: `@${uname} — ${SITE}`,
        description: data.user.bio || `AI-built creations by @${uname} on ${SITE}.`,
        ogType: 'profile',
      })
    }
  }

  return renderHead({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    ogDescription: DEFAULT_OG_DESCRIPTION,
  })
}

function expressToFetch(req: express.Request): Request {
  const origin = `${req.protocol}://${req.get('host')}`
  const url = new URL(req.originalUrl || req.url, origin)
  const controller = new AbortController()
  req.on('close', () => controller.abort())

  const headers = new Headers()
  for (const [key, values] of Object.entries(req.headers)) {
    if (!values) continue
    if (Array.isArray(values)) {
      for (const v of values) headers.append(key, v)
    } else {
      headers.set(key, values)
    }
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    signal: controller.signal,
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') init.body = req.body

  return new Request(url.href, init)
}

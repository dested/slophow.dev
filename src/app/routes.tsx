import { redirect, type RouteObject, type LoaderFunctionArgs } from 'react-router-dom'
import type { QueryClient } from '@tanstack/react-query'
import type { TRPCOptionsProxy } from '@trpc/tanstack-react-query'
import { authClient } from '~/lib/auth-client'
import type { Session } from '../../server/auth'
import type { AppRouter } from '../../server/router'
import { BrowsePage } from './browse'
import { DashboardPage } from './dashboard'
import { EditorPage } from './editor'
import { RouteErrorBoundary } from './error-boundary'
import { HomePage } from './home'
import { Layout } from './layout'
import { ProfilePage } from './profile'
import { ProjectPage } from './project'
import { SettingsPage } from './settings'
import { SignInPage } from './sign-in'
import { SignUpPage } from './sign-up'

// Per-request context populated by entry-server.tsx and handed to loaders via
// createStaticHandler.query(req, { requestContext }). Only available SSR-side.
// On the client, loaders fall back to authClient HTTP calls; data queries run
// through useQuery as usual.
export type SsrLoaderContext = {
  session: Session | null
  queryClient: QueryClient
  trpc: TRPCOptionsProxy<AppRouter>
}

export type RootLoaderData = { session: Session | null }

async function fetchClientSession(): Promise<Session | null> {
  const { data, error } = await authClient.getSession()
  if (error || !data) return null
  return data as Session
}

async function rootLoader({ context }: LoaderFunctionArgs): Promise<RootLoaderData> {
  if (typeof window === 'undefined') {
    return { session: (context as SsrLoaderContext).session }
  }
  return { session: await fetchClientSession() }
}

// SSR: prefetch a tRPC query into the dehydrated cache so the first paint has
// data. Client navigations skip this (useQuery fetches with loading states).
function prefetch(run: (ctx: SsrLoaderContext, args: LoaderFunctionArgs) => Promise<unknown>) {
  return async (args: LoaderFunctionArgs) => {
    if (typeof window === 'undefined') {
      await run(args.context as SsrLoaderContext, args)
    }
    return null
  }
}

async function requireSession({ context }: LoaderFunctionArgs): Promise<RootLoaderData> {
  const session =
    typeof window === 'undefined'
      ? (context as SsrLoaderContext).session
      : await fetchClientSession()
  if (!session) throw redirect('/sign-in')
  return { session }
}

async function redirectIfSignedIn({ context }: LoaderFunctionArgs) {
  const session =
    typeof window === 'undefined'
      ? (context as SsrLoaderContext).session
      : await fetchClientSession()
  if (session) throw redirect('/dashboard')
  return null
}

export const routes: RouteObject[] = [
  {
    id: 'root',
    path: '/',
    Component: Layout,
    loader: rootLoader,
    ErrorBoundary: RouteErrorBoundary,
    children: [
      {
        index: true,
        Component: HomePage,
        loader: prefetch((ctx) =>
          ctx.queryClient.prefetchQuery(ctx.trpc.projects.home.queryOptions())
        ),
      },
      {
        path: 'browse',
        Component: BrowsePage,
        loader: prefetch((ctx) =>
          ctx.queryClient.prefetchQuery(ctx.trpc.projects.browse.queryOptions({ sort: 'new' }))
        ),
      },
      { path: 'sign-in', Component: SignInPage, loader: redirectIfSignedIn },
      { path: 'sign-up', Component: SignUpPage, loader: redirectIfSignedIn },
      { path: 'new', Component: EditorPage, loader: requireSession },
      {
        path: 'dashboard',
        Component: DashboardPage,
        loader: async (args: LoaderFunctionArgs) => {
          const data = await requireSession(args)
          if (typeof window === 'undefined') {
            const ctx = args.context as SsrLoaderContext
            await ctx.queryClient.prefetchQuery(ctx.trpc.projects.mine.queryOptions())
          }
          return data
        },
      },
      {
        path: 'settings',
        Component: SettingsPage,
        loader: async (args: LoaderFunctionArgs) => {
          const data = await requireSession(args)
          if (typeof window === 'undefined') {
            const ctx = args.context as SsrLoaderContext
            await ctx.queryClient.prefetchQuery(ctx.trpc.me.queryOptions())
          }
          return data
        },
      },
      // Catch-alls — every fixed route above wins first; usernames matching
      // fixed paths are rejected at claim time (server/usernames.ts).
      {
        path: ':username',
        Component: ProfilePage,
        loader: prefetch((ctx, { params }) =>
          ctx.queryClient.prefetchQuery(
            ctx.trpc.profile.byUsername.queryOptions({ username: params.username! })
          )
        ),
      },
      {
        path: ':username/:slug',
        Component: ProjectPage,
        loader: prefetch((ctx, { params }) =>
          ctx.queryClient.prefetchQuery(
            ctx.trpc.projects.get.queryOptions({ username: params.username!, slug: params.slug! })
          )
        ),
      },
      { path: ':username/:slug/edit', Component: EditorPage, loader: requireSession },
    ],
  },
]

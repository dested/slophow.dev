import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
  useRevalidator,
  useRouteLoaderData,
} from 'react-router-dom'
import { buttonVariants } from '~/components/ui/button'
import { authClient } from '~/lib/auth-client'
import { cn } from '~/lib/utils'
import type { RootLoaderData } from './routes'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'label-mono hover:text-foreground transition-colors',
    isActive ? 'text-foreground' : 'text-muted-foreground'
  )
}

export function Layout() {
  const data = useRouteLoaderData('root') as RootLoaderData | undefined
  const session = data?.session ?? null
  const username = (session?.user as { username?: string | null } | undefined)?.username
  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin
  const navigate = useNavigate()
  const revalidator = useRevalidator()

  async function signOut() {
    await authClient.signOut()
    navigate('/', { replace: true })
    revalidator.revalidate()
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-ink bg-paper border-b-2">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5">
          <Link to="/" className="font-display text-xl tracking-tight uppercase">
            slopshow<span style={{ color: 'oklch(0.68 0.2 122)' }}>*</span>
          </Link>
          <NavLink to="/browse" className={navLinkClass}>
            Browse
          </NavLink>
          {session && (
            <NavLink to="/dashboard" className={navLinkClass}>
              Dashboard
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={navLinkClass}>
              Backstage
            </NavLink>
          )}
          <div className="ml-auto flex items-center gap-4">
            {session ? (
              <>
                <Link to="/new" className={buttonVariants({ variant: 'accent', size: 'sm' })}>
                  + Post slop
                </Link>
                {username && (
                  <NavLink to={`/${username}`} className={navLinkClass}>
                    @{username}
                  </NavLink>
                )}
                <Link to="/settings" className={navLinkClass({ isActive: false })}>
                  Settings
                </Link>
                <button
                  type="button"
                  className={cn(navLinkClass({ isActive: false }), 'cursor-pointer')}
                  onClick={signOut}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/sign-in" className={navLinkClass({ isActive: false })}>
                  Sign in
                </Link>
                <Link to="/sign-up" className={buttonVariants({ variant: 'accent', size: 'sm' })}>
                  Join the show
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>
      <main className="grow">
        <Outlet />
      </main>
      <footer className="border-ink mt-16 border-t-2">
        <div className="label-mono text-muted-foreground mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-6">
          <span className="text-foreground">slopshow*</span>
          <span>beautiful garbage, proudly displayed</span>
          <span className="ml-auto">the only stats we keep are the ones on your dashboard</span>
        </div>
      </footer>
    </div>
  )
}

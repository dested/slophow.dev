import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { buttonVariants } from '~/components/ui/button'

// Root route ErrorBoundary. React Router renders this in place of the layout
// when a loader/render throws OR when no route matches (a 404). It carries its
// own slim header so the page still looks intentional. The matching HTTP status
// is set server-side from `routerContext.statusCode` (see entry-server.tsx).
export function RouteErrorBoundary() {
  const error = useRouteError()
  const isNotFound = isRouteErrorResponse(error) && error.status === 404

  const title = isNotFound ? '404' : 'It broke'
  const message = isNotFound
    ? 'This page never existed, or it got swept off stage.'
    : isRouteErrorResponse(error)
      ? `${error.status} ${error.statusText}`
      : error instanceof Error
        ? error.message
        : 'An unexpected error occurred.'

  return (
    <>
      <header className="border-ink border-b-2">
        <nav className="mx-auto flex max-w-6xl items-center px-5 py-3.5">
          <Link to="/" className="font-display text-xl uppercase">
            slopshow<span style={{ color: 'oklch(0.68 0.2 122)' }}>*</span>
          </Link>
        </nav>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-5 py-16">
        <h1 className="font-display text-7xl uppercase">{title}</h1>
        <p className="text-muted-foreground">{message}</p>
        {import.meta.env.DEV && error instanceof Error && error.stack && (
          <pre className="border-ink bg-secondary max-w-full overflow-auto border-2 border-dashed p-4 font-mono text-xs">
            {error.stack}
          </pre>
        )}
        <Link to="/" className={buttonVariants({ variant: 'accent' })}>
          Back to the show
        </Link>
      </main>
    </>
  )
}

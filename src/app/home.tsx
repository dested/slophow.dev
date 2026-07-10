import { useQuery } from '@tanstack/react-query'
import { Link, useRouteLoaderData } from 'react-router-dom'
import { ProjectCard } from '~/components/slop/project-card'
import { SectionLabel } from '~/components/slop/stamp'
import { Ticker } from '~/components/slop/ticker'
import { buttonVariants } from '~/components/ui/button'
import { fmtCount } from '~/lib/fmt'
import { useTRPC } from '~/lib/trpc'
import { usePageTitle } from '~/lib/use-page-title'
import type { RootLoaderData } from './routes'

const TICKER_ITEMS = [
  'FRESH SLOP DAILY',
  'SHOW YOUR RECEIPTS',
  'GAMES · TOYS · APPS · CHAOS',
  '100% AI-CERTIFIED',
  'STOP MAKING GITHUB PAGES NOBODY VISITS',
  'YES, A MODEL BUILT THIS SITE TOO',
]

export function HomePage() {
  usePageTitle()
  const trpc = useTRPC()
  const data = useRouteLoaderData('root') as RootLoaderData | undefined
  const session = data?.session ?? null
  const home = useQuery(trpc.projects.home.queryOptions())

  const featured = home.data?.featured ?? []
  const hot = home.data?.hot ?? []
  const recent = home.data?.recent ?? []
  const stats = home.data?.siteStats

  return (
    <>
      <Ticker items={TICKER_ITEMS} />

      {/* hero */}
      <section className="border-ink border-b-2">
        <div className="mx-auto max-w-6xl px-5 pt-14 pb-12 md:pt-20 md:pb-16">
          <h1
            className="font-display reveal text-[clamp(2.8rem,9vw,7rem)] uppercase"
            style={{ '--i': 0 } as React.CSSProperties}>
            Show off
            <br />
            your{' '}
            <span className="bg-acid border-ink shadow-hard inline-block -rotate-2 border-2 px-3">
              slop
            </span>
          </h1>
          <p className="reveal mt-6 max-w-xl text-lg" style={{ '--i': 2 } as React.CSSProperties}>
            The gallery for AI-built games, toys, apps and other beautiful garbage. One page for
            your stuff, one link to share it, receipts included — the model, the cost, the hours,
            and how much of it you actually wrote.
          </p>
          <div
            className="reveal mt-8 flex flex-wrap items-center gap-4"
            style={{ '--i': 3 } as React.CSSProperties}>
            <Link
              to={session ? '/new' : '/sign-up'}
              className={buttonVariants({ variant: 'accent', size: 'lg' })}>
              Post your slop
            </Link>
            <Link to="/browse" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              Browse the show
            </Link>
            {stats && (
              <span className="label-mono text-muted-foreground">
                {fmtCount(stats.projects)} slops · {fmtCount(stats.builders)} builders ·{' '}
                {fmtCount(stats.events)} gawks
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-5 pt-12">
        {featured.length > 0 && (
          <section className="space-y-6">
            <SectionLabel>Featured slop</SectionLabel>
            <div className="grid gap-6 md:grid-cols-3">
              {featured.map((p, i) => (
                <ProjectCard key={p.id} project={p} index={i} big={i === 0} />
              ))}
            </div>
          </section>
        )}

        {hot.length > 0 && (
          <section className="space-y-6">
            <SectionLabel>Getting gawked at</SectionLabel>
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
              {hot.map((p, i) => (
                <ProjectCard key={p.id} project={p} index={i} />
              ))}
            </div>
          </section>
        )}

        <section className="space-y-6">
          <SectionLabel>Fresh slop</SectionLabel>
          {home.isLoading && <p className="label-mono text-muted-foreground">Loading…</p>}
          {home.data && recent.length === 0 && (
            <div className="border-ink bg-card shadow-hard border-2 p-10 text-center">
              <p className="font-display text-2xl uppercase">The stage is empty.</p>
              <p className="text-muted-foreground mt-2">
                Someone has to post the first slop. It may as well be you.
              </p>
              <Link
                to={session ? '/new' : '/sign-up'}
                className={buttonVariants({ variant: 'accent', className: 'mt-6' })}>
                Be the first
              </Link>
            </div>
          )}
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
            {recent.map((p, i) => (
              <ProjectCard key={p.id} project={p} index={i} />
            ))}
          </div>
        </section>

        {/* manifesto strip */}
        <section className="border-ink bg-card shadow-hard border-2 p-8 md:p-10">
          <p className="label-mono text-muted-foreground">The premise</p>
          <p className="font-display mt-3 max-w-3xl text-2xl uppercase md:text-3xl">
            You spent $40 and a weekend making a game about a sad vacuum cleaner. That deserves an
            audience.
          </p>
          <p className="text-muted-foreground mt-4 max-w-2xl">
            Every project here says what model built it, what it cost, how long it took, and what
            percent a human actually typed. No shame. That's the whole point of the show.
          </p>
        </section>
      </div>
    </>
  )
}

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Cover } from '~/components/slop/cover'
import { SectionLabel } from '~/components/slop/stamp'
import { buttonVariants } from '~/components/ui/button'
import { fmtCount } from '~/lib/fmt'
import { useTRPC } from '~/lib/trpc'
import { usePageTitle } from '~/lib/use-page-title'
import { cn } from '~/lib/utils'

export function DashboardPage() {
  usePageTitle('Dashboard')
  const trpc = useTRPC()
  const mine = useQuery(trpc.projects.mine.queryOptions())
  const [openStats, setOpenStats] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-5 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl uppercase md:text-5xl">Your slop</h1>
        <Link to="/new" className={buttonVariants({ variant: 'accent' })}>
          + Post slop
        </Link>
      </div>

      <SectionLabel>The inventory</SectionLabel>

      {mine.isLoading && <p className="label-mono text-muted-foreground">Loading…</p>}

      {mine.data?.length === 0 && (
        <div className="border-ink bg-card shadow-hard border-2 p-10 text-center">
          <p className="font-display text-2xl uppercase">Nothing posted yet.</p>
          <p className="text-muted-foreground mt-2">
            That game you made last weekend is just sitting there. Post it.
          </p>
          <Link to="/new" className={buttonVariants({ variant: 'accent', className: 'mt-6' })}>
            Post your first slop
          </Link>
        </div>
      )}

      <div className="space-y-5">
        {mine.data?.map((p) => (
          <div key={p.id} className="border-ink bg-card shadow-hard-sm border-2">
            <div className="flex flex-wrap items-center gap-4 p-4">
              <div className="border-ink aspect-video w-32 shrink-0 overflow-hidden border-2">
                <Cover id={p.id} title={p.title} coverImage={p.coverImage} showTitle={false} />
              </div>
              <div className="min-w-0">
                <p className="font-display truncate text-xl uppercase">{p.title}</p>
                <p className="label-mono text-muted-foreground mt-1">
                  {p.published ? 'Live' : 'Draft'} ·{' '}
                  {p.bundleVersion > 0 ? `bundle v${p.bundleVersion}` : 'no bundle'}
                </p>
              </div>
              <div className="label-mono ml-auto flex gap-5 text-right">
                <Tile label="views" value={p.viewCount} />
                <Tile label="plays" value={p.playCount} />
                <Tile label="clicks" value={p.clickCount} />
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  to={`/${p.owner.username}/${p.slug}`}
                  className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                  View
                </Link>
                <Link
                  to={`/${p.owner.username}/${p.slug}/edit`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => setOpenStats(openStats === p.id ? null : p.id)}
                  className={cn(
                    buttonVariants({
                      variant: openStats === p.id ? 'default' : 'outline',
                      size: 'sm',
                    }),
                    'cursor-pointer'
                  )}>
                  Stats
                </button>
              </div>
            </div>
            {openStats === p.id && <StatsPanel projectId={p.id} />}
          </div>
        ))}
      </div>
    </div>
  )
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-base font-bold">{fmtCount(value)}</p>
      <p className="text-muted-foreground text-[0.6rem]">{label}</p>
    </div>
  )
}

const KINDS = ['view', 'play', 'click'] as const
type Kind = (typeof KINDS)[number]

function StatsPanel({ projectId }: { projectId: string }) {
  const trpc = useTRPC()
  const stats = useQuery(trpc.projects.stats.queryOptions({ id: projectId }))
  const [kind, setKind] = useState<Kind>('view')

  // Last 14 days, zero-filled, oldest → newest.
  const days = useMemo(() => {
    const out: Array<{ day: string; count: number }> = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000)
      out.push({ day: d.toISOString().slice(0, 10), count: 0 })
    }
    for (const row of stats.data?.series ?? []) {
      if (row.kind !== kind) continue
      const slot = out.find((o) => o.day === row.day)
      if (slot) slot.count = row.count
    }
    return out
  }, [stats.data, kind])

  const max = Math.max(1, ...days.map((d) => d.count))
  const total14 = days.reduce((n, d) => n + d.count, 0)

  return (
    <div className="border-ink space-y-4 border-t-2 border-dashed p-4">
      {stats.isLoading && <p className="label-mono text-muted-foreground">Loading stats…</p>}
      {stats.data && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <div className="label-mono border-ink flex border-2">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={cn(
                    'cursor-pointer px-3 py-1.5 uppercase',
                    kind === k ? 'bg-ink text-paper' : 'hover:bg-secondary'
                  )}>
                  {k}s
                </button>
              ))}
            </div>
            <span className="label-mono text-muted-foreground">
              {total14} {kind}s in the last 14 days · unique visitors, per day
            </span>
          </div>

          {/* daily bars — single series, hover for exact values */}
          <div
            role="img"
            aria-label={`Daily ${kind}s over the last 14 days, total ${total14}`}
            className="flex h-24 items-end gap-[3px]">
            {days.map((d) => (
              <div
                key={d.day}
                title={`${d.day}: ${d.count} ${kind}${d.count === 1 ? '' : 's'}`}
                className="bg-ink hover:bg-acid min-h-[2px] flex-1 rounded-t-[2px] transition-colors"
                style={{
                  height: `${Math.max(2, (d.count / max) * 100)}%`,
                  opacity: d.count === 0 ? 0.15 : 1,
                }}
              />
            ))}
          </div>
          <div className="label-mono text-muted-foreground flex justify-between">
            <span>{days[0].day}</span>
            <span>today</span>
          </div>

          {stats.data.referrers.length > 0 && (
            <div>
              <p className="label-mono text-muted-foreground mb-2">Where the gawkers came from</p>
              <ul className="space-y-1 font-mono text-sm">
                {stats.data.referrers.map((r) => (
                  <li key={r.referrer} className="flex justify-between gap-4">
                    <span className="truncate">{r.referrer}</span>
                    <span className="shrink-0 font-bold">{r.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

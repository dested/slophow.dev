import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { inferRouterOutputs } from '@trpc/server'
import { Link } from 'react-router-dom'
import type { AppRouter } from '../../server/router'
import { Cover } from '~/components/slop/cover'
import { SectionLabel } from '~/components/slop/stamp'
import { Button, buttonVariants } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { fmtBytes, fmtCount, fmtDate } from '~/lib/fmt'
import { useTRPC } from '~/lib/trpc'
import { usePageTitle } from '~/lib/use-page-title'
import { cn } from '~/lib/utils'

type Filter = 'pending' | 'approved' | 'rejected' | 'drafts' | 'all'

const TABS: Array<{ key: Filter; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'all', label: 'All' },
]

export function AdminPage() {
  usePageTitle('Backstage')
  const trpc = useTRPC()
  const [filter, setFilter] = useState<Filter>('pending')
  const [q, setQ] = useState('')
  const query = useQuery(trpc.admin.list.queryOptions({ filter, q: q.trim() || undefined }))

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-5 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl uppercase md:text-5xl">Backstage</h1>
        <p className="label-mono text-muted-foreground max-w-sm text-right">
          Every upload passes through here. Approve it and it hits the feeds; reject it and it stays
          off stage.
        </p>
      </div>

      <SectionLabel>The moderation queue</SectionLabel>

      {/* filter tabs + search */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="label-mono border-ink flex flex-wrap border-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className={cn(
                'cursor-pointer px-3 py-1.5 uppercase',
                filter === t.key ? 'bg-ink text-paper' : 'hover:bg-secondary'
              )}>
              {t.label}
              {query.data && (
                <span className={cn('ml-1.5', filter === t.key ? 'opacity-80' : 'opacity-50')}>
                  {query.data.counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title or builder…"
          className="max-w-xs"
        />
      </div>

      {query.isLoading && <p className="label-mono text-muted-foreground">Loading the queue…</p>}

      {query.data?.projects.length === 0 && (
        <div className="border-ink bg-card shadow-hard border-2 p-10 text-center">
          <p className="font-display text-2xl uppercase">Nothing here.</p>
          <p className="text-muted-foreground mt-2">
            {filter === 'pending' ? 'The queue is clear. Nice.' : 'No slop matches this shelf.'}
          </p>
        </div>
      )}

      <div className="space-y-5">
        {query.data?.projects.map((p) => (
          <AdminRow key={p.id} project={p} />
        ))}
      </div>
    </div>
  )
}

type AdminProject = inferRouterOutputs<AppRouter>['admin']['list']['projects'][number]

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-acid text-ink',
  pending: 'bg-secondary text-ink',
  rejected: 'bg-destructive text-white',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'label-mono border-ink border-2 px-2 py-0.5 text-[0.65rem]',
        STATUS_STYLES[status] ?? 'bg-secondary text-ink'
      )}>
      {status}
    </span>
  )
}

function AdminRow({ project: p }: { project: AdminProject }) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState(p.reviewNote ?? '')

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.admin.list.queryKey() })
    // The public feeds change the moment something is approved/rejected/removed.
    void queryClient.invalidateQueries({ queryKey: trpc.projects.home.queryKey() })
    void queryClient.invalidateQueries({ queryKey: trpc.projects.browse.queryKey() })
  }

  const review = useMutation(
    trpc.admin.review.mutationOptions({
      onSuccess: () => {
        setRejecting(false)
        refresh()
      },
    })
  )
  const setFeatured = useMutation(trpc.admin.setFeatured.mutationOptions({ onSuccess: refresh }))
  const remove = useMutation(trpc.admin.remove.mutationOptions({ onSuccess: refresh }))

  const busy = review.isPending || setFeatured.isPending || remove.isPending
  const pageUrl = p.owner.username ? `/${p.owner.username}/${p.slug}` : null

  return (
    <div className="border-ink bg-card shadow-hard-sm border-2">
      <div className="flex flex-wrap items-center gap-4 p-4">
        <div className="border-ink aspect-video w-32 shrink-0 overflow-hidden border-2">
          <Cover id={p.id} title={p.title} coverImage={p.coverImage} showTitle={false} />
        </div>

        <div className="min-w-0 grow">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display truncate text-xl uppercase">{p.title}</p>
            <StatusBadge status={p.moderationStatus} />
            {p.featured && (
              <span className="label-mono border-ink bg-acid border-2 px-2 py-0.5 text-[0.65rem]">
                featured
              </span>
            )}
            {!p.published && (
              <span className="label-mono border-ink border-2 border-dashed px-2 py-0.5 text-[0.65rem]">
                unpublished
              </span>
            )}
          </div>
          <p className="label-mono text-muted-foreground mt-1">
            @{p.owner.username ?? '—'} · {p.owner.email} · {fmtDate(p.createdAt)}
          </p>
          <p className="label-mono text-muted-foreground mt-1">
            {p.bundleVersion > 0
              ? `bundle v${p.bundleVersion}${p.bundleSize ? ` · ${fmtBytes(p.bundleSize)}` : ''}`
              : 'no bundle'}{' '}
            · {fmtCount(p.viewCount)} views · {fmtCount(p.playCount)} plays ·{' '}
            {fmtCount(p.clickCount)} clicks
          </p>
          {p.moderationStatus === 'rejected' && p.reviewNote && (
            <p className="label-mono text-destructive mt-1">Note: {p.reviewNote}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {pageUrl && (
            <Link to={pageUrl} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              View
            </Link>
          )}
          {p.moderationStatus !== 'approved' && (
            <Button
              variant="accent"
              size="sm"
              disabled={busy}
              onClick={() => review.mutate({ id: p.id, decision: 'approved' })}>
              Approve
            </Button>
          )}
          {p.moderationStatus !== 'rejected' && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                setNote(p.reviewNote ?? '')
                setRejecting((v) => !v)
              }}>
              Reject
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setFeatured.mutate({ id: p.id, featured: !p.featured })}>
            {p.featured ? 'Unfeature' : 'Feature'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Delete "${p.title}" forever? The files go too.`)) {
                remove.mutate({ id: p.id })
              }
            }}>
            Delete
          </Button>
        </div>
      </div>

      {rejecting && (
        <div className="border-ink space-y-3 border-t-2 border-dashed p-4">
          <label className="label-mono text-muted-foreground block">
            Why is this off stage? (shown to the builder — optional)
          </label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Broken, off-topic, not actually AI-built…"
            maxLength={1000}
          />
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() =>
                review.mutate({ id: p.id, decision: 'rejected', note: note.trim() || undefined })
              }>
              {review.isPending ? 'Rejecting…' : 'Confirm rejection'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

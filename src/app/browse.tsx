import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ProjectCard } from '~/components/slop/project-card'
import { SectionLabel } from '~/components/slop/stamp'
import { useTRPC } from '~/lib/trpc'
import { usePageTitle } from '~/lib/use-page-title'
import { cn } from '~/lib/utils'

export function BrowsePage() {
  usePageTitle('Browse')
  const trpc = useTRPC()
  const [sort, setSort] = useState<'new' | 'popular'>('new')
  const projects = useQuery(trpc.projects.browse.queryOptions({ sort }))

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-5 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl uppercase md:text-5xl">The whole show</h1>
        <div className="label-mono border-ink flex border-2">
          {(['new', 'popular'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              className={cn(
                'cursor-pointer px-4 py-2 uppercase',
                sort === s ? 'bg-ink text-paper' : 'hover:bg-secondary'
              )}>
              {s === 'new' ? 'Newest' : 'Most gawked'}
            </button>
          ))}
        </div>
      </div>

      <SectionLabel>{sort === 'new' ? 'Latest first' : 'By views'}</SectionLabel>

      {projects.isLoading && <p className="label-mono text-muted-foreground">Loading…</p>}
      {projects.data?.length === 0 && (
        <p className="text-muted-foreground">Nothing here yet — the show hasn't started.</p>
      )}
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        {projects.data?.map((p, i) => (
          <ProjectCard key={p.id} project={p} index={i % 12} />
        ))}
      </div>
    </div>
  )
}

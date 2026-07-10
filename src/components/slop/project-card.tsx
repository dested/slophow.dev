import { Link } from 'react-router-dom'
import type { ProjectCard as ProjectCardData } from '../../../server/router'
import { fmtCost, fmtCount, fmtHours, plural } from '~/lib/fmt'
import { cn } from '~/lib/utils'
import { Cover } from './cover'
import { Stamp } from './stamp'

export function ProjectCard({
  project,
  index = 0,
  big = false,
}: {
  project: ProjectCardData
  index?: number
  big?: boolean
}) {
  const p = project
  const href = `/${p.owner.username}/${p.slug}`
  const facts = [
    p.models[0],
    fmtCost(p.costUsd),
    fmtHours(p.buildHours),
    p.humanPercent != null ? `${p.humanPercent}% human` : null,
  ].filter(Boolean) as string[]

  return (
    <Link
      to={href}
      style={{ '--i': index } as React.CSSProperties}
      className={cn(
        'group border-ink bg-card shadow-hard reveal relative flex flex-col border-2 transition-transform duration-150 hover:-translate-y-1 hover:rotate-[-0.4deg]',
        big && 'md:col-span-2'
      )}>
      {p.featured && (
        <Stamp className="bg-acid absolute -top-3 -right-2 z-10 rotate-3">Featured</Stamp>
      )}
      {!p.published && <Stamp className="absolute -top-3 left-3 z-10">Draft</Stamp>}
      <div
        className={cn(
          'border-ink overflow-hidden border-b-2',
          big ? 'aspect-[2.2]' : 'aspect-video'
        )}>
        <Cover id={p.id} title={p.title} coverImage={p.coverImage} />
      </div>
      <div className="flex grow flex-col gap-1.5 p-4">
        <h3 className={cn('font-display uppercase', big ? 'text-2xl' : 'text-lg')}>{p.title}</h3>
        {p.tagline && <p className="text-muted-foreground text-sm">{p.tagline}</p>}
        <p className="label-mono text-muted-foreground mt-auto pt-2">
          @{p.owner.username ?? 'unknown'}
        </p>
      </div>
      {(facts.length > 0 || p.viewCount > 0) && (
        <div className="border-ink label-mono flex flex-wrap items-center gap-x-3 gap-y-1 border-t-2 border-dashed px-4 py-2">
          {facts.map((f) => (
            <span key={f}>{f}</span>
          ))}
          <span className="text-muted-foreground ml-auto">
            {fmtCount(p.viewCount)} {plural(p.viewCount, 'view')}
          </span>
        </div>
      )}
    </Link>
  )
}

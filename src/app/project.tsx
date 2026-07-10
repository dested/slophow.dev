import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Cover } from '~/components/slop/cover'
import { Receipt } from '~/components/slop/receipt'
import { Stamp } from '~/components/slop/stamp'
import { Button, buttonVariants } from '~/components/ui/button'
import { sendHit } from '~/lib/api'
import { fmtCount } from '~/lib/fmt'
import { useTRPC } from '~/lib/trpc'
import { usePageTitle } from '~/lib/use-page-title'

const IFRAME_SANDBOX = 'allow-scripts allow-pointer-lock allow-forms allow-modals'

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export function ProjectPage() {
  const { username = '', slug = '' } = useParams()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const query = useQuery(trpc.projects.get.queryOptions({ username, slug }))
  const project = query.data
  usePageTitle(project ? `${project.title} by @${username}` : null)

  const [playing, setPlaying] = useState(false)
  const [copied, setCopied] = useState(false)
  const playerRef = useRef<HTMLDivElement>(null)

  // One view per page visit; the server dedupes per visitor per day anyway.
  const viewedId = useRef<string | null>(null)
  useEffect(() => {
    if (project?.id && viewedId.current !== project.id) {
      viewedId.current = project.id
      sendHit(project.id, 'view')
    }
  }, [project?.id])

  const invalidateProject = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.projects.get.queryKey({ username, slug }),
    })

  const setFeatured = useMutation(
    trpc.admin.setFeatured.mutationOptions({ onSuccess: invalidateProject })
  )
  const review = useMutation(trpc.admin.review.mutationOptions({ onSuccess: invalidateProject }))

  if (query.isLoading) {
    return <p className="label-mono text-muted-foreground mx-auto max-w-6xl px-5 pt-10">Loading…</p>
  }
  if (!project) {
    return (
      <div className="mx-auto max-w-6xl px-5 pt-16 text-center">
        <h1 className="font-display text-5xl uppercase">No such slop</h1>
        <p className="text-muted-foreground mt-3">It never existed, or it got swept off stage.</p>
        <Link to="/browse" className={buttonVariants({ variant: 'outline', className: 'mt-6' })}>
          Back to the show
        </Link>
      </div>
    )
  }

  // Source priority: an uploaded bundle wins; otherwise an embedded URL; else
  // it's cover art only. Both playable sources use the identical sandbox.
  const hasBundle = project.bundleVersion > 0
  const embedUrl = hasBundle ? null : (project.embedUrl ?? null)
  const hasEmbed = Boolean(embedUrl)
  const playable = hasBundle || hasEmbed
  const playerSrc = hasBundle ? `/run/${project.id}/${project.bundleVersion}/` : (embedUrl ?? '')
  const embedHost = embedUrl ? hostOf(embedUrl) : null

  function copyLink() {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="mx-auto max-w-6xl px-5 pt-8">
      {project.isOwner && !project.published && (
        <div className="border-ink bg-secondary label-mono mb-6 border-2 border-dashed px-4 py-3">
          Draft — only you can see this. Publish it from the editor when it's ready.
        </div>
      )}
      {project.isOwner && project.published && project.moderationStatus === 'pending' && (
        <div className="border-ink bg-secondary label-mono mb-6 border-2 border-dashed px-4 py-3">
          In review — an admin is looking it over. It hits the feeds the moment it's approved.
        </div>
      )}
      {project.isOwner && project.moderationStatus === 'rejected' && (
        <div className="border-ink bg-destructive label-mono mb-6 border-2 px-4 py-3 text-white">
          Rejected — this stays off the public feeds.
          {project.reviewNote ? ` Reason: ${project.reviewNote}` : ''}
        </div>
      )}

      <p className="label-mono text-muted-foreground">
        <Link to={`/${username}`} className="hover:text-foreground">
          @{username}
        </Link>{' '}
        / {project.slug}
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display max-w-3xl text-4xl uppercase md:text-6xl">
            {project.title}
            {project.featured && (
              <Stamp className="bg-acid ml-4 align-middle text-xs">Featured</Stamp>
            )}
          </h1>
          {project.tagline && <p className="mt-3 max-w-2xl text-lg">{project.tagline}</p>}
        </div>
        <div className="flex shrink-0 gap-3 pt-2">
          {project.isOwner && (
            <Link
              to={`/${username}/${slug}/edit`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Edit
            </Link>
          )}
          {project.isAdmin && project.moderationStatus !== 'approved' && (
            <Button
              variant="accent"
              size="sm"
              disabled={review.isPending}
              onClick={() => review.mutate({ id: project.id, decision: 'approved' })}>
              Approve
            </Button>
          )}
          {project.isAdmin && project.moderationStatus !== 'rejected' && (
            <Button
              variant="outline"
              size="sm"
              disabled={review.isPending}
              onClick={() => {
                const note = window.prompt('Reject this slop. Reason (optional, shown to builder):')
                if (note === null) return // cancelled
                review.mutate({
                  id: project.id,
                  decision: 'rejected',
                  note: note.trim() || undefined,
                })
              }}>
              Reject
            </Button>
          )}
          {project.canFeature && (
            <Button
              variant="outline"
              size="sm"
              disabled={setFeatured.isPending}
              onClick={() => setFeatured.mutate({ id: project.id, featured: !project.featured })}>
              {project.featured ? 'Unfeature' : 'Feature'}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-8">
          {/* player */}
          <div ref={playerRef} className="border-ink shadow-hard border-2 bg-black">
            {playing && playable ? (
              <iframe
                src={playerSrc}
                title={project.title}
                sandbox={IFRAME_SANDBOX}
                allow="autoplay; gamepad"
                className="aspect-video w-full"
              />
            ) : (
              <div className="relative aspect-video w-full">
                <Cover id={project.id} title={project.title} coverImage={project.coverImage} />
                {playable && (
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(true)
                      sendHit(project.id, 'play')
                    }}
                    className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/25 transition hover:bg-black/40">
                    <span className="font-display border-ink bg-acid text-ink shadow-hard border-2 px-8 py-4 text-2xl uppercase">
                      ▶ Run it
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {playing && hasEmbed && embedHost && (
            <p className="label-mono text-muted-foreground text-xs">
              Embedded from{' '}
              <a
                href={embedUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                onClick={() => sendHit(project.id, 'click')}
                className="hover:text-foreground underline underline-offset-4">
                {embedHost}
              </a>{' '}
              — if it stays blank, the site blocks embedding.
            </p>
          )}

          <div className="label-mono flex flex-wrap items-center gap-x-5 gap-y-2">
            {playing && playable && (
              <button
                type="button"
                className="hover:text-muted-foreground cursor-pointer uppercase underline underline-offset-4"
                onClick={() => void playerRef.current?.requestFullscreen?.()}>
                ⛶ Fullscreen
              </button>
            )}
            {project.externalUrl && (
              <a
                href={project.externalUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => sendHit(project.id, 'click')}
                className="hover:text-muted-foreground uppercase underline underline-offset-4">
                Visit live site ↗
              </a>
            )}
            <button
              type="button"
              onClick={copyLink}
              className="hover:text-muted-foreground cursor-pointer uppercase underline underline-offset-4">
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <span className="text-muted-foreground ml-auto">
              {fmtCount(project.viewCount)} views · {fmtCount(project.playCount)} plays
            </span>
          </div>

          {project.description && (
            <section className="space-y-3">
              <p className="label-mono text-muted-foreground">How it happened</p>
              <div className="max-w-2xl leading-relaxed whitespace-pre-wrap">
                {project.description}
              </div>
            </section>
          )}

          {project.promptNotes && (
            <section className="space-y-3">
              <p className="label-mono text-muted-foreground">The prompts</p>
              <pre className="border-ink bg-secondary max-w-2xl overflow-x-auto border-2 border-dashed p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                {project.promptNotes}
              </pre>
            </section>
          )}
        </div>

        {/* sidebar */}
        <aside className="space-y-8">
          <Receipt
            title={project.title}
            username={project.owner.username}
            createdAt={project.createdAt}
            models={project.models}
            tools={project.tools}
            costUsd={project.costUsd}
            buildHours={project.buildHours}
            humanPercent={project.humanPercent}
          />

          <Link
            to={`/${username}`}
            className="border-ink bg-card shadow-hard-sm block border-2 p-4 transition-transform hover:-translate-y-0.5">
            <p className="label-mono text-muted-foreground">The builder</p>
            <div className="mt-2 flex items-center gap-3">
              {project.owner.image ? (
                <img
                  src={project.owner.image}
                  alt=""
                  className="border-ink size-10 border-2 object-cover"
                />
              ) : (
                <span className="border-ink bg-acid font-display flex size-10 items-center justify-center border-2 text-lg uppercase">
                  {(project.owner.name || '?')[0]}
                </span>
              )}
              <div>
                <p className="font-bold">{project.owner.name}</p>
                <p className="label-mono text-muted-foreground">@{project.owner.username}</p>
              </div>
            </div>
            {project.owner.bio && (
              <p className="text-muted-foreground mt-3 text-sm">{project.owner.bio}</p>
            )}
          </Link>
        </aside>
      </div>
    </div>
  )
}

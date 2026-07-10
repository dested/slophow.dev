import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ProjectCard } from '~/components/slop/project-card'
import { SectionLabel } from '~/components/slop/stamp'
import { buttonVariants } from '~/components/ui/button'
import { accentColor, fmtCount, fmtDate, plural } from '~/lib/fmt'
import { useTRPC } from '~/lib/trpc'
import { usePageTitle } from '~/lib/use-page-title'

export function ProfilePage() {
  const { username = '' } = useParams()
  const trpc = useTRPC()
  const query = useQuery(trpc.profile.byUsername.queryOptions({ username }))
  const data = query.data
  usePageTitle(data ? `@${username}` : null)

  if (query.isLoading) {
    return <p className="label-mono text-muted-foreground mx-auto max-w-6xl px-5 pt-10">Loading…</p>
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-6xl px-5 pt-16 text-center">
        <h1 className="font-display text-5xl uppercase">No such builder</h1>
        <p className="text-muted-foreground mt-3">@{username} isn't in the show.</p>
        <Link to="/" className={buttonVariants({ variant: 'outline', className: 'mt-6' })}>
          Back home
        </Link>
      </div>
    )
  }

  const { user, projects, totalViews, isSelf } = data
  const accent = accentColor(user.accent)
  const links = [
    user.website ? { label: 'Website ↗', href: user.website } : null,
    user.githubHandle
      ? { label: 'GitHub ↗', href: `https://github.com/${user.githubHandle}` }
      : null,
    user.twitterHandle ? { label: 'X ↗', href: `https://x.com/${user.twitterHandle}` } : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>

  return (
    <>
      {/* accent masthead — the customizable bit */}
      <section className="border-ink border-b-2" style={{ backgroundColor: accent }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-end gap-6 px-5 pt-12 pb-8">
          {user.image ? (
            <img
              src={user.image}
              alt=""
              className="border-ink shadow-hard size-24 border-2 object-cover"
            />
          ) : (
            <span className="border-ink bg-paper font-display shadow-hard flex size-24 items-center justify-center border-2 text-5xl uppercase">
              {(user.name || '?')[0]}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-4xl uppercase md:text-5xl">{user.name}</h1>
            <p className="label-mono mt-1">@{user.username}</p>
          </div>
          <div className="label-mono ml-auto space-y-1 text-right">
            <p>
              {projects.length} {plural(projects.length, 'slop')}
            </p>
            <p>
              {fmtCount(totalViews)} total {plural(totalViews, 'gawk')}
            </p>
            <p>since {fmtDate(user.createdAt)}</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-8 px-5 pt-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {user.bio && <p className="max-w-xl">{user.bio}</p>}
          <div className="label-mono flex gap-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4">
                {l.label}
              </a>
            ))}
          </div>
          {isSelf && (
            <Link
              to="/settings"
              className={buttonVariants({ variant: 'outline', size: 'sm', className: 'ml-auto' })}>
              Customize page
            </Link>
          )}
        </div>

        <SectionLabel>The collection</SectionLabel>
        {projects.length === 0 && (
          <div className="border-ink bg-card shadow-hard border-2 p-10 text-center">
            <p className="font-display text-2xl uppercase">Nothing on display.</p>
            {isSelf ? (
              <Link to="/new" className={buttonVariants({ variant: 'accent', className: 'mt-6' })}>
                Post your first slop
              </Link>
            ) : (
              <p className="text-muted-foreground mt-2">
                @{user.username} is keeping it all private. Coward.
              </p>
            )}
          </div>
        )}
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {projects.map((p, i) => (
            <ProjectCard key={p.id} project={p} index={i} />
          ))}
        </div>
      </div>
    </>
  )
}

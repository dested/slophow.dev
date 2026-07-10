import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useRevalidator } from 'react-router-dom'
import { SectionLabel } from '~/components/slop/stamp'
import { Button, buttonVariants } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { ACCENTS } from '~/lib/fmt'
import { useTRPC } from '~/lib/trpc'
import { usePageTitle } from '~/lib/use-page-title'
import { cn } from '~/lib/utils'

export function SettingsPage() {
  usePageTitle('Settings')
  const trpc = useTRPC()
  const me = useQuery(trpc.me.queryOptions())

  if (me.isLoading) {
    return <p className="label-mono text-muted-foreground mx-auto max-w-2xl px-5 pt-10">Loading…</p>
  }
  if (!me.data) return null
  return <SettingsForm key={me.data.id} me={me.data} />
}

function SettingsForm({
  me,
}: {
  me: {
    username: string | null
    name: string
    bio: string | null
    website: string | null
    githubHandle: string | null
    twitterHandle: string | null
    accent: string | null
  }
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const revalidator = useRevalidator()
  const [form, setForm] = useState({
    username: me.username ?? '',
    name: me.name,
    bio: me.bio ?? '',
    website: me.website ?? '',
    githubHandle: me.githubHandle ?? '',
    twitterHandle: me.twitterHandle ?? '',
    accent: me.accent ?? 'acid',
  })
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const update = useMutation(
    trpc.profile.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries()
        revalidator.revalidate() // nav @username may have changed
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      },
      onError: (e) => setError(e.message),
    })
  )

  return (
    <div className="mx-auto max-w-2xl space-y-10 px-5 pt-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl uppercase md:text-5xl">Your page</h1>
        {form.username && (
          <Link
            to={`/${me.username}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            View it
          </Link>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          update.mutate({
            username: form.username.toLowerCase(),
            name: form.name,
            bio: form.bio,
            website: form.website,
            githubHandle: form.githubHandle.replace(/^@/, ''),
            twitterHandle: form.twitterHandle.replace(/^@/, ''),
            accent: form.accent,
          })
        }}
        className="space-y-10">
        <section className="space-y-5">
          <SectionLabel>Identity</SectionLabel>
          <div className="space-y-2">
            <Label htmlFor="username" className="label-mono">
              Username
            </Label>
            <Input
              id="username"
              value={form.username}
              onChange={(e) => set('username', e.target.value)}
              required
              minLength={3}
              maxLength={32}
              pattern="[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]"
            />
            <p className="text-muted-foreground font-mono text-xs">
              slopshow.dev/<span className="text-foreground font-bold">{form.username || '…'}</span>
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name" className="label-mono">
              Display name
            </Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              maxLength={80}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio" className="label-mono">
              Bio
            </Label>
            <Textarea
              id="bio"
              value={form.bio}
              onChange={(e) => set('bio', e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="I make the machines make things."
            />
          </div>
        </section>

        <section className="space-y-5">
          <SectionLabel>Links</SectionLabel>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="website" className="label-mono">
                Website
              </Label>
              <Input
                id="website"
                type="url"
                value={form.website}
                onChange={(e) => set('website', e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="githubHandle" className="label-mono">
                GitHub
              </Label>
              <Input
                id="githubHandle"
                value={form.githubHandle}
                onChange={(e) => set('githubHandle', e.target.value)}
                placeholder="octocat"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twitterHandle" className="label-mono">
                X / Twitter
              </Label>
              <Input
                id="twitterHandle"
                value={form.twitterHandle}
                onChange={(e) => set('twitterHandle', e.target.value)}
                placeholder="handle"
              />
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <SectionLabel>Masthead color</SectionLabel>
          <p className="text-muted-foreground text-sm">The banner across the top of your page.</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(ACCENTS).map(([key, a]) => (
              <button
                key={key}
                type="button"
                aria-label={a.label}
                aria-pressed={form.accent === key}
                onClick={() => set('accent', key)}
                className={cn(
                  'border-ink size-12 cursor-pointer border-2 transition-transform hover:-translate-y-0.5',
                  form.accent === key && 'shadow-hard-sm ring-ring ring-2 ring-offset-2'
                )}
                style={{ backgroundColor: a.color }}
              />
            ))}
          </div>
        </section>

        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button type="submit" variant="accent" size="lg" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
        </Button>
      </form>
    </div>
  )
}

import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useRouteLoaderData } from 'react-router-dom'
import { ChipsInput } from '~/components/slop/chips-input'
import { SectionLabel } from '~/components/slop/stamp'
import { Button, buttonVariants } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { uploadBundle, uploadImage } from '~/lib/api'
import { fmtBytes } from '~/lib/fmt'
import { useTRPC } from '~/lib/trpc'
import { usePageTitle } from '~/lib/use-page-title'
import type { RootLoaderData } from './routes'

const MODEL_SUGGESTIONS = [
  'Claude Opus 4.6',
  'Claude Sonnet 4.6',
  'Claude Haiku 4.5',
  'GPT-5.2',
  'GPT-5 mini',
  'Gemini 3 Pro',
  'Gemini 3 Flash',
  'DeepSeek V4',
  'Grok 4',
  'Qwen 3',
]
const TOOL_SUGGESTIONS = [
  'Claude Code',
  'Cursor',
  'Windsurf',
  'GitHub Copilot',
  'Codex',
  'v0',
  'Lovable',
  'Bolt',
  'Replit',
  'Aider',
  'Raw API',
]

type FormState = {
  title: string
  tagline: string
  externalUrl: string
  description: string
  models: string[]
  tools: string[]
  costUsd: string
  buildHours: string
  humanPercent: number | null
  promptNotes: string
}

const EMPTY: FormState = {
  title: '',
  tagline: '',
  externalUrl: '',
  description: '',
  models: [],
  tools: [],
  costUsd: '',
  buildHours: '',
  humanPercent: null,
  promptNotes: '',
}

export function EditorPage() {
  const { username, slug } = useParams()
  const isEdit = Boolean(username && slug)
  const trpc = useTRPC()
  const existing = useQuery({
    ...trpc.projects.get.queryOptions({ username: username ?? '', slug: slug ?? '' }),
    enabled: isEdit,
  })
  usePageTitle(isEdit ? 'Edit slop' : 'Post slop')

  if (isEdit && existing.isLoading) {
    return <p className="label-mono text-muted-foreground mx-auto max-w-3xl px-5 pt-10">Loading…</p>
  }
  if (isEdit && (!existing.data || !existing.data.isOwner)) {
    return (
      <p className="text-muted-foreground mx-auto max-w-3xl px-5 pt-10">
        This isn't yours to edit.
      </p>
    )
  }

  // Key by project id so the form state re-initializes if you jump between projects.
  return <EditorForm key={existing.data?.id ?? 'new'} project={existing.data ?? null} />
}

function EditorForm({
  project,
}: {
  project: {
    id: string
    slug: string
    title: string
    tagline: string | null
    externalUrl: string | null
    description: string | null
    models: string[]
    tools: string[]
    costUsd: number | null
    buildHours: number | null
    humanPercent: number | null
    promptNotes: string | null
    coverImage: string | null
    bundleVersion: number
    bundleSize: number | null
    published: boolean
    owner: { username: string | null }
  } | null
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const rootData = useRouteLoaderData('root') as RootLoaderData | undefined
  const myUsername =
    (rootData?.session?.user as { username?: string | null } | undefined)?.username ?? null

  const [form, setForm] = useState<FormState>(
    project
      ? {
          title: project.title,
          tagline: project.tagline ?? '',
          externalUrl: project.externalUrl ?? '',
          description: project.description ?? '',
          models: project.models,
          tools: project.tools,
          costUsd: project.costUsd?.toString() ?? '',
          buildHours: project.buildHours?.toString() ?? '',
          humanPercent: project.humanPercent,
          promptNotes: project.promptNotes ?? '',
        }
      : EMPTY
  )
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const ownerUsername = project?.owner.username ?? myUsername
  const pageUrl = project ? `/${ownerUsername}/${project.slug}` : null

  function payload() {
    return {
      title: form.title,
      tagline: form.tagline,
      description: form.description,
      externalUrl: form.externalUrl,
      models: form.models,
      tools: form.tools,
      costUsd: form.costUsd === '' ? null : Number(form.costUsd),
      buildHours: form.buildHours === '' ? null : Number(form.buildHours),
      humanPercent: form.humanPercent,
      promptNotes: form.promptNotes,
    }
  }

  const invalidate = () => queryClient.invalidateQueries()

  const create = useMutation(
    trpc.projects.create.mutationOptions({
      onSuccess: ({ slug }) => {
        void invalidate()
        navigate(`/${myUsername}/${slug}/edit`, { replace: true })
        setNotice('Saved as a draft. Now upload the thing itself, then publish.')
      },
      onError: (e) => setError(e.message),
    })
  )
  const update = useMutation(
    trpc.projects.update.mutationOptions({
      onSuccess: () => {
        void invalidate()
        setNotice('Saved.')
      },
      onError: (e) => setError(e.message),
    })
  )
  const destroy = useMutation(
    trpc.projects.delete.mutationOptions({
      onSuccess: () => {
        void invalidate()
        navigate('/dashboard')
      },
      onError: (e) => setError(e.message),
    })
  )

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (project) update.mutate({ id: project.id, ...payload() })
    else create.mutate(payload())
  }

  const busy = create.isPending || update.isPending

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-5 pt-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl uppercase md:text-5xl">
          {project ? 'Edit slop' : 'Post slop'}
        </h1>
        {project && pageUrl && (
          <div className="flex items-center gap-3">
            <Link to={pageUrl} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              View page
            </Link>
            <Button
              size="sm"
              variant={project.published ? 'outline' : 'accent'}
              disabled={update.isPending}
              onClick={() => update.mutate({ id: project.id, published: !project.published })}>
              {project.published ? 'Unpublish' : 'Publish it'}
            </Button>
          </div>
        )}
      </div>

      {project && !project.published && (
        <div className="border-ink bg-secondary label-mono border-2 border-dashed px-4 py-3">
          Draft — hit &ldquo;Publish it&rdquo; when you're ready for an audience.
        </div>
      )}
      {notice && <div className="border-ink bg-acid label-mono border-2 px-4 py-3">{notice}</div>}

      {project && <UploadPanel project={project} onDone={invalidate} />}

      <form onSubmit={onSubmit} className="space-y-10">
        <section className="space-y-5">
          <SectionLabel>The basics</SectionLabel>
          <Field label="Title" htmlFor="title">
            <Input
              id="title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              required
              maxLength={100}
              placeholder="Sad Vacuum Simulator"
            />
          </Field>
          <Field label="Tagline" htmlFor="tagline" hint="One line for the card.">
            <Input
              id="tagline"
              value={form.tagline}
              onChange={(e) => set('tagline', e.target.value)}
              maxLength={140}
              placeholder="A roguelike about dust, regret, and suction"
            />
          </Field>
          <Field
            label="Also live at"
            htmlFor="externalUrl"
            hint="Optional — if it's also deployed somewhere else.">
            <Input
              id="externalUrl"
              type="url"
              value={form.externalUrl}
              onChange={(e) => set('externalUrl', e.target.value)}
              placeholder="https://sad-vacuum.example.com"
            />
          </Field>
          <Field label="How it happened" htmlFor="description">
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={6}
              placeholder="The story. What you asked for, what you got, what fought back."
            />
          </Field>
        </section>

        <section className="space-y-5">
          <SectionLabel>The receipts</SectionLabel>
          <Field label="Models used" htmlFor="models">
            <ChipsInput
              inputId="models"
              value={form.models}
              onChange={(v) => set('models', v)}
              suggestions={MODEL_SUGGESTIONS}
              placeholder="Type a model, press Enter"
            />
          </Field>
          <Field label="Tools" htmlFor="tools">
            <ChipsInput
              inputId="tools"
              value={form.tools}
              onChange={(v) => set('tools', v)}
              suggestions={TOOL_SUGGESTIONS}
              placeholder="Type a tool, press Enter"
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Estimated spend (USD)" htmlFor="costUsd">
              <Input
                id="costUsd"
                type="number"
                min={0}
                step="0.01"
                value={form.costUsd}
                onChange={(e) => set('costUsd', e.target.value)}
                placeholder="43.07"
              />
            </Field>
            <Field label="Build time (hours)" htmlFor="buildHours">
              <Input
                id="buildHours"
                type="number"
                min={0}
                step="0.5"
                value={form.buildHours}
                onChange={(e) => set('buildHours', e.target.value)}
                placeholder="14"
              />
            </Field>
          </div>
          <Field
            label="How much did YOU write?"
            htmlFor="humanPercent"
            hint="Percent of the code typed by an actual human. Be honest, nobody's checking.">
            {form.humanPercent == null ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => set('humanPercent', 5)}>
                Report it
              </Button>
            ) : (
              <div className="flex items-center gap-4">
                <input
                  id="humanPercent"
                  type="range"
                  min={0}
                  max={100}
                  value={form.humanPercent}
                  onChange={(e) => set('humanPercent', Number(e.target.value))}
                  className="accent-ink grow"
                />
                <span className="label-mono w-32 shrink-0">
                  {form.humanPercent}% human / {100 - form.humanPercent}% robot
                </span>
                <button
                  type="button"
                  aria-label="Clear"
                  className="label-mono text-muted-foreground hover:text-destructive cursor-pointer"
                  onClick={() => set('humanPercent', null)}>
                  ×
                </button>
              </div>
            )}
          </Field>
        </section>

        <section className="space-y-5">
          <SectionLabel>The prompts</SectionLabel>
          <Field
            label="Notable prompts"
            htmlFor="promptNotes"
            hint="The magic words. Paste the prompts that did the heavy lifting.">
            <Textarea
              id="promptNotes"
              value={form.promptNotes}
              onChange={(e) => set('promptNotes', e.target.value)}
              rows={6}
              className="font-mono text-sm"
              placeholder={'"make the vacuum sadder"\n"no, sadder than that"'}
            />
          </Field>
        </section>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" variant="accent" size="lg" disabled={busy}>
            {busy ? 'Saving…' : project ? 'Save changes' : 'Create draft'}
          </Button>
          {project && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive ml-auto"
              disabled={destroy.isPending}
              onClick={() => {
                if (window.confirm('Delete this slop forever? The files go too.')) {
                  destroy.mutate({ id: project.id })
                }
              }}>
              {destroy.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="label-mono">
        {label}
      </Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  )
}

// Bundle zip + cover image uploads. Only rendered in edit mode (needs an id).
function UploadPanel({
  project,
  onDone,
}: {
  project: {
    id: string
    bundleVersion: number
    bundleSize: number | null
    coverImage: string | null
  }
  onDone: () => void
}) {
  const trpc = useTRPC()
  const [dragging, setDragging] = useState(false)
  const [bundleBusy, setBundleBusy] = useState(false)
  const [coverBusy, setCoverBusy] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const zipInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  const attachCover = useMutation(trpc.projects.update.mutationOptions({ onSuccess: onDone }))

  async function sendZip(file: File) {
    setUploadError(null)
    setBundleBusy(true)
    try {
      await uploadBundle(project.id, file)
      onDone()
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setBundleBusy(false)
    }
  }

  async function sendCover(file: File) {
    setUploadError(null)
    setCoverBusy(true)
    try {
      const { name } = await uploadImage(file)
      attachCover.mutate({ id: project.id, coverImage: name })
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setCoverBusy(false)
    }
  }

  return (
    <section className="space-y-4">
      <SectionLabel>The thing itself</SectionLabel>
      <div
        role="button"
        tabIndex={0}
        onClick={() => zipInput.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && zipInput.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files?.[0]
          if (file) void sendZip(file)
        }}
        className={`border-ink cursor-pointer border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? 'bg-acid' : 'bg-card hover:bg-secondary'
        }`}>
        {bundleBusy ? (
          <p className="label-mono">Uploading + extracting…</p>
        ) : project.bundleVersion > 0 ? (
          <>
            <p className="label-mono">
              ✓ Bundle v{project.bundleVersion} live
              {project.bundleSize ? ` · ${fmtBytes(project.bundleSize)}` : ''}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Drop a new zip to replace it (old version gets swept).
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-xl uppercase">Drop the zip here</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Zip up your build — index.html at the root — and it runs right on your page. Max
              100MB.
            </p>
          </>
        )}
        <input
          ref={zipInput}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void sendZip(file)
            e.target.value = ''
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {project.coverImage && (
          <img
            src={`/files/images/${project.coverImage}`}
            alt="Cover"
            className="border-ink h-16 border-2 object-cover"
          />
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={coverBusy || attachCover.isPending}
          onClick={() => coverInput.current?.click()}>
          {coverBusy || attachCover.isPending
            ? 'Uploading…'
            : project.coverImage
              ? 'Replace cover image'
              : 'Add cover image'}
        </Button>
        {project.coverImage && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => attachCover.mutate({ id: project.id, coverImage: null })}>
            Remove
          </Button>
        )}
        <span className="text-muted-foreground text-xs">
          png / jpg / webp / gif, up to 8MB. Skip it and you get free pattern art.
        </span>
        <input
          ref={coverInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void sendCover(file)
            e.target.value = ''
          }}
        />
      </div>
      {uploadError && <p className="text-destructive text-sm">{uploadError}</p>}
    </section>
  )
}

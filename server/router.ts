import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { router, publicProcedure, protectedProcedure, adminProcedure } from './trpc'
import { prisma } from './prisma'
import { githubEnabled } from './env'
import { deleteBundle, deleteImage } from './bundles'
import { dailySeries } from './stats'
import { isValidUsername, slugify } from './usernames'

// ————— shared shapes —————

// zod's `.url()` accepts `javascript:alert(1)` (it's a syntactically valid
// URL) — which would later render as an href and execute. Require an http(s)
// scheme so a stored URL is always safe to link to or frame.
const httpish = (max: number) =>
  z
    .string()
    .trim()
    .url()
    .max(max)
    .refine((v) => /^https?:\/\//i.test(v), 'Links must start with http:// or https://.')
const httpsOnly = (max: number) =>
  z
    .string()
    .trim()
    .url()
    .max(max)
    .refine((v) => /^https:\/\//i.test(v), 'Must be an https:// URL.')

const ownerSelect = { username: true, name: true, image: true, accent: true } as const

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  tagline: true,
  coverImage: true,
  models: true,
  tools: true,
  costUsd: true,
  buildHours: true,
  humanPercent: true,
  bundleVersion: true,
  externalUrl: true,
  embedUrl: true,
  viewCount: true,
  playCount: true,
  featured: true,
  published: true,
  moderationStatus: true,
  createdAt: true,
  owner: { select: ownerSelect },
} as const

// A project is on the public feeds only when the owner has published it AND an
// admin has approved it. Everywhere a signed-out visitor sees projects, spread
// this into the Prisma `where`.
const PUBLIC_WHERE = { published: true, moderationStatus: 'approved' } as const

type CardRow = {
  id: string
  slug: string
  title: string
  tagline: string | null
  coverImage: string | null
  models: string[]
  tools: string[]
  costUsd: number | null
  buildHours: number | null
  humanPercent: number | null
  bundleVersion: number
  externalUrl: string | null
  embedUrl: string | null
  viewCount: number
  playCount: number
  featured: boolean
  published: boolean
  moderationStatus: string
  createdAt: Date
  owner: { username: string | null; name: string; image: string | null; accent: string | null }
}

// ISO strings on the wire so SSR markup and post-hydration renders match.
function toCard(p: CardRow) {
  return { ...p, createdAt: p.createdAt.toISOString() }
}
export type ProjectCard = ReturnType<typeof toCard>

const metadataInput = {
  title: z.string().trim().min(1).max(100),
  tagline: z.string().trim().max(140).optional(),
  description: z.string().trim().max(20_000).optional(),
  externalUrl: z.union([z.literal(''), httpish(500)]).optional(),
  embedUrl: z.union([z.literal(''), httpsOnly(500)]).optional(),
  models: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  tools: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  costUsd: z.number().min(0).max(1_000_000).nullable().optional(),
  buildHours: z.number().min(0).max(10_000).nullable().optional(),
  humanPercent: z.number().int().min(0).max(100).nullable().optional(),
  promptNotes: z.string().trim().max(10_000).optional(),
}

async function uniqueProjectSlug(ownerId: string, title: string): Promise<string> {
  const base = slugify(title) || 'project'
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`
    const taken = await prisma.project.findUnique({
      where: { ownerId_slug: { ownerId, slug: candidate } },
    })
    if (!taken) return candidate
  }
  throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not find a free slug.' })
}

async function ownedProject(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) throw new TRPCError({ code: 'NOT_FOUND' })
  if (project.ownerId !== userId) throw new TRPCError({ code: 'FORBIDDEN' })
  return project
}

// ————— router —————

export const appRouter = router({
  config: publicProcedure.query(() => ({ githubEnabled })),

  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        username: true,
        bio: true,
        website: true,
        githubHandle: true,
        twitterHandle: true,
        accent: true,
        isAdmin: true,
      },
    })
    return user
  }),

  profile: router({
    update: protectedProcedure
      .input(
        z.object({
          username: z.string().trim().toLowerCase().min(3).max(32).optional(),
          name: z.string().trim().min(1).max(80).optional(),
          bio: z.string().trim().max(500).optional(),
          website: z.union([z.literal(''), httpish(300)]).optional(),
          githubHandle: z.string().trim().max(60).optional(),
          twitterHandle: z.string().trim().max(60).optional(),
          accent: z.string().trim().max(20).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { username, ...rest } = input
        if (username !== undefined) {
          if (!isValidUsername(username)) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Usernames are 3–32 chars: lowercase letters, numbers, dashes.',
            })
          }
          const taken = await prisma.user.findUnique({ where: { username } })
          if (taken && taken.id !== ctx.session.user.id) {
            throw new TRPCError({ code: 'CONFLICT', message: 'That username is taken.' })
          }
        }
        await prisma.user.update({
          where: { id: ctx.session.user.id },
          data: {
            ...rest,
            ...(username !== undefined ? { username } : {}),
            website: rest.website === '' ? null : rest.website,
          },
        })
        return { ok: true }
      }),

    byUsername: publicProcedure
      .input(z.object({ username: z.string().trim().toLowerCase() }))
      .query(async ({ input, ctx }) => {
        const user = await prisma.user.findUnique({
          where: { username: input.username },
          select: {
            id: true,
            name: true,
            image: true,
            username: true,
            bio: true,
            website: true,
            githubHandle: true,
            twitterHandle: true,
            accent: true,
            createdAt: true,
          },
        })
        if (!user) throw new TRPCError({ code: 'NOT_FOUND' })
        const isSelf = ctx.session?.user.id === user.id
        const projects = await prisma.project.findMany({
          where: { ownerId: user.id, ...(isSelf ? {} : PUBLIC_WHERE) },
          orderBy: { createdAt: 'desc' },
          select: cardSelect,
        })
        const totalViews = projects.reduce((n, p) => n + p.viewCount, 0)
        return {
          user: { ...user, createdAt: user.createdAt.toISOString() },
          isSelf,
          totalViews,
          projects: projects.map(toCard),
        }
      }),
  }),

  projects: router({
    home: publicProcedure.query(async () => {
      const [featured, recent, hot, counts] = await Promise.all([
        prisma.project.findMany({
          where: { ...PUBLIC_WHERE, featured: true },
          orderBy: { featuredAt: 'desc' },
          take: 6,
          select: cardSelect,
        }),
        prisma.project.findMany({
          where: PUBLIC_WHERE,
          orderBy: { createdAt: 'desc' },
          take: 12,
          select: cardSelect,
        }),
        prisma.project.findMany({
          where: PUBLIC_WHERE,
          orderBy: { viewCount: 'desc' },
          take: 6,
          select: cardSelect,
        }),
        Promise.all([
          prisma.project.count({ where: PUBLIC_WHERE }),
          prisma.user.count(),
          prisma.statEvent.count(),
        ]),
      ])
      return {
        featured: featured.map(toCard),
        recent: recent.map(toCard),
        hot: hot.filter((p) => p.viewCount > 0).map(toCard),
        siteStats: { projects: counts[0], builders: counts[1], events: counts[2] },
      }
    }),

    browse: publicProcedure
      .input(z.object({ sort: z.enum(['new', 'popular']).default('new') }))
      .query(async ({ input }) => {
        const rows = await prisma.project.findMany({
          where: PUBLIC_WHERE,
          orderBy: input.sort === 'new' ? { createdAt: 'desc' } : { viewCount: 'desc' },
          take: 60,
          select: cardSelect,
        })
        return rows.map(toCard)
      }),

    get: publicProcedure
      .input(z.object({ username: z.string().trim().toLowerCase(), slug: z.string().trim() }))
      .query(async ({ input, ctx }) => {
        const owner = await prisma.user.findUnique({ where: { username: input.username } })
        if (!owner) throw new TRPCError({ code: 'NOT_FOUND' })
        const project = await prisma.project.findUnique({
          where: { ownerId_slug: { ownerId: owner.id, slug: input.slug } },
        })
        const isOwner = ctx.session?.user.id === owner.id
        const isAdmin = Boolean(ctx.session?.user.isAdmin)
        const isLive = Boolean(project?.published) && project?.moderationStatus === 'approved'
        // Owners and admins can preview anything; the public only sees live slop.
        if (!project || (!isLive && !isOwner && !isAdmin)) {
          throw new TRPCError({ code: 'NOT_FOUND' })
        }
        return {
          ...project,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
          featuredAt: project.featuredAt?.toISOString() ?? null,
          reviewedAt: project.reviewedAt?.toISOString() ?? null,
          isOwner,
          isAdmin,
          canFeature: isAdmin,
          owner: {
            username: owner.username,
            name: owner.name,
            image: owner.image,
            accent: owner.accent,
            bio: owner.bio,
          },
        }
      }),

    mine: protectedProcedure.query(async ({ ctx }) => {
      const rows = await prisma.project.findMany({
        where: { ownerId: ctx.session.user.id },
        orderBy: { createdAt: 'desc' },
        select: { ...cardSelect, clickCount: true, reviewNote: true },
      })
      return rows.map((r) => ({ ...toCard(r), clickCount: r.clickCount, reviewNote: r.reviewNote }))
    }),

    create: protectedProcedure.input(z.object(metadataInput)).mutation(async ({ ctx, input }) => {
      const count = await prisma.project.count({ where: { ownerId: ctx.session.user.id } })
      if (count >= 100) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: "You've hit the 100-project limit. Delete some slop to post more.",
        })
      }
      const slug = await uniqueProjectSlug(ctx.session.user.id, input.title)
      const project = await prisma.project.create({
        data: {
          ownerId: ctx.session.user.id,
          slug,
          ...input,
          externalUrl: input.externalUrl || null,
          embedUrl: input.embedUrl || null,
          published: false, // goes live when the user hits publish
        },
      })
      return { id: project.id, slug: project.slug }
    }),

    update: protectedProcedure
      .input(
        z.object({
          ...metadataInput,
          id: z.string(),
          title: metadataInput.title.optional(),
          published: z.boolean().optional(),
          coverImage: z.string().max(100).nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input
        const existing = await ownedProject(id, ctx.session.user.id)
        // Replacing / clearing the cover image orphans the old file — remove it.
        if (
          data.coverImage !== undefined &&
          existing.coverImage &&
          data.coverImage !== existing.coverImage
        ) {
          deleteImage(existing.coverImage)
        }
        await prisma.project.update({
          where: { id },
          data: {
            ...data,
            externalUrl: data.externalUrl === '' ? null : data.externalUrl,
            embedUrl: data.embedUrl === '' ? null : data.embedUrl,
          },
        })
        return { ok: true }
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const project = await ownedProject(input.id, ctx.session.user.id)
        await prisma.project.delete({ where: { id: project.id } })
        deleteBundle(project.id)
        if (project.coverImage) deleteImage(project.coverImage)
        return { ok: true }
      }),

    stats: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
      const project = await ownedProject(input.id, ctx.session.user.id)
      const [series, referrers] = await Promise.all([
        dailySeries(project.id, 14),
        prisma.$queryRaw<Array<{ referrer: string; count: bigint }>>`
            SELECT referrer, count(*) AS count FROM stat_event
            WHERE project_id = ${project.id} AND referrer IS NOT NULL
            GROUP BY referrer ORDER BY count DESC LIMIT 5
          `,
      ])
      return {
        totals: {
          views: project.viewCount,
          plays: project.playCount,
          clicks: project.clickCount,
        },
        series,
        referrers: referrers.map((r) => ({ referrer: r.referrer, count: Number(r.count) })),
      }
    }),
  }),

  admin: router({
    // The moderation queue. `filter` picks the shelf; `q` searches title / owner.
    list: adminProcedure
      .input(
        z.object({
          filter: z.enum(['pending', 'approved', 'rejected', 'drafts', 'all']).default('pending'),
          q: z.string().trim().max(100).optional(),
        })
      )
      .query(async ({ input }) => {
        const shelves = {
          pending: { moderationStatus: 'pending' },
          approved: { moderationStatus: 'approved' },
          rejected: { moderationStatus: 'rejected' },
          drafts: { published: false },
          all: {},
        } as const
        const search = input.q
          ? {
              OR: [
                { title: { contains: input.q, mode: 'insensitive' as const } },
                { owner: { username: { contains: input.q, mode: 'insensitive' as const } } },
                { owner: { name: { contains: input.q, mode: 'insensitive' as const } } },
              ],
            }
          : {}

        const [rows, pending, approved, rejected, drafts, total] = await Promise.all([
          prisma.project.findMany({
            where: { ...shelves[input.filter], ...search },
            orderBy: { createdAt: 'desc' },
            take: 200,
            select: {
              id: true,
              slug: true,
              title: true,
              tagline: true,
              coverImage: true,
              published: true,
              featured: true,
              moderationStatus: true,
              reviewNote: true,
              reviewedAt: true,
              bundleVersion: true,
              bundleSize: true,
              viewCount: true,
              playCount: true,
              clickCount: true,
              createdAt: true,
              updatedAt: true,
              owner: { select: { username: true, name: true, image: true, email: true } },
            },
          }),
          prisma.project.count({ where: { moderationStatus: 'pending' } }),
          prisma.project.count({ where: { moderationStatus: 'approved' } }),
          prisma.project.count({ where: { moderationStatus: 'rejected' } }),
          prisma.project.count({ where: { published: false } }),
          prisma.project.count(),
        ])

        return {
          counts: { pending, approved, rejected, drafts, all: total },
          projects: rows.map((p) => ({
            ...p,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
            reviewedAt: p.reviewedAt?.toISOString() ?? null,
          })),
        }
      }),

    // Approve or reject. Approving a published project makes it live instantly;
    // rejecting pulls it from every public feed and shows the owner the note.
    review: adminProcedure
      .input(
        z.object({
          id: z.string(),
          decision: z.enum(['approved', 'rejected']),
          note: z.string().trim().max(1000).optional(),
        })
      )
      .mutation(async ({ input }) => {
        await prisma.project.update({
          where: { id: input.id },
          data: {
            moderationStatus: input.decision,
            reviewNote: input.note && input.note.length > 0 ? input.note : null,
            reviewedAt: new Date(),
          },
        })
        return { ok: true }
      }),

    setFeatured: adminProcedure
      .input(z.object({ id: z.string(), featured: z.boolean() }))
      .mutation(async ({ input }) => {
        await prisma.project.update({
          where: { id: input.id },
          data: { featured: input.featured, featuredAt: input.featured ? new Date() : null },
        })
        return { ok: true }
      }),

    // Hard delete — any project, plus its hosted files. Owner-facing deletion
    // lives in projects.delete; this one skips the ownership check.
    remove: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
      const project = await prisma.project.findUnique({ where: { id: input.id } })
      if (!project) throw new TRPCError({ code: 'NOT_FOUND' })
      await prisma.project.delete({ where: { id: project.id } })
      deleteBundle(project.id)
      if (project.coverImage) deleteImage(project.coverImage)
      return { ok: true }
    }),
  }),
})

export type AppRouter = typeof appRouter

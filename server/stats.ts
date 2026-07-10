import { createHash } from 'node:crypto'
import type { Request } from 'express'
import { env } from './env'
import { prisma } from './prisma'

export const STAT_KINDS = ['view', 'play', 'click'] as const
export type StatKind = (typeof STAT_KINDS)[number]

const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|curl\/|wget\//i

// Anonymous, rotating visitor id: same person = same hash for one day, then it
// rotates. Never stores a raw IP.
export function visitorHashFor(req: Request): string {
  const ip = req.ip ?? ''
  const ua = req.headers['user-agent'] ?? ''
  const day = new Date().toISOString().slice(0, 10)
  return createHash('sha256')
    .update(`${ip}|${ua}|${day}|${env.BETTER_AUTH_SECRET}`)
    .digest('hex')
    .slice(0, 24)
}

export function looksLikeBot(req: Request): boolean {
  const ua = req.headers['user-agent']
  return !ua || BOT_RE.test(ua)
}

// Record an interaction, deduped per visitor per kind per project per day
// (the visitor hash already rotates daily, so a plain existence check is the
// daily dedupe). Bumps the project's denormalized counter on first sight.
export async function recordEvent(projectId: string, kind: StatKind, req: Request): Promise<void> {
  if (looksLikeBot(req)) return
  const visitorHash = visitorHashFor(req)

  const seen = await prisma.statEvent.findFirst({
    where: { projectId, kind, visitorHash },
    select: { id: true },
  })
  if (seen) return

  const referrerRaw = req.headers.referer
  // Ignore self-referrals so "traffic sources" means external sources.
  const referrer =
    referrerRaw && !referrerRaw.startsWith(env.BETTER_AUTH_URL) ? referrerRaw.slice(0, 300) : null

  const counter = { view: 'viewCount', play: 'playCount', click: 'clickCount' }[kind] as
    | 'viewCount'
    | 'playCount'
    | 'clickCount'

  await prisma.$transaction([
    prisma.statEvent.create({ data: { projectId, kind, visitorHash, referrer } }),
    prisma.project.update({
      where: { id: projectId },
      data: { [counter]: { increment: 1 } },
    }),
  ])
}

// Per-day event counts for the owner dashboard sparklines.
export async function dailySeries(projectId: string, days: number) {
  const since = new Date(Date.now() - days * 86_400_000)
  since.setUTCHours(0, 0, 0, 0)
  const rows = await prisma.$queryRaw<Array<{ day: Date; kind: string; count: bigint }>>`
    SELECT date_trunc('day', created_at) AS day, kind, count(*) AS count
    FROM stat_event
    WHERE project_id = ${projectId} AND created_at >= ${since}
    GROUP BY 1, 2
    ORDER BY 1
  `
  return rows.map((r) => ({
    day: r.day.toISOString().slice(0, 10),
    kind: r.kind,
    count: Number(r.count),
  }))
}

import { randomBytes } from 'node:crypto'
import { prisma } from './prisma'

// Every top-level path that isn't a profile page. `/:username` is a catch-all
// route, so anything routable (or likely to become routable) must be reserved.
export const RESERVED_USERNAMES = new Set([
  'about',
  'admin',
  'api',
  'assets',
  'browse',
  'dashboard',
  'favicon',
  'featured',
  'files',
  'healthz',
  'help',
  'new',
  'p',
  'privacy',
  'projects',
  'robots',
  'run',
  'settings',
  'sign-in',
  'sign-out',
  'sign-up',
  'signin',
  'signout',
  'signup',
  'slopshow',
  'static',
  'terms',
  'u',
  'upload',
])

export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

export function isValidUsername(name: string): boolean {
  return USERNAME_RE.test(name) && !RESERVED_USERNAMES.has(name)
}

// Claim a username derived from the display name / email local part; suffix
// with random chars until free. Used by the better-auth user-create hook.
export async function generateUsername(seed: string): Promise<string> {
  const base = slugify(seed.split('@')[0] ?? '') || 'builder'
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate =
      attempt === 0 && isValidUsername(base)
        ? base
        : `${base.slice(0, 26)}-${randomBytes(2).toString('hex')}`
    if (!isValidUsername(candidate)) continue
    const taken = await prisma.user.findUnique({ where: { username: candidate } })
    if (!taken) return candidate
  }
  return `builder-${randomBytes(4).toString('hex')}`
}

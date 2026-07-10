import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 chars'),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
  // GitHub OAuth — optional; the "Continue with GitHub" button only renders
  // when both are set.
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  // Comma-separated emails that get isAdmin (featuring powers) on signup.
  ADMIN_EMAILS: z.string().default(''),
  // Where uploaded bundles + images live (gitignored). Mount a volume here in prod.
  DATA_DIR: z.string().default('./data'),
})

export const env = schema.parse(process.env)

export const adminEmails = env.ADMIN_EMAILS.split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export const githubEnabled = Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET)

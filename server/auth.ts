import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from './prisma'
import { adminEmails, env, githubEnabled } from './env'
import { log } from './logger'
import { generateUsername } from './usernames'

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: githubEnabled
    ? {
        github: {
          clientId: env.GITHUB_CLIENT_ID!,
          clientSecret: env.GITHUB_CLIENT_SECRET!,
        },
      }
    : undefined,
  user: {
    // Surfaced on session.user; input:false keeps sign-up payloads from
    // setting them — username is claimed by the hook below, edited in /settings.
    additionalFields: {
      username: { type: 'string', required: false, input: false },
      isAdmin: { type: 'boolean', required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                username: await generateUsername(user.name || user.email),
                isAdmin: adminEmails.includes(user.email.toLowerCase()),
              },
            })
          } catch (e) {
            // Non-fatal: the user can still claim a username in /settings.
            log.error(`failed to claim username for ${user.id}: ${e}`)
          }
        },
      },
    },
  },
})

export type Session = typeof auth.$Infer.Session

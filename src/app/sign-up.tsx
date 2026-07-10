import { useState } from 'react'
import { Link, useNavigate, useRevalidator } from 'react-router-dom'
import { GitHubButton } from '~/components/slop/github-button'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { authClient } from '~/lib/auth-client'
import { usePageTitle } from '~/lib/use-page-title'

export function SignUpPage() {
  usePageTitle('Join the show')
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: err } = await authClient.signUp.email({ name, email, password })
    setLoading(false)
    if (err) {
      setError(err.message ?? 'Sign up failed')
      return
    }
    revalidator.revalidate()
    navigate('/settings')
  }

  return (
    <div className="mx-auto max-w-sm px-5 pt-14">
      <div className="border-ink bg-card shadow-hard border-2 p-6">
        <h1 className="font-display text-3xl uppercase">Join the show</h1>
        <p className="text-muted-foreground mt-1 mb-6 text-sm">
          Get a page, post your slop, keep the receipts.
        </p>
        <div className="space-y-4">
          <GitHubButton />
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="label-mono">
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                placeholder="What the marquee should say"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="label-mono">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="label-mono">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" variant="accent" className="w-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Sign up'}
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              Already in?{' '}
              <Link to="/sign-in" className="underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

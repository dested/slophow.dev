// Dead-simple in-memory sliding-window rate limiter. State lives in this
// process only — fine for the single-instance app; swap for Redis if this ever
// runs multi-instance. Returns true if the action is allowed (and records it),
// false if the caller is over the limit for the window.
const hits = new Map<string, number[]>()

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const cutoff = now - windowMs
  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff)
  if (recent.length >= max) {
    hits.set(key, recent)
    return false
  }
  recent.push(now)
  hits.set(key, recent)
  return true
}

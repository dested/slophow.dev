export function fmtCost(usd: number | null | undefined): string | null {
  if (usd == null) return null
  if (usd === 0) return '$0.00'
  if (usd < 1) return `$${usd.toFixed(2)}`
  if (usd < 100) return `$${usd.toFixed(2)}`
  return `$${Math.round(usd).toLocaleString('en-US')}`
}

export function fmtHours(hours: number | null | undefined): string | null {
  if (hours == null) return null
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 48) return `${hours % 1 === 0 ? hours : hours.toFixed(1)} hrs`
  return `${(hours / 24).toFixed(1)} days`
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

export function plural(n: number, word: string): string {
  return `${n === 1 ? word : `${word}s`}`
}

export function fmtCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`
  return `${(n / 1_000_000).toFixed(1)}m`
}

// Deterministic "days ago" label — computed from ISO strings so SSR and the
// client render the same markup (both use the client's clock post-hydration,
// but the SSR string only appears for the first paint; keep it date-only).
export function fmtDate(iso: string): string {
  return iso.slice(0, 10)
}

export const ACCENTS: Record<string, { label: string; color: string }> = {
  acid: { label: 'Acid', color: 'oklch(0.888 0.213 122)' },
  tangerine: { label: 'Tangerine', color: 'oklch(0.76 0.17 55)' },
  pool: { label: 'Pool', color: 'oklch(0.85 0.12 205)' },
  bubblegum: { label: 'Bubblegum', color: 'oklch(0.8 0.13 350)' },
  gold: { label: 'Gold', color: 'oklch(0.85 0.16 92)' },
}

export function accentColor(key: string | null | undefined): string {
  return (key && ACCENTS[key]?.color) || ACCENTS.acid.color
}

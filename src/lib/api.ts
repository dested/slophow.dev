// Non-tRPC endpoints: the stats beacon and raw-body file uploads.

export type StatKind = 'view' | 'play' | 'click'

export function sendHit(projectId: string, kind: StatKind) {
  const body = JSON.stringify({ projectId, kind })
  // sendBeacon survives page unloads (external-link clicks navigate away).
  if (navigator.sendBeacon?.('/api/hit', new Blob([body], { type: 'application/json' }))) return
  void fetch('/api/hit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}

async function parseOrThrow(res: Response) {
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Upload failed.')
  return data
}

export async function uploadBundle(projectId: string, file: File) {
  const res = await fetch(`/api/upload/bundle?projectId=${encodeURIComponent(projectId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/zip' },
    body: file,
  })
  return (await parseOrThrow(res)) as unknown as {
    version: number
    size: number
    fileCount: number
  }
}

export async function uploadImage(file: File) {
  const res = await fetch('/api/upload/image', {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  return (await parseOrThrow(res)) as unknown as { name: string }
}

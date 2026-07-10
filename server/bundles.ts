import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { unzipSync } from 'fflate'
import { env } from './env'

const MAX_FILES = 2000
const MAX_TOTAL_BYTES = 200 * 1024 * 1024 // uncompressed
const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export const dataDir = path.resolve(env.DATA_DIR)
export const bundlesDir = path.join(dataDir, 'bundles')
export const imagesDir = path.join(dataDir, 'images')

export function ensureDataDirs() {
  fs.mkdirSync(bundlesDir, { recursive: true })
  fs.mkdirSync(imagesDir, { recursive: true })
}

export class UploadError extends Error {}

// Reject anything that could escape the extraction root or misbehave on
// Windows. Zip entry names always use '/'.
function safeEntryPath(name: string): string | null {
  if (name.includes('\\') || name.includes('\0') || name.includes(':')) return null
  const parts = name.split('/').filter(Boolean)
  if (parts.length === 0) return null
  if (parts.some((p) => p === '.' || p === '..')) return null
  return parts.join('/')
}

// Extract an uploaded zip into DATA_DIR/bundles/<projectId>/<version>/.
// Requires an index.html at the root (a single wrapping folder is stripped,
// since "zip the folder" is what everyone does). Returns the total size.
export function extractBundle(
  projectId: string,
  version: number,
  zipBytes: Buffer
): { size: number; fileCount: number } {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(new Uint8Array(zipBytes))
  } catch {
    throw new UploadError('That file is not a valid zip.')
  }

  const files = new Map<string, Uint8Array>()
  for (const [rawName, data] of Object.entries(entries)) {
    if (rawName.endsWith('/')) continue // directory entry
    const name = safeEntryPath(rawName)
    if (!name) throw new UploadError(`Unsafe path in zip: ${rawName}`)
    if (name.split('/').pop()?.startsWith('.')) continue // .DS_Store & friends
    if (name.startsWith('__MACOSX/')) continue
    files.set(name, data)
  }

  if (files.size === 0) throw new UploadError('The zip is empty.')
  if (files.size > MAX_FILES) throw new UploadError(`Too many files (max ${MAX_FILES}).`)

  // Strip a single common root folder ("myproject/index.html" → "index.html").
  const roots = new Set([...files.keys()].map((n) => n.split('/')[0]))
  if (!files.has('index.html') && roots.size === 1) {
    const root = [...roots][0]
    const stripped = new Map<string, Uint8Array>()
    for (const [name, data] of files) stripped.set(name.slice(root.length + 1), data)
    if (stripped.has('index.html')) {
      files.clear()
      for (const [name, data] of stripped) files.set(name, data)
    }
  }
  if (!files.has('index.html')) {
    throw new UploadError('No index.html found at the root of the zip.')
  }

  let total = 0
  for (const data of files.values()) total += data.byteLength
  if (total > MAX_TOTAL_BYTES) {
    throw new UploadError('Bundle is over 200MB uncompressed.')
  }

  const root = path.join(bundlesDir, projectId, String(version))
  fs.rmSync(root, { recursive: true, force: true })
  for (const [name, data] of files) {
    const target = path.join(root, ...name.split('/'))
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, data)
  }

  // Old versions are dead weight once the pointer moves — best-effort cleanup.
  const projectRoot = path.join(bundlesDir, projectId)
  for (const entry of fs.readdirSync(projectRoot)) {
    if (entry !== String(version)) {
      fs.rmSync(path.join(projectRoot, entry), { recursive: true, force: true })
    }
  }

  return { size: total, fileCount: files.size }
}

export function deleteBundle(projectId: string) {
  fs.rmSync(path.join(bundlesDir, projectId), { recursive: true, force: true })
}

export function saveImage(contentType: string, bytes: Buffer): string {
  const ext = IMAGE_TYPES[contentType]
  if (!ext) throw new UploadError('Images must be png, jpg, webp, or gif.')
  const name = `${randomUUID()}.${ext}`
  fs.writeFileSync(path.join(imagesDir, name), bytes)
  return name
}

export function deleteImage(name: string) {
  // name is always a filename we generated; guard anyway.
  if (!/^[a-z0-9-]+\.(png|jpg|webp|gif)$/.test(name)) return
  fs.rmSync(path.join(imagesDir, name), { force: true })
}

// Resolve a request path inside a project's current bundle, or null if it
// escapes the root / doesn't exist. Directory requests get index.html.
export function resolveBundleFile(
  projectId: string,
  version: string,
  relPath: string
): string | null {
  if (!/^[a-z0-9-]+$/i.test(projectId) || !/^\d+$/.test(version)) return null
  const root = path.join(bundlesDir, projectId, version)
  let target = path.resolve(root, relPath || 'index.html')
  if (target !== root && !target.startsWith(root + path.sep)) return null
  let stat = fs.existsSync(target) ? fs.statSync(target) : null
  if (stat?.isDirectory()) {
    target = path.join(target, 'index.html')
    stat = fs.existsSync(target) ? fs.statSync(target) : null
  }
  return stat?.isFile() ? target : null
}

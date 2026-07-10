import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { unzipSync } from 'fflate'
import { env } from './env'

const MAX_FILES = 2000
const MAX_TOTAL_BYTES = 200 * 1024 * 1024 // uncompressed
const MAX_SINGLE_BYTES = 50 * 1024 * 1024 // uncompressed, per file
const IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

// Only obvious static-website content is allowed in a bundle. Anything else
// (executables, archives, shell scripts…) is rejected on upload and, as
// defense in depth, refused at serve time.
const ALLOWED_EXTENSIONS = new Set([
  'html',
  'htm',
  'js',
  'mjs',
  'css',
  'map',
  'json',
  'wasm',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'ico',
  'avif',
  'mp3',
  'ogg',
  'wav',
  'm4a',
  'mp4',
  'webm',
  'glb',
  'gltf',
  'bin',
  'ttf',
  'otf',
  'woff',
  'woff2',
  'txt',
  'md',
  'xml',
  'webmanifest',
  'vtt',
])

function extOf(name: string): string {
  const base = name.split('/').pop() ?? ''
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
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
  // Guard memory BEFORE decompressing: `originalSize` comes straight from the
  // zip header, so a tiny crafted "zip bomb" is rejected without ever being
  // inflated into RAM. Junk entries are dropped here too so they don't count.
  let entries: Record<string, Uint8Array>
  let sizeError: string | null = null
  let runningTotal = 0
  try {
    entries = unzipSync(new Uint8Array(zipBytes), {
      filter(file) {
        const leaf = file.name.split('/').pop() ?? ''
        if (file.name.endsWith('/') || leaf.startsWith('.') || file.name.startsWith('__MACOSX/')) {
          return false // directory / .DS_Store / __MACOSX junk
        }
        if (file.originalSize > MAX_SINGLE_BYTES) {
          sizeError ??= `“${file.name}” is over 50MB uncompressed.`
          return false
        }
        runningTotal += file.originalSize
        if (runningTotal > MAX_TOTAL_BYTES) {
          sizeError ??= 'Bundle is over 200MB uncompressed.'
          return false
        }
        return true
      },
    })
  } catch {
    throw new UploadError('That file is not a valid zip.')
  }
  if (sizeError) throw new UploadError(sizeError)

  const files = new Map<string, Uint8Array>()
  for (const [rawName, data] of Object.entries(entries)) {
    const name = safeEntryPath(rawName)
    if (!name) throw new UploadError(`Unsafe path in zip: ${rawName}`)
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

  // Only static-website content is servable — reject the rest by extension.
  const disallowed = [...files.keys()].filter((n) => !ALLOWED_EXTENSIONS.has(extOf(n)))
  if (disallowed.length > 0) {
    const shown = disallowed.slice(0, 5).join(', ')
    const more = disallowed.length > 5 ? ` (+${disallowed.length - 5} more)` : ''
    throw new UploadError(
      `These files aren't allowed in a bundle: ${shown}${more}. Remove them and re-zip.`
    )
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

// Read the real file type from magic bytes — the Content-Type header is
// attacker-controlled and can't be trusted.
function sniffImage(bytes: Buffer): 'png' | 'jpg' | 'webp' | 'gif' | null {
  if (bytes.length < 12) return null
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'gif' // GIF87a/GIF89a
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 && // "RIFF"
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50 // "WEBP"
  ) {
    return 'webp'
  }
  return null
}

export function saveImage(contentType: string, bytes: Buffer): string {
  const ext = IMAGE_TYPES[contentType]
  if (!ext) throw new UploadError('Images must be png, jpg, webp, or gif.')
  const actual = sniffImage(bytes)
  if (actual !== ext) {
    throw new UploadError(
      "That file isn't a real png, jpg, webp, or gif (its contents don't match)."
    )
  }
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
  if (!stat?.isFile()) return null
  // Defense in depth: never serve a file type the upload allowlist forbids.
  if (!ALLOWED_EXTENSIONS.has(extOf(target))) return null
  return target
}

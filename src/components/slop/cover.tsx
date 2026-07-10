import { cn } from '~/lib/utils'

// Deterministic placeholder art for projects without a cover image: a loud
// pattern + hue picked from the project id, title set huge in display type.
function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return Math.abs(h)
}

const HUES = [122, 55, 205, 350, 92]

function patternFor(id: string): React.CSSProperties {
  const h = hash(id)
  const hue = HUES[h % HUES.length]
  const soft = `oklch(0.9 0.11 ${hue})`
  const loud = `oklch(0.78 0.16 ${hue})`
  const kind = h % 4
  if (kind === 0) {
    return {
      background: `repeating-linear-gradient(45deg, ${soft} 0 18px, ${loud} 18px 36px)`,
    }
  }
  if (kind === 1) {
    return {
      backgroundColor: soft,
      backgroundImage: `radial-gradient(${loud} 22%, transparent 23%)`,
      backgroundSize: '34px 34px',
    }
  }
  if (kind === 2) {
    return {
      backgroundColor: soft,
      backgroundImage: `linear-gradient(${loud} 2px, transparent 2px), linear-gradient(90deg, ${loud} 2px, transparent 2px)`,
      backgroundSize: '28px 28px',
    }
  }
  return {
    background: `repeating-conic-gradient(${soft} 0 25%, ${loud} 0 50%) 0 0 / 44px 44px`,
  }
}

export function Cover({
  id,
  title,
  coverImage,
  className,
  showTitle = true,
}: {
  id: string
  title: string
  coverImage: string | null
  className?: string
  showTitle?: boolean // off for tiny thumbnails where the overlay can't fit
}) {
  if (coverImage) {
    return (
      <img
        src={`/files/images/${coverImage}`}
        alt={title}
        loading="lazy"
        className={cn('h-full w-full object-cover', className)}
      />
    )
  }
  return (
    <div
      className={cn('flex h-full w-full items-center justify-center overflow-hidden', className)}
      style={patternFor(id)}>
      {showTitle && (
        <span className="font-display text-ink bg-paper/85 max-w-[85%] px-3 py-1.5 text-center text-lg [overflow-wrap:anywhere] uppercase">
          {title}
        </span>
      )}
    </div>
  )
}

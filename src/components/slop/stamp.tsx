import { cn } from '~/lib/utils'

// Rubber-stamp badge — rotated mono caps in a double border.
export function Stamp({
  children,
  color,
  className,
}: {
  children: React.ReactNode
  color?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'label-mono border-ink bg-paper inline-block -rotate-3 border-2 px-2 py-1',
        className
      )}
      style={color ? { backgroundColor: color } : undefined}>
      {children}
    </span>
  )
}

// Section eyebrow: ★ LABEL ————————
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="label-mono shrink-0">★ {children}</span>
      <span className="bg-ink h-0.5 grow" />
    </div>
  )
}

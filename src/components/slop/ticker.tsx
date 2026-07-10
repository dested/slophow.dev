// Scrolling marquee strip. Content is rendered twice so the -50% translate
// loops seamlessly.
export function Ticker({ items }: { items: string[] }) {
  const strip = (ariaHidden: boolean) => (
    <span aria-hidden={ariaHidden} className="label-mono flex shrink-0 items-center">
      {items.map((item, i) => (
        <span key={i} className="flex items-center">
          <span className="px-4">{item}</span>
          <span className="text-sm">✦</span>
        </span>
      ))}
    </span>
  )
  return (
    <div className="border-ink bg-acid text-ink overflow-hidden border-y-2 py-1.5 whitespace-nowrap">
      <div className="animate-marquee flex w-max">
        {strip(false)}
        {strip(true)}
      </div>
    </div>
  )
}

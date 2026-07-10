import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '~/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono text-xs font-bold tracking-[0.12em] uppercase transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-ring/60 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground border-2 border-ink shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none',
        accent:
          'bg-acid text-ink border-2 border-ink shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none',
        destructive:
          'bg-destructive text-destructive-foreground border-2 border-ink shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none focus-visible:ring-destructive/30',
        outline:
          'bg-card text-ink border-2 border-ink shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none',
        ghost: 'border-2 border-transparent hover:border-ink',
        link: 'text-primary underline-offset-4 hover:underline normal-case tracking-normal font-sans',
      },
      size: {
        default: 'h-10 px-5 py-2 has-[>svg]:px-4',
        sm: 'h-8 gap-1.5 px-3 has-[>svg]:px-2.5 text-[0.65rem]',
        lg: 'h-12 px-7 has-[>svg]:px-5 text-sm',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

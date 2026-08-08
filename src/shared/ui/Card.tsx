import { cn } from '@/shared/lib/cn'

export function Card({
  className,
  interactive,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-ink-700 bg-ink-850/80 backdrop-blur-sm',
        interactive &&
          'transition-colors duration-200 hover:border-ink-500 hover:bg-ink-800/80',
        className,
      )}
      {...rest}
    />
  )
}

export function CardHeader({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-start justify-between gap-4 p-5 pb-0', className)} {...rest} />
}

export function CardTitle({ className, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-lg tracking-wide text-chalk', className)} {...rest} />
}

export function CardBody({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...rest} />
}

export function CardFooter({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center gap-3 border-t border-ink-700 px-5 py-4', className)}
      {...rest}
    />
  )
}

/** Section heading used across app pages so every screen has the same rhythm. */
export function PageHeading({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm text-chalk-dim">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

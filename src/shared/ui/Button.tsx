import { forwardRef } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const base =
  'relative inline-flex items-center justify-center gap-2 font-semibold tracking-wide uppercase ' +
  'transition-[background-color,color,border-color,transform,box-shadow] duration-200 ' +
  'active:translate-y-px disabled:pointer-events-none disabled:opacity-45 select-none whitespace-nowrap'

const variants: Record<Variant, string> = {
  primary:
    'bg-volt-400 text-ink-950 hover:bg-volt-300 shadow-[0_10px_30px_-12px_var(--color-volt-500)]',
  secondary: 'bg-ink-700 text-chalk hover:bg-ink-600 border border-ink-600',
  outline: 'border border-ink-500 text-chalk hover:border-volt-400 hover:text-volt-400 bg-transparent',
  ghost: 'text-chalk-dim hover:text-chalk hover:bg-ink-800',
  danger: 'bg-danger-500/15 text-danger-500 border border-danger-500/40 hover:bg-danger-500/25',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-xs rounded-md',
  md: 'h-11 px-5 text-sm rounded-lg',
  lg: 'h-14 px-8 text-base rounded-lg',
}

type CommonProps = {
  variant?: Variant
  size?: Size
  loading?: boolean
  className?: string
  children?: React.ReactNode
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  )
}

export type ButtonProps = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
})

export type ButtonLinkProps = CommonProps &
  Omit<React.ComponentProps<typeof Link>, 'className' | 'children'>

/** Same visual language as Button, but renders a real router link so that
 *  middle-click / open-in-new-tab keep working. */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </Link>
  )
}

export type ExternalButtonLinkProps = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'>

export function ExternalButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: ExternalButtonLinkProps) {
  return (
    <a className={cn(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </a>
  )
}

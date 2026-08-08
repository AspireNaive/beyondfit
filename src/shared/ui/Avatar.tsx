import { useMemo, useState } from 'react'
import { cn } from '@/shared/lib/cn'

const sizes = {
  xs: 'size-7 text-[10px]',
  sm: 'size-9 text-xs',
  md: 'size-11 text-sm',
  lg: 'size-16 text-lg',
  xl: 'size-24 text-2xl',
} as const

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/** Deterministic hue from the name so a person keeps the same colour
 *  everywhere in the app, with no colour stored on the record. */
function hueOf(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 360
  return hash
}

export function Avatar({
  name,
  src,
  size = 'md',
  className,
  ring,
}: {
  name: string
  src?: string | null
  size?: keyof typeof sizes
  className?: string
  ring?: boolean
}) {
  const [broken, setBroken] = useState(false)
  const hue = useMemo(() => hueOf(name), [name])

  const shell = cn(
    'relative grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold uppercase',
    sizes[size],
    ring && 'ring-2 ring-volt-400/60 ring-offset-2 ring-offset-ink-950',
    className,
  )

  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className={cn(shell, 'object-cover')}
      />
    )
  }

  return (
    <span
      className={shell}
      role="img"
      aria-label={name}
      style={{
        background: `linear-gradient(140deg, hsl(${hue} 55% 26%), hsl(${(hue + 40) % 360} 60% 16%))`,
        color: `hsl(${hue} 80% 78%)`,
      }}
    >
      {initialsOf(name)}
    </span>
  )
}

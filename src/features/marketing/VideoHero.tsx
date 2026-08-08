import { useEffect, useRef, useState } from 'react'
import { cn } from '@/shared/lib/cn'

/**
 * Full-bleed hero with a video background.
 *
 * The video is treated as an enhancement, never a dependency:
 *
 *  1. A CSS-only backdrop (layered gradients + grid + vignette) paints on the
 *     first frame. It is part of the stylesheet, so there is no image request,
 *     no layout shift and no empty black box while anything downloads.
 *  2. The <video> is attached only after the page is interactive, and only when
 *     the device actually wants it — we skip it on Save-Data, on
 *     prefers-reduced-motion, on 2g/3g, and on narrow viewports where a
 *     multi-megabyte background is indefensible on a metered plan.
 *  3. If the file is missing or fails to decode, we simply never fade it in.
 *
 * Drop a file at `public/media/hero.mp4` (and optionally `hero.webm`) or set
 * VITE_HERO_VIDEO_URL to a CDN URL, and it lights up with no code change.
 */

type NetworkInformation = { effectiveType?: string; saveData?: boolean }

function shouldLoadVideo(): boolean {
  if (typeof window === 'undefined') return false

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false

  // A background video is decoration; on a metered or slow link it is a cost
  // the visitor did not agree to.
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection
  if (connection?.saveData) return false
  if (connection?.effectiveType && /(^|-)(2g|slow-2g|3g)$/.test(connection.effectiveType)) {
    return false
  }

  // Phones get the static backdrop, which looks deliberate rather than degraded.
  return window.matchMedia('(min-width: 768px)').matches
}

export function VideoHero({
  children,
  className,
  sources,
  overlayClassName,
}: {
  children: React.ReactNode
  className?: string
  /** Ordered best-first; the browser picks the first type it supports. */
  sources?: readonly { src: string; type: string }[]
  overlayClassName?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [attach, setAttach] = useState(false)
  const [playing, setPlaying] = useState(false)

  const resolved =
    sources ??
    ([
      import.meta.env.VITE_HERO_VIDEO_URL && {
        src: import.meta.env.VITE_HERO_VIDEO_URL,
        type: 'video/mp4',
      },
      { src: '/media/hero.webm', type: 'video/webm' },
      { src: '/media/hero.mp4', type: 'video/mp4' },
    ].filter(Boolean) as { src: string; type: string }[])

  useEffect(() => {
    if (!shouldLoadVideo()) return

    // Wait for idle so the video never competes with the LCP text or the
    // route chunk for bandwidth.
    const schedule =
      window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 900))
    const handle = schedule(() => setAttach(true))

    return () => {
      if (window.cancelIdleCallback && typeof handle === 'number') {
        window.cancelIdleCallback(handle)
      } else {
        window.clearTimeout(handle as number)
      }
    }
  }, [])

  useEffect(() => {
    if (!attach) return
    const video = videoRef.current
    if (!video) return
    // Autoplay can still be refused (low power mode); the fallback stays put.
    video.play().catch(() => setPlaying(false))
  }, [attach])

  return (
    <section className={cn('relative isolate flex min-h-dvh items-center overflow-hidden', className)}>
      {/* Layer 1 — CSS backdrop. Always painted, zero requests. */}
      <div aria-hidden className="absolute inset-0 -z-30 bg-ink-950">
        <div
          className="absolute inset-0 animate-[bf-drift_28s_ease-in-out_infinite]"
          style={{
            background:
              'radial-gradient(60% 55% at 18% 22%, rgba(182,239,33,0.20), transparent 62%),' +
              'radial-gradient(55% 60% at 82% 18%, rgba(76,201,240,0.16), transparent 60%),' +
              'radial-gradient(70% 65% at 60% 95%, rgba(255,106,61,0.16), transparent 62%),' +
              'linear-gradient(160deg, #0d1520 0%, #06090d 55%, #0a1119 100%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.055]"
          style={{
            backgroundImage:
              'linear-gradient(var(--color-chalk) 1px, transparent 1px), linear-gradient(90deg, var(--color-chalk) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(70% 60% at 50% 45%, #000 30%, transparent 100%)',
          }}
        />
        <div className="absolute inset-y-0 left-1/4 w-1/2 animate-[bf-sweep_14s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-volt-500/[0.07] to-transparent blur-3xl" />
      </div>

      {/* Layer 2 — video, faded in only once it is genuinely playing. */}
      {attach && (
        <video
          ref={videoRef}
          className={cn(
            'absolute inset-0 -z-20 size-full object-cover transition-opacity duration-1000',
            playing ? 'opacity-60' : 'opacity-0',
          )}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          disablePictureInPicture
          aria-hidden
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          onError={() => setPlaying(false)}
        >
          {resolved.map((source) => (
            <source key={source.src} src={source.src} type={source.type} />
          ))}
        </video>
      )}

      {/* Layer 3 — legibility scrim. Text contrast must not depend on which
          frame of the video happens to be on screen. */}
      <div
        aria-hidden
        className={cn(
          'absolute inset-0 -z-10 bg-gradient-to-b from-ink-950/85 via-ink-950/55 to-ink-950',
          overlayClassName,
        )}
      />

      <div className="shell relative w-full py-28 lg:py-32">{children}</div>
    </section>
  )
}

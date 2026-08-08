/**
 * Brand marks as inline SVG.
 *
 * lucide-react dropped its brand icons, and pulling a second icon package for
 * four glyphs in the footer is not a trade worth making. These are 24×24 paths
 * that inherit currentColor like every other icon in the app.
 */

type IconProps = { className?: string }

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function FacebookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5H16.7V3.62A21 21 0 0 0 14.3 3.5c-2.38 0-4 1.45-4 4.12V9.9H7.6V13h2.7v8h3.2Z" />
    </svg>
  )
}

export function YoutubeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.84.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.84-.43a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10.1 14.9V9.1l5.05 2.9-5.05 2.9Z" />
    </svg>
  )
}

export function LinkedinIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M6.2 8.9H3.1V21h3.1V8.9ZM4.65 3a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6ZM21 21h-3.1v-6.3c0-1.5-.55-2.53-1.9-2.53-1.03 0-1.65.7-1.92 1.37-.1.24-.13.58-.13.92V21h-3.1s.04-11 0-12.1h3.1v1.71c.41-.63 1.15-1.53 2.8-1.53 2.04 0 3.57 1.33 3.57 4.2V21Z" />
    </svg>
  )
}

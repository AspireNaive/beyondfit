import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronDown, Menu, X } from 'lucide-react'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Logo } from '@/shared/ui/Logo'
import {
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  YoutubeIcon,
} from '@/shared/ui/SocialIcons'
import { homeRouteFor, useCurrentUser } from '@/features/auth/store'
import { CartDrawer } from '@/features/shop/CartDrawer'
import { cn } from '@/shared/lib/cn'

type NavItem = { label: string; to: string; children?: { label: string; to: string }[] }

const NAV: NavItem[] = [
  { label: 'Start', to: '/' },
  {
    label: 'Coaching',
    to: '/coaching',
    children: [
      { label: 'Fitness Transformation', to: '/coaching/transformation' },
      { label: 'Golf Fitness', to: '/coaching/golf' },
      { label: 'Healthy Heroes Program', to: '/coaching/heroes' },
    ],
  },
  { label: 'Testing', to: '/testing' },
  { label: 'Specialists', to: '/specialists' },
  { label: 'Shop', to: '/shop' },
  { label: 'Results', to: '/results' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
]

function DesktopNavItem({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  // Small close delay so the pointer can cross the gap into the submenu.
  const show = () => {
    window.clearTimeout(timer.current)
    setOpen(true)
  }
  const hide = () => {
    timer.current = window.setTimeout(() => setOpen(false), 120)
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  if (!item.children) {
    return (
      <NavLink
        to={item.to}
        className={({ isActive }) =>
          cn(
            'px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
            isActive ? 'text-volt-400' : 'text-chalk-dim hover:text-chalk',
          )
        }
      >
        {item.label}
      </NavLink>
    )
  }

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <NavLink
        to={item.to}
        onFocus={show}
        aria-expanded={open}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-1 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
            isActive ? 'text-volt-400' : 'text-chalk-dim hover:text-chalk',
          )
        }
      >
        {item.label}
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </NavLink>

      {open && (
        <div className="absolute left-0 top-full z-50 w-60 pt-2">
          <div className="panel overflow-hidden rounded-lg py-1.5 shadow-2xl">
            {item.children.map((child) => (
              <Link
                key={child.to}
                to={child.to}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm text-chalk-dim transition-colors hover:bg-ink-700 hover:text-chalk"
              >
                {child.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const user = useCurrentUser()
  const location = useLocation()

  useEffect(() => setMobileOpen(false), [location.pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300',
        scrolled || mobileOpen
          ? 'border-b border-ink-700 bg-ink-950/85 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="shell flex h-16 items-center justify-between gap-4 lg:h-20">
        <Link to="/" className="shrink-0" aria-label="Kedem Life home">
          <Logo />
        </Link>

        <nav className="hidden items-center xl:flex" aria-label="Main">
          {NAV.map((item) => (
            <DesktopNavItem key={item.to} item={item} />
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <ButtonLink to="/book" size="sm" variant="primary">
            Book my 15 min call
          </ButtonLink>
          {user ? (
            <ButtonLink to={homeRouteFor(user.role)} size="sm" variant="outline">
              My dashboard
            </ButtonLink>
          ) : (
            <ButtonLink to="/login" size="sm" variant="outline">
              App login
            </ButtonLink>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          <span className="sr-only">Menu</span>
        </Button>
      </div>

      {mobileOpen && (
        <div id="mobile-nav" className="border-t border-ink-700 bg-ink-950/95 backdrop-blur-xl lg:hidden">
          <nav className="shell max-h-[70vh] space-y-1 overflow-y-auto py-4" aria-label="Mobile">
            {NAV.map((item) => (
              <div key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'block rounded-md px-3 py-2.5 text-sm font-semibold uppercase tracking-wider',
                      isActive ? 'bg-ink-800 text-volt-400' : 'text-chalk-dim',
                    )
                  }
                >
                  {item.label}
                </NavLink>
                {item.children?.map((child) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    className="block rounded-md py-2 pl-7 pr-3 text-sm text-chalk-faint"
                  >
                    {child.label}
                  </NavLink>
                ))}
              </div>
            ))}
            <div className="grid gap-2 pt-3">
              <ButtonLink to="/book" size="md">
                Book my 15 min call
              </ButtonLink>
              <ButtonLink to={user ? homeRouteFor(user.role) : '/login'} size="md" variant="outline">
                {user ? 'My dashboard' : 'App login'}
              </ButtonLink>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

const FOOTER_LINKS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: 'Programme',
    links: [
      { label: 'Fitness Transformation', to: '/coaching/transformation' },
      { label: 'Golf Fitness', to: '/coaching/golf' },
      { label: 'Healthy Heroes', to: '/coaching/heroes' },
      { label: 'Root cause testing', to: '/testing' },
    ],
  },
  {
    title: 'Platform',
    links: [
      { label: 'Book a session', to: '/book' },
      { label: 'Find a specialist', to: '/specialists' },
      { label: 'Shop', to: '/shop' },
      { label: 'Member login', to: '/login' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Results', to: '/results' },
      { label: 'Contact', to: '/contact' },
      { label: 'For studios', to: '/platform' },
    ],
  },
]

function Footer() {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  return (
    <footer className="border-t border-ink-700 bg-ink-900">
      <div className="shell py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-chalk-dim">
              Coaching, nutrition and recovery on one platform — for the studios that run them and
              the people who show up.
            </p>

            <form
              className="mt-6"
              onSubmit={(e) => {
                e.preventDefault()
                setSubscribed(true)
              }}
            >
              <label htmlFor="footer-email" className="eyebrow">
                Weekly training notes
              </label>
              {subscribed ? (
                <p className="mt-2 text-sm text-volt-400">
                  You're on the list. Check your inbox to confirm.
                </p>
              ) : (
                <div className="mt-2 flex gap-2">
                  <input
                    id="footer-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-11 min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-950 px-3.5 text-sm outline-none transition-colors focus:border-volt-400"
                  />
                  <Button type="submit" size="md">
                    Join
                  </Button>
                </div>
              )}
            </form>
          </div>

          {FOOTER_LINKS.map((group) => (
            <div key={group.title}>
              <h4 className="text-sm tracking-widest text-chalk">{group.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-sm text-chalk-dim transition-colors hover:text-volt-400"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-5 border-t border-ink-700 pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-chalk-faint">
            © {new Date().getFullYear()} Kedem Life. All rights reserved. Product developed by
            AspireNaive.
          </p>
          <div className="flex items-center gap-1">
            {[
              { Icon: InstagramIcon, label: 'Instagram' },
              { Icon: FacebookIcon, label: 'Facebook' },
              { Icon: YoutubeIcon, label: 'YouTube' },
              { Icon: LinkedinIcon, label: 'LinkedIn' },
            ].map(({ Icon, label }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="rounded-md p-2 text-chalk-faint transition-colors hover:bg-ink-800 hover:text-chalk"
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

export function MarketingLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-volt-400 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-950"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
      {/* Mounted per-layout so it has router context for its links. */}
      <CartDrawer />
    </div>
  )
}

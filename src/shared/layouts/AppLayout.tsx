import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  Building2,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingBag,
  Stethoscope,
  Users,
  X,
} from 'lucide-react'
import { Permission, Role, can, fullName } from '@/domain/identity/model'
import { useAuthStore, useCurrentUser, useTenant } from '@/features/auth/store'
import { Avatar } from '@/shared/ui/Avatar'
import { Logo } from '@/shared/ui/Logo'
import { Badge } from '@/shared/ui/Badge'
import { CartButton } from '@/features/shop/CartButton'
import { CartDrawer } from '@/features/shop/CartDrawer'
import { cn } from '@/shared/lib/cn'

type NavEntry = {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
  /** Shown only if the role holds this permission. */
  permission?: Permission
  /** Shown only to these roles, when a permission is too coarse. */
  roles?: readonly Role[]
}

const NAV: NavEntry[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true, roles: [Role.Member] },
  { to: '/app/coach', label: 'Dashboard', icon: LayoutDashboard, end: true, roles: [Role.Coach] },
  {
    to: '/app/admin',
    label: 'Dashboard',
    icon: LayoutDashboard,
    end: true,
    roles: [Role.Admin, Role.AppManager],
  },
  { to: '/app/progress', label: 'Progress', icon: Activity, roles: [Role.Member] },
  { to: '/app/schedule', label: 'Appointments', icon: CalendarDays },
  { to: '/app/specialists', label: 'Find a specialist', icon: Stethoscope, roles: [Role.Member] },
  { to: '/app/people', label: 'People', icon: Users },
  {
    to: '/app/orders',
    label: 'Orders',
    icon: Package,
    permission: Permission.ViewOrders,
  },
  { to: '/app/my-orders', label: 'My orders', icon: Package, roles: [Role.Member] },
  {
    to: '/app/payments',
    label: 'Payments',
    icon: CreditCard,
    permission: Permission.ViewPayments,
  },
  {
    to: '/app/tenants',
    label: 'Studios',
    icon: Building2,
    permission: Permission.ManagePlatform,
  },
  { to: '/shop', label: 'Shop', icon: ShoppingBag },
]

const visibleNav = (role: Role) =>
  NAV.filter((entry) => {
    if (entry.roles && !entry.roles.includes(role)) return false
    if (entry.permission && !can(role, entry.permission)) return false
    return true
  })

function SidebarNav({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1" aria-label="Application">
      {visibleNav(role).map((entry) => (
        <NavLink
          key={entry.to}
          to={entry.to}
          end={entry.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-volt-400/12 text-volt-400'
                : 'text-chalk-dim hover:bg-ink-800 hover:text-chalk',
            )
          }
        >
          <entry.icon className="size-4.5 shrink-0" />
          {entry.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppLayout() {
  const user = useCurrentUser()
  const tenant = useTenant()
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => setDrawerOpen(false), [location.pathname])

  if (!user) return null

  const onSignOut = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  const identity = (
    <div className="flex items-center gap-3">
      <Avatar name={fullName(user)} src={user.avatarUrl} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-chalk">{fullName(user)}</p>
        <p className="truncate text-xs text-chalk-faint capitalize">
          {user.role.replace('_', ' ')}
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-ink-700 bg-ink-900 lg:flex">
        <div className="flex h-16 items-center border-b border-ink-700 px-5">
          <Link to="/" aria-label="BeyondFit home">
            <Logo />
          </Link>
        </div>

        {tenant && (
          <div className="border-b border-ink-700 px-5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-chalk-faint">
              Studio
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="truncate text-sm text-chalk">{tenant.name}</p>
              <Badge tone="volt">{tenant.plan}</Badge>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav role={user.role} />
        </div>

        <div className="border-t border-ink-700 p-3">
          <Link
            to="/app/profile"
            className="block rounded-lg p-2 transition-colors hover:bg-ink-800"
          >
            {identity}
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-chalk-dim transition-colors hover:bg-ink-800 hover:text-danger-500"
          >
            <LogOut className="size-4.5" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-ink-700 bg-ink-950/85 px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="rounded-md p-2 text-chalk-dim hover:bg-ink-800 hover:text-chalk lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          <Link to="/" className="lg:hidden" aria-label="BeyondFit home">
            <Logo compact />
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/app/people"
              aria-label="Search people"
              className="rounded-md p-2 text-chalk-dim transition-colors hover:bg-ink-800 hover:text-chalk"
            >
              <Search className="size-5" />
            </Link>
            <CartButton />
            <Link to="/app/profile" className="lg:hidden">
              <Avatar name={fullName(user)} src={user.avatarUrl} size="sm" />
            </Link>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>

      {/* Mounted per-layout so it has router context for its links. */}
      <CartDrawer />

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-ink-700 bg-ink-900 shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-ink-700 px-4">
              <Logo />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="rounded-md p-2 text-chalk-dim hover:bg-ink-800 hover:text-chalk"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <SidebarNav role={user.role} onNavigate={() => setDrawerOpen(false)} />
            </div>
            <div className="border-t border-ink-700 p-3">
              <Link to="/app/profile" className="block rounded-lg p-2 hover:bg-ink-800">
                {identity}
              </Link>
              <button
                type="button"
                onClick={onSignOut}
                className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-chalk-dim hover:bg-ink-800 hover:text-danger-500"
              >
                <LogOut className="size-4.5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

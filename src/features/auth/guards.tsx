import { Navigate, useLocation } from 'react-router-dom'
import { can, type Permission, type Role } from '@/domain/identity/model'
import { homeRouteFor, useAuthStatus, useCurrentUser } from './store'
import { RouteFallback } from '@/shared/ui/Feedback'

/**
 * Client-side guards are a UX affordance, not a security control — the .NET API
 * authorises every request independently. They exist so a member never sees an
 * admin screen flash before the server refuses it.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useAuthStatus()
  const user = useCurrentUser()
  const location = useLocation()

  // Wait for the persisted session to be revalidated before deciding.
  if (status === 'idle' || status === 'restoring') return <RouteFallback />

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  return <>{children}</>
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission
  children: React.ReactNode
}) {
  const user = useCurrentUser()
  if (!user) return <Navigate to="/login" replace />
  if (!can(user.role, permission)) return <Navigate to={homeRouteFor(user.role)} replace />
  return <>{children}</>
}

export function RequireRole({
  roles,
  children,
}: {
  roles: readonly Role[]
  children: React.ReactNode
}) {
  const user = useCurrentUser()
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) return <Navigate to={homeRouteFor(user.role)} replace />
  return <>{children}</>
}

/** Keeps a signed-in user off the login/register screens. */
export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const status = useAuthStatus()
  const user = useCurrentUser()

  if (status === 'idle' || status === 'restoring') return <RouteFallback />
  if (user) return <Navigate to={homeRouteFor(user.role)} replace />
  return <>{children}</>
}

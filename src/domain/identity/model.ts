import type { IsoDate, IsoDateTime, TenantId, UserId } from '@/domain/shared/types'

/**
 * Identity & access — the bounded context that owns who a person is and what
 * they may do. Every other context references a UserId and nothing more.
 */

export const Role = {
  Member: 'member',
  Coach: 'coach',
  Admin: 'admin',
  AppManager: 'app_manager',
} as const

export type Role = (typeof Role)[keyof typeof Role]

export const ROLE_LABELS: Record<Role, string> = {
  [Role.Member]: 'Member',
  [Role.Coach]: 'Coach',
  [Role.Admin]: 'Admin',
  [Role.AppManager]: 'App Manager',
}

/**
 * The app manager operates the platform across tenants; an admin operates a
 * single tenant. Keeping them distinct is what makes this multi-tenant SaaS
 * rather than one gym's website.
 */
export const ROLE_RANK: Record<Role, number> = {
  [Role.Member]: 0,
  [Role.Coach]: 1,
  [Role.Admin]: 2,
  [Role.AppManager]: 3,
}

export const isAtLeast = (role: Role, minimum: Role) => ROLE_RANK[role] >= ROLE_RANK[minimum]

/** Fine-grained capabilities, so screens ask "can I?" not "am I an admin?". */
export const Permission = {
  ViewOwnProgress: 'progress:read:self',
  ViewAssignedProgress: 'progress:read:assigned',
  ManageAppointments: 'appointments:write',
  ViewOrders: 'orders:read',
  ViewPayments: 'payments:read',
  ManageCatalog: 'catalog:write',
  /** Write articles for the public blog. Coaches and studio staff. */
  PublishContent: 'content:write',
  ManageTenant: 'tenant:write',
  ManagePlatform: 'platform:write',
} as const

export type Permission = (typeof Permission)[keyof typeof Permission]

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.Member]: [Permission.ViewOwnProgress, Permission.ManageAppointments],
  [Role.Coach]: [
    Permission.ViewOwnProgress,
    Permission.ViewAssignedProgress,
    Permission.ManageAppointments,
    Permission.ViewOrders,
    Permission.PublishContent,
  ],
  [Role.Admin]: [
    Permission.ViewOwnProgress,
    Permission.ViewAssignedProgress,
    Permission.ManageAppointments,
    Permission.ViewOrders,
    Permission.ViewPayments,
    Permission.ManageCatalog,
    Permission.PublishContent,
    Permission.ManageTenant,
  ],
  [Role.AppManager]: [
    Permission.ViewOwnProgress,
    Permission.ViewAssignedProgress,
    Permission.ManageAppointments,
    Permission.ViewOrders,
    Permission.ViewPayments,
    Permission.ManageCatalog,
    Permission.PublishContent,
    Permission.ManageTenant,
    Permission.ManagePlatform,
  ],
}

export const can = (role: Role, permission: Permission) =>
  ROLE_PERMISSIONS[role].includes(permission)

export type UserProfile = {
  readonly id: UserId
  readonly tenantId: TenantId
  readonly role: Role
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly phone?: string
  readonly avatarUrl?: string | null
  readonly title?: string
  readonly bio?: string
  readonly location?: string
  readonly joinedAt: IsoDate
  /** Coach-only: what they are credentialed in. Drives the specialist finder. */
  readonly specialties?: readonly string[]
  readonly credentials?: readonly string[]
  readonly rating?: number
  readonly sessionsDelivered?: number
  /** Member-only: the coach they are assigned to. */
  readonly assignedCoachId?: UserId | null
  readonly status: 'active' | 'invited' | 'suspended'
}

/** What a studio admin supplies when adding a member or a coach. */
export type NewPersonInput = {
  readonly role: typeof Role.Member | typeof Role.Coach
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly phone?: string | null
  readonly title?: string | null
  readonly bio?: string | null
  /** Leave empty to have one generated and shown once. */
  readonly password?: string | null
  readonly assignedCoachId?: UserId | null
  readonly specialties?: readonly string[] | null
  readonly credentials?: readonly string[] | null
  /** Coaches only: what they can be booked for and their hourly rate (minor units). */
  readonly discipline?: string | null
  readonly sessionRateMinor?: number | null
  /** App managers may pick the studio; admins always add to their own. */
  readonly tenantId?: TenantId | null
}

export type PersonPatch = {
  readonly assignedCoachId?: UserId | null
  readonly status?: UserProfile['status']
  readonly title?: string | null
}

export const fullName = (user: Pick<UserProfile, 'firstName' | 'lastName'>) =>
  `${user.firstName} ${user.lastName}`.trim()

/** Tenant = one gym/studio on the platform. */
export type Tenant = {
  readonly id: TenantId
  readonly name: string
  readonly slug: string
  readonly plan: 'starter' | 'growth' | 'scale'
  readonly seats: number
  readonly seatsUsed: number
  readonly createdAt: IsoDate
  readonly primaryColor?: string
}

export type AuthSession = {
  readonly user: UserProfile
  readonly tenant: Tenant
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresAt: IsoDateTime
}

/** Request/response shapes mirroring the API auth routes. Keeping them in
 *  the domain means swapping the mock adapter for HTTP changes no UI code. */
export type LoginRequest = {
  readonly email: string
  readonly password: string
  /** Which portal the credentials were presented at. The server rejects a
   *  member signing in through the admin portal even with valid credentials. */
  readonly portal: Role
  readonly tenantSlug?: string
  readonly rememberMe?: boolean
}

export type RegisterRequest = {
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly password: string
  readonly phone?: string
  readonly goal?: string
  readonly tenantSlug?: string
}

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'wrong_portal'
  | 'email_taken'
  | 'weak_password'
  | 'suspended'
  | 'network'

export class AuthError extends Error {
  // Declared as a field rather than a constructor parameter property: the build
  // runs with `erasableSyntaxOnly`, which rejects the shorthand.
  readonly code: AuthErrorCode

  constructor(message: string, code: AuthErrorCode) {
    super(message)
    this.name = 'AuthError'
    this.code = code
  }
}

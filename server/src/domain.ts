/**
 * The API's vocabulary. Deliberately a hand-maintained mirror of the front
 * end's src/domain/* so the server package deploys on its own; values are
 * data (enum-like const objects) so zod schemas and SQL ENUMs can share them.
 */

export const Role = {
  Member: 'member',
  Coach: 'coach',
  Admin: 'admin',
  AppManager: 'app_manager',
} as const
export type Role = (typeof Role)[keyof typeof Role]
export const ROLES = Object.values(Role) as [Role, ...Role[]]

export const Permission = {
  ViewOwnProgress: 'progress:read:self',
  ViewAssignedProgress: 'progress:read:assigned',
  ManageAppointments: 'appointments:write',
  ViewOrders: 'orders:read',
  ViewPayments: 'payments:read',
  ManageCatalog: 'catalog:write',
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
  ],
  [Role.Admin]: [
    Permission.ViewOwnProgress,
    Permission.ViewAssignedProgress,
    Permission.ManageAppointments,
    Permission.ViewOrders,
    Permission.ViewPayments,
    Permission.ManageCatalog,
    Permission.ManageTenant,
  ],
  [Role.AppManager]: [
    Permission.ViewOwnProgress,
    Permission.ViewAssignedProgress,
    Permission.ManageAppointments,
    Permission.ViewOrders,
    Permission.ViewPayments,
    Permission.ManageCatalog,
    Permission.ManageTenant,
    Permission.ManagePlatform,
  ],
}

export const can = (role: Role, permission: Permission) => ROLE_PERMISSIONS[role].includes(permission)

export const DISCIPLINES = ['coaching', 'nutrition', 'physiotherapy', 'medical', 'mental_performance'] as const
export type Discipline = (typeof DISCIPLINES)[number]

export const CHANNELS = ['zoom', 'google_meet', 'phone', 'in_person'] as const
export type MeetingChannel = (typeof CHANNELS)[number]

export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'] as const
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number]

export const PRODUCT_CATEGORIES = ['program', 'supplement', 'equipment', 'apparel', 'testing', 'membership'] as const
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]

export const ORDER_STATUSES = ['awaiting_payment', 'paid', 'processing', 'shipped', 'delivered', 'refunded', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const PAYMENT_METHODS = ['card', 'apple_pay', 'google_pay', 'bank_transfer'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_STATUSES = ['succeeded', 'pending', 'failed', 'refunded', 'disputed'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const SUBSCRIPTION_STATUSES = ['active', 'past_due', 'cancelled', 'trialing'] as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

export const TENANT_PLANS = ['starter', 'growth', 'scale'] as const
export type TenantPlan = (typeof TENANT_PLANS)[number]

export const USER_STATUSES = ['active', 'invited', 'suspended'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

// ---- Response shapes (exactly what the front end's ports expect) ----------

export type Money = { amountMinor: number; currency: 'USD' | 'EUR' | 'GBP' | 'INR' }

export type UserProfile = {
  id: string
  tenantId: string
  role: Role
  firstName: string
  lastName: string
  email: string
  phone?: string
  avatarUrl?: string | null
  title?: string
  bio?: string
  location?: string
  joinedAt: string
  specialties?: string[]
  credentials?: string[]
  rating?: number
  sessionsDelivered?: number
  assignedCoachId?: string | null
  status: UserStatus
}

export type Tenant = {
  id: string
  name: string
  slug: string
  plan: TenantPlan
  seats: number
  seatsUsed: number
  createdAt: string
  primaryColor?: string
}

export type AuthSession = {
  user: UserProfile
  tenant: Tenant
  accessToken: string
  refreshToken: string
  expiresAt: string
}

export type Provider = {
  id: string
  name: string
  avatarUrl?: string | null
  discipline: Discipline
  title: string
  bio: string
  credentials: string[]
  rating: number
  reviewCount: number
  sessionRate: Money
  channels: MeetingChannel[]
  nextAvailable?: string
  timezone: string
}

export type AvailabilitySlot = { startsAt: string; durationMinutes: number; available: boolean }

export type Appointment = {
  id: string
  memberId: string
  memberName: string
  providerId: string
  providerName: string
  discipline: Discipline
  channel: MeetingChannel
  startsAt: string
  durationMinutes: number
  status: AppointmentStatus
  price: Money
  joinUrl?: string
  notes?: string
  memberGoal?: string
  createdAt: string
}

export type BodyMetricEntry = {
  id: string
  memberId: string
  recordedOn: string
  weightKg: number
  heightCm: number
  bodyFatPercent?: number
  restingHeartRate?: number
  waistCm?: number
  note?: string
}

export type ActivityEntry = {
  memberId: string
  date: string
  steps: number
  activeMinutes: number
  caloriesBurned: number
  caloriesConsumed: number
  proteinGrams: number
  waterMl: number
  sleepHours: number
  workouts: number
}

export type MemberGoal = {
  memberId: string
  targetWeightKg?: number
  dailyCalorieTarget: number
  dailyProteinTarget: number
  dailyStepTarget: number
  weeklyWorkoutTarget: number
  focus: string
}

export type Product = {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  category: ProductCategory
  price: Money
  compareAtPrice?: Money
  imageUrl?: string
  accent: string
  rating: number
  reviewCount: number
  inStock: boolean
  badge?: string
  digital: boolean
  instructorId?: string
}

export type OrderLine = {
  productId: string
  name: string
  quantity: number
  unitPrice: Money
  instructorId?: string
}

export type Order = {
  id: string
  reference: string
  customerId: string
  customerName: string
  customerEmail: string
  lines: OrderLine[]
  subtotal: Money
  shipping: Money
  tax: Money
  total: Money
  status: OrderStatus
  placedAt: string
  fulfilledAt?: string
  trackingNumber?: string
}

export type Payment = {
  id: string
  reference: string
  orderId?: string
  customerId: string
  customerName: string
  description: string
  gross: Money
  fee: Money
  net: Money
  method: PaymentMethod
  cardLast4?: string
  cardBrand?: string
  status: PaymentStatus
  processedAt: string
  payoutId?: string
}

export type Subscription = {
  id: string
  memberId: string
  memberName: string
  planName: string
  price: Money
  interval: 'month' | 'year'
  status: SubscriptionStatus
  startedAt: string
  renewsAt: string
}

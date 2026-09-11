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

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export const FOOD_SOURCES = ['manual', 'photo'] as const
export type FoodSource = (typeof FOOD_SOURCES)[number]

export const ANALYSIS_CONFIDENCE = ['low', 'medium', 'high'] as const
export type AnalysisConfidence = (typeof ANALYSIS_CONFIDENCE)[number]

export const DIET_PLAN_STATUSES = ['active', 'archived'] as const
export type DietPlanStatus = (typeof DIET_PLAN_STATUSES)[number]

export const POST_STATUSES = ['draft', 'published'] as const
export type PostStatus = (typeof POST_STATUSES)[number]

export const POST_BLOCK_TYPES = ['heading', 'paragraph', 'image', 'video', 'quote', 'list'] as const
export type PostBlockType = (typeof POST_BLOCK_TYPES)[number]

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

/** Models a studio may pick for food-photo analysis, most accurate first. */
export const PHOTO_ANALYSIS_MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'] as const
export type PhotoAnalysisModel = (typeof PHOTO_ANALYSIS_MODELS)[number]

/** Per-studio nutrition settings; null means "use the platform default". */
export type TenantNutritionSettings = {
  model: PhotoAnalysisModel | null
  /** Photo analyses per member per day; 0 switches the feature off for the studio. */
  dailyPhotoLimit: number | null
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
  nutrition: TenantNutritionSettings
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

// ---- Content (blog) --------------------------------------------------------

export type PostBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'image'; url: string; alt: string; caption?: string }
  | { type: 'video'; url: string; caption?: string }
  | { type: 'quote'; text: string; attribution?: string }
  | { type: 'list'; items: string[] }

export type Post = {
  id: string
  tenantId: string
  tenantName: string
  tenantSlug: string
  slug: string
  title: string
  excerpt: string
  coverImageUrl: string | null
  tags: string[]
  blocks: PostBlock[]
  authorId: string
  authorName: string
  authorRole: Role
  authorTitle?: string
  authorAvatarUrl: string | null
  status: PostStatus
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  readingMinutes: number
}

/** Paged envelope for list endpoints. */
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number }

// ---- Nutrition (food diary + diet plans) -------------------------------------

export type Macros = { calories: number; proteinG: number; carbsG: number; fatG: number }

export type FoodItem = Macros & {
  name: string
  /** Human portion, e.g. "1 cup", "150 g", "2 slices". */
  portion: string
}

/** What the photo analyser returns; the member edits it before saving. */
export type FoodAnalysis = {
  dishName: string
  items: FoodItem[]
  totals: Macros
  confidence: AnalysisConfidence
  notes: string | null
  model: string
}

export type FoodEntry = {
  id: string
  tenantId: string
  memberId: string
  date: string
  mealType: MealType
  loggedAt: string
  title: string
  items: FoodItem[]
  totals: Macros
  notes: string | null
  source: FoodSource
  /** Small inline preview; the full photo is a separate request. */
  thumbDataUrl: string | null
  hasPhoto: boolean
  createdAt: string
  updatedAt: string
}

export type DietPlanMeal = { name: string; time: string | null; description: string; calories: number | null }

export type DietPlan = {
  id: string
  tenantId: string
  memberId: string
  authorId: string
  authorName: string
  authorRole: Role
  title: string
  summary: string
  targets: Macros
  meals: DietPlanMeal[]
  guidelines: string[]
  status: DietPlanStatus
  createdAt: string
  updatedAt: string
}

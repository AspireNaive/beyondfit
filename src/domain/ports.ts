import type {
  AuthSession,
  LoginRequest,
  NewPersonInput,
  PersonPatch,
  RegisterRequest,
  Role,
  Tenant,
  UserProfile,
} from '@/domain/identity/model'
import type {
  DailyTotals,
  DietPlan,
  DietPlanInput,
  FoodAnalysis,
  FoodEntry,
  FoodEntryInput,
  FoodEntryPatch,
  NutritionCapabilities,
} from '@/domain/nutrition/model'
import type {
  Appointment,
  AvailabilitySlot,
  BookAppointmentRequest,
  Discipline,
  Provider,
} from '@/domain/scheduling/model'
import type {
  ActivityEntry,
  BodyMetricEntry,
  MemberGoal,
} from '@/domain/progress/model'
import type {
  CartLine,
  Order,
  Payment,
  PaymentMethod,
  Product,
  ProductCategory,
  Subscription,
} from '@/domain/commerce/model'
import type { Post, PostFilter, PostInput, PostStatus } from '@/domain/content/model'
import type { FoodEntryId, IsoDate, OrderId, Page, PostId, UserId } from '@/domain/shared/types'

/**
 * Ports. The UI depends only on these interfaces; `infrastructure/` supplies
 * either the HTTP adapter for the Node API in ./server (the default) or the
 * in-memory adapter. Swapping is one environment variable, VITE_API_MODE.
 */

export interface AuthPort {
  login(request: LoginRequest): Promise<AuthSession>
  register(request: RegisterRequest): Promise<AuthSession>
  logout(): Promise<void>
  /** Restore a session on boot — reads the persisted token, revalidates it. */
  restore(): Promise<AuthSession | null>
  requestPasswordReset(email: string): Promise<void>
  /** Second half of the reset flow: the emailed token plus the new password. */
  resetPassword(token: string, password: string): Promise<void>
}

export interface DirectoryPort {
  /** People the signed-in user is allowed to see, plus always themselves. */
  listMappedProfiles(viewer: UserProfile): Promise<readonly UserProfile[]>
  getProfile(id: UserId): Promise<UserProfile | null>
  listByRole(role: Role): Promise<readonly UserProfile[]>
  /** Studio management (admin, app manager): add a member or coach… */
  createPerson(input: NewPersonInput): Promise<{ user: UserProfile; temporaryPassword: string | null }>
  /** …and map a member to a coach or change someone's status. */
  updatePerson(userId: UserId, patch: PersonPatch): Promise<UserProfile>
}

/**
 * Food diary and diet plans. Reads follow the progress rules (the member,
 * coaches and admin of their studio, platform staff). Members log their own
 * meals; diet plans are written by coaches and staff.
 */
export interface NutritionPort {
  capabilities(): Promise<NutritionCapabilities>
  /** Estimate calories and macros from a photo; nothing is saved. */
  analyzeFoodPhoto(memberId: UserId, photoDataUrl: string, hint?: string): Promise<FoodAnalysis>
  listFoodEntries(memberId: UserId, range: { from: IsoDate; to: IsoDate }): Promise<readonly FoodEntry[]>
  dailyTotals(memberId: UserId, range: { from: IsoDate; to: IsoDate }): Promise<readonly DailyTotals[]>
  logFood(memberId: UserId, input: FoodEntryInput): Promise<FoodEntry>
  updateFood(memberId: UserId, entryId: FoodEntryId, patch: FoodEntryPatch): Promise<FoodEntry>
  deleteFood(memberId: UserId, entryId: FoodEntryId): Promise<void>
  getFoodPhoto(memberId: UserId, entryId: FoodEntryId): Promise<string | null>
  getDietPlan(memberId: UserId): Promise<DietPlan | null>
  listDietPlans(memberId: UserId): Promise<readonly DietPlan[]>
  saveDietPlan(memberId: UserId, input: DietPlanInput, author: UserProfile): Promise<DietPlan>
}

export interface SchedulingPort {
  listProviders(filter?: { discipline?: Discipline; query?: string }): Promise<readonly Provider[]>
  getProvider(id: UserId): Promise<Provider | null>
  getAvailability(providerId: UserId, date: IsoDate): Promise<readonly AvailabilitySlot[]>
  listAppointments(viewer: UserProfile): Promise<readonly Appointment[]>
  book(request: BookAppointmentRequest, member: UserProfile): Promise<Appointment>
  cancel(appointmentId: Appointment['id']): Promise<Appointment>
}

export interface ProgressPort {
  listBodyMetrics(memberId: UserId): Promise<readonly BodyMetricEntry[]>
  listActivity(memberId: UserId, days: number): Promise<readonly ActivityEntry[]>
  getGoal(memberId: UserId): Promise<MemberGoal>
  logBodyMetric(
    entry: Omit<BodyMetricEntry, 'id'>,
  ): Promise<BodyMetricEntry>
}

export interface CatalogPort {
  listProducts(filter?: { category?: ProductCategory; query?: string }): Promise<readonly Product[]>
  getProduct(slug: string): Promise<Product | null>
}

export interface OrdersPort {
  /** Orders scoped to the viewer: own orders for members, orders containing
   *  their programs for coaches, everything for admins. */
  listOrders(viewer: UserProfile): Promise<readonly Order[]>
  getOrder(id: OrderId): Promise<Order | null>
  placeOrder(
    lines: readonly CartLine[],
    customer: UserProfile,
    options?: { method?: PaymentMethod },
  ): Promise<Order>
  updateStatus(id: OrderId, status: Order['status']): Promise<Order>
}

export interface PaymentsPort {
  listPayments(): Promise<readonly Payment[]>
  listSubscriptions(): Promise<readonly Subscription[]>
}

export interface TenantPort {
  getTenant(): Promise<Tenant>
  listTenants(): Promise<readonly Tenant[]>
}

export type ContactMessage = {
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly phone?: string
  readonly topic: string
  readonly message: string
}

/** Public forms on the marketing site. */
export interface MarketingPort {
  sendContactMessage(message: ContactMessage): Promise<void>
  subscribeNewsletter(email: string): Promise<void>
}

/**
 * Articles and blog posts. Reads are public — the feed is visible whether or
 * not anyone is signed in — and writes are for coaches and studio staff.
 */
export interface ContentPort {
  /** Published posts, newest first, paged so older posts stay reachable. */
  listPosts(filter?: PostFilter): Promise<Page<Post>>
  /** A published post by slug; authors and staff also get their drafts. */
  getPost(slug: string): Promise<Post | null>
  /** Drafts and published posts the viewer may manage: own for coaches,
   *  the studio's for admins, everything for app managers. */
  listManagedPosts(viewer: UserProfile): Promise<readonly Post[]>
  createPost(input: PostInput, author: UserProfile): Promise<Post>
  updatePost(id: PostId, patch: Partial<PostInput>): Promise<Post>
  setPostStatus(id: PostId, status: PostStatus): Promise<Post>
  deletePost(id: PostId): Promise<void>
}

export type Container = {
  auth: AuthPort
  directory: DirectoryPort
  scheduling: SchedulingPort
  progress: ProgressPort
  catalog: CatalogPort
  orders: OrdersPort
  payments: PaymentsPort
  tenants: TenantPort
  marketing: MarketingPort
  content: ContentPort
  nutrition: NutritionPort
}

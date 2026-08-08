import type {
  AuthSession,
  LoginRequest,
  RegisterRequest,
  Role,
  Tenant,
  UserProfile,
} from '@/domain/identity/model'
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
  Product,
  ProductCategory,
  Subscription,
} from '@/domain/commerce/model'
import type { IsoDate, OrderId, UserId } from '@/domain/shared/types'

/**
 * Ports. The UI depends only on these interfaces; `infrastructure/` supplies
 * either the in-memory adapter (today) or the .NET HTTP adapter (once the API
 * is live). Swapping is a one-line change in `infrastructure/container.ts`.
 */

export interface AuthPort {
  login(request: LoginRequest): Promise<AuthSession>
  register(request: RegisterRequest): Promise<AuthSession>
  logout(): Promise<void>
  /** Restore a session on boot — reads the persisted token, revalidates it. */
  restore(): Promise<AuthSession | null>
  requestPasswordReset(email: string): Promise<void>
}

export interface DirectoryPort {
  /** People the signed-in user is allowed to see, plus always themselves. */
  listMappedProfiles(viewer: UserProfile): Promise<readonly UserProfile[]>
  getProfile(id: UserId): Promise<UserProfile | null>
  listByRole(role: Role): Promise<readonly UserProfile[]>
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
  placeOrder(lines: readonly CartLine[], customer: UserProfile): Promise<Order>
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

export type Container = {
  auth: AuthPort
  directory: DirectoryPort
  scheduling: SchedulingPort
  progress: ProgressPort
  catalog: CatalogPort
  orders: OrdersPort
  payments: PaymentsPort
  tenants: TenantPort
}

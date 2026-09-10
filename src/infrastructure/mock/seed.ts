import { Role, type Tenant, type UserProfile } from '@/domain/identity/model'
import {
  AppointmentStatus,
  Discipline,
  MeetingChannel,
  type Appointment,
  type Provider,
} from '@/domain/scheduling/model'
import type { ActivityEntry, BodyMetricEntry, MemberGoal } from '@/domain/progress/model'
import { PostStatus, readingMinutes, type Post, type PostBlock } from '@/domain/content/model'
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductCategory,
  type Order,
  type Payment,
  type Product,
  type Subscription,
} from '@/domain/commerce/model'
import { id, money, type IsoDate, type TenantId, type UserId } from '@/domain/shared/types'
import { toIsoDate } from '@/shared/lib/dates'

/**
 * Deterministic demo data.
 *
 * Seeded PRNG rather than Math.random so the dashboard shows the same numbers
 * on every reload — screenshots stay stable and "did my change break the
 * chart?" is answerable. The same fixtures seed the real database (server/scripts/seed.ts).
 */
function makeRng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

const rng = makeRng(20260808)
const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)]!
const between = (min: number, max: number) => min + rng() * (max - min)
const intBetween = (min: number, max: number) => Math.round(between(min, max))

/** Today, fixed at module load, so relative dates stay consistent per session. */
const NOW = new Date()

const isoDate = (offsetDays: number): IsoDate => {
  const d = new Date(NOW)
  d.setDate(d.getDate() + offsetDays)
  // Local calendar day — the booking UI works in local dates, so seeding in UTC
  // would put "today's" sessions on the wrong day for most of the world.
  return toIsoDate(d)
}

const isoAt = (offsetDays: number, hour: number, minute = 0): string => {
  const d = new Date(NOW)
  d.setDate(d.getDate() + offsetDays)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

export const TENANTS: Tenant[] = [
  {
    id: id<'Tenant'>('t-ironworks'),
    name: 'Ironworks Performance',
    slug: 'ironworks',
    plan: 'growth',
    seats: 500,
    seatsUsed: 341,
    createdAt: '2024-03-11',
    primaryColor: '#b6ef21',
  },
  {
    id: id<'Tenant'>('t-northside'),
    name: 'Northside Athletic Club',
    slug: 'northside',
    plan: 'scale',
    seats: 2500,
    seatsUsed: 1897,
    createdAt: '2023-08-02',
  },
  {
    id: id<'Tenant'>('t-riverpt'),
    name: 'Riverbend Physio & Sport',
    slug: 'riverbend',
    plan: 'starter',
    seats: 100,
    seatsUsed: 63,
    createdAt: '2025-01-19',
  },
]

export const DEFAULT_TENANT = TENANTS[0]!

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

type SeedUser = Omit<UserProfile, 'id' | 'tenantId'> & { id: string }

const coachSeeds: SeedUser[] = [
  {
    id: 'u-coach-mara',
    role: Role.Coach,
    firstName: 'Mara',
    lastName: 'Whitfield',
    email: 'coach@kedemlife.app',
    phone: '+1 (845) 555-0142',
    title: 'Head Strength Coach',
    bio: 'Fifteen years turning post-injury athletes back into competitors. Obsessed with technique, unimpressed by ego lifting.',
    location: 'Pine Bush, NY',
    joinedAt: '2024-04-02',
    specialties: ['Strength', 'Return to sport', 'Powerlifting'],
    credentials: ['CSCS', 'USAW-L2', 'MS Exercise Science'],
    rating: 4.9,
    sessionsDelivered: 1284,
    status: 'active',
  },
  {
    id: 'u-coach-devon',
    role: Role.Coach,
    firstName: 'Devon',
    lastName: 'Achebe',
    email: 'devon@kedemlife.app',
    title: 'Performance Coach',
    bio: 'Speed, power and conditioning for field-sport athletes. Believes conditioning should be earned, not endured.',
    location: 'Newburgh, NY',
    joinedAt: '2024-09-15',
    specialties: ['Conditioning', 'Speed', 'Golf fitness'],
    credentials: ['CSCS', 'TPI Level 2'],
    rating: 4.8,
    sessionsDelivered: 742,
    status: 'active',
  },
  {
    id: 'u-coach-priya',
    role: Role.Coach,
    firstName: 'Priya',
    lastName: 'Raghunathan',
    email: 'priya@kedemlife.app',
    title: 'Registered Dietitian',
    bio: 'Nutrition without the misery. Builds plans around the food you already eat and the schedule you actually have.',
    location: 'Remote',
    joinedAt: '2024-06-21',
    specialties: ['Nutrition', 'Body composition', 'Gut health'],
    credentials: ['RD', 'CSSD'],
    rating: 5.0,
    sessionsDelivered: 963,
    status: 'active',
  },
  {
    id: 'u-coach-tomas',
    role: Role.Coach,
    firstName: 'Tomás',
    lastName: 'Delgado',
    email: 'tomas@kedemlife.app',
    title: 'Physiotherapist, DPT',
    bio: 'Movement screening and pain resolution. Finds the thing upstream that is actually causing your knee to complain.',
    location: 'Middletown, NY',
    joinedAt: '2023-11-08',
    specialties: ['Physiotherapy', 'Shoulder', 'Low back'],
    credentials: ['DPT', 'OCS', 'Dry needling cert.'],
    rating: 4.9,
    sessionsDelivered: 1571,
    status: 'active',
  },
  {
    id: 'u-coach-anke',
    role: Role.Coach,
    firstName: 'Anke',
    lastName: 'Sørensen',
    email: 'anke@kedemlife.app',
    title: 'Sports Physician, MD',
    bio: 'Bloodwork, hormones and the boring clinical detail that decides whether your training actually works.',
    location: 'Remote',
    joinedAt: '2025-02-14',
    specialties: ['Medical', 'Hormones', 'Bloodwork'],
    credentials: ['MD', 'Board cert. Sports Medicine'],
    rating: 4.7,
    sessionsDelivered: 388,
    status: 'active',
  },
  {
    id: 'u-coach-jae',
    role: Role.Coach,
    firstName: 'Jae',
    lastName: 'Lindqvist',
    email: 'jae@kedemlife.app',
    title: 'Mental Performance Coach',
    bio: 'Competition nerves, consistency and the gap between what you can do in training and what you do on the day.',
    location: 'Remote',
    joinedAt: '2025-05-30',
    specialties: ['Mindset', 'Habit change', 'Competition prep'],
    credentials: ['CMPC', 'MSc Sport Psychology'],
    rating: 4.8,
    sessionsDelivered: 265,
    status: 'active',
  },
]

const memberFirst = [
  'Cliff', 'Logan', 'Rebecca', 'Kirk', 'Amara', 'Sofia', 'Marcus', 'Nina',
  'Elliot', 'Grace', 'Dmitri', 'Yuki', 'Hassan', 'Chloe', 'Theo', 'Imani',
  'Ravi', 'Marta', 'Owen', 'Simone', 'Kai', 'Beatriz', 'Noor', 'Felix',
]
const memberLast = [
  'Grady', 'Millington', 'Vasquez', 'Whitmore', 'Okafor', 'Lindgren', 'Byrne',
  'Petrova', 'Nakamura', 'Osei', 'Halvorsen', 'Ferreira', 'Cutler', 'Ibrahim',
  'Rosales', 'Kowalski', 'Ahmadi', 'Bennett', 'Duarte', 'Sinclair',
]

const memberGoals = [
  'Drop 15 lb without losing strength',
  'Fix lower back pain and squat again',
  'Add 20 yards to my drive',
  'First powerlifting meet in March',
  'Build the habit of training 4x a week',
  'Get bloodwork back in range',
  'Return to running after ACL repair',
  'Gain 8 lb of lean mass',
]

const memberSeeds: SeedUser[] = Array.from({ length: 24 }, (_, i) => {
  const first = memberFirst[i % memberFirst.length]!
  const last = memberLast[i % memberLast.length]!
  return {
    id: `u-member-${i + 1}`,
    role: Role.Member,
    firstName: first,
    lastName: last,
    // The first member is the demo login everyone signs in with.
    email: i === 0 ? 'member@kedemlife.app' : `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    phone: `+1 (845) 555-0${(200 + i).toString().padStart(3, '0')}`,
    title: pick(memberGoals),
    bio: 'Member since joining the transformation programme.',
    location: pick(['Pine Bush, NY', 'Newburgh, NY', 'Middletown, NY', 'Remote']),
    joinedAt: isoDate(-intBetween(30, 700)),
    assignedCoachId: id<'User'>(pick(coachSeeds).id),
    status: 'active' as const,
  }
})

const staffSeeds: SeedUser[] = [
  {
    id: 'u-admin-1',
    role: Role.Admin,
    firstName: 'Rosalind',
    lastName: 'Park',
    email: 'admin@kedemlife.app',
    title: 'Studio Director',
    bio: 'Runs Ironworks Performance: billing, staffing and the things nobody else wants to own.',
    location: 'Pine Bush, NY',
    joinedAt: '2024-03-11',
    status: 'active',
  },
  {
    id: 'u-manager-1',
    role: Role.AppManager,
    firstName: 'Idris',
    lastName: 'Bello',
    email: 'manager@kedemlife.app',
    title: 'Platform Operations',
    bio: 'Looks after every studio on Kedem Life — provisioning, plan limits and platform health.',
    location: 'Remote',
    joinedAt: '2023-06-01',
    status: 'active',
  },
]

export const USERS: UserProfile[] = [...coachSeeds, ...memberSeeds, ...staffSeeds].map((seed) => ({
  ...seed,
  id: id<'User'>(seed.id),
  tenantId: DEFAULT_TENANT.id,
  assignedCoachId: seed.assignedCoachId ?? null,
  avatarUrl: null,
}))

export const findUserByEmail = (email: string) =>
  USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())

/** Every demo account uses this password. */
export const DEMO_PASSWORD = 'kedemlife'

export const DEMO_ACCOUNTS: readonly { role: Role; email: string; label: string }[] = [
  { role: Role.Member, email: 'member@kedemlife.app', label: 'Member' },
  { role: Role.Coach, email: 'coach@kedemlife.app', label: 'Coach' },
  { role: Role.Admin, email: 'admin@kedemlife.app', label: 'Admin' },
  { role: Role.AppManager, email: 'manager@kedemlife.app', label: 'App Manager' },
]

// ---------------------------------------------------------------------------
// Providers (the bookable view of a coach)
// ---------------------------------------------------------------------------

const disciplineByCoach: Record<string, Discipline> = {
  'u-coach-mara': Discipline.Coaching,
  'u-coach-devon': Discipline.Coaching,
  'u-coach-priya': Discipline.Nutrition,
  'u-coach-tomas': Discipline.Physiotherapy,
  'u-coach-anke': Discipline.Medical,
  'u-coach-jae': Discipline.MentalPerformance,
}

const rateByDiscipline: Record<Discipline, number> = {
  [Discipline.Coaching]: 9500,
  [Discipline.Nutrition]: 11000,
  [Discipline.Physiotherapy]: 13500,
  [Discipline.Medical]: 19500,
  [Discipline.MentalPerformance]: 12000,
}

export const PROVIDERS: Provider[] = coachSeeds.map((coach, index) => {
  const discipline = disciplineByCoach[coach.id] ?? Discipline.Coaching
  return {
    id: id<'User'>(coach.id),
    name: `${coach.firstName} ${coach.lastName}`,
    avatarUrl: null,
    discipline,
    title: coach.title ?? 'Coach',
    bio: coach.bio ?? '',
    credentials: coach.credentials ?? [],
    rating: coach.rating ?? 4.8,
    reviewCount: intBetween(40, 320),
    sessionRate: money(rateByDiscipline[discipline]),
    channels:
      discipline === Discipline.Medical
        ? [MeetingChannel.Zoom, MeetingChannel.Phone]
        : [MeetingChannel.Zoom, MeetingChannel.GoogleMeet, MeetingChannel.Phone, MeetingChannel.InPerson],
    nextAvailable: isoDate(index % 4),
    timezone: 'America/New_York',
  }
})

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

const demoMemberId = id<'User'>('u-member-1')

const channelJoinUrl = (channel: MeetingChannel, key: string) => {
  switch (channel) {
    case MeetingChannel.Zoom:
      return `https://zoom.us/j/9${key.replace(/\D/g, '').padEnd(9, '0').slice(0, 9)}`
    case MeetingChannel.GoogleMeet:
      return `https://meet.google.com/bf${key.slice(-3)}-demo-${key.slice(0, 3)}`
    case MeetingChannel.Phone:
      return 'tel:+18455550142'
    default:
      return undefined
  }
}

export const APPOINTMENTS: Appointment[] = (() => {
  const rows: Appointment[] = []
  const members = memberSeeds

  // Upcoming and past sessions spread over a realistic window.
  for (let i = 0; i < 46; i++) {
    const member = i < 6 ? members[0]! : pick(members)
    const provider = pick(PROVIDERS)
    const offsetDays = i < 6 ? [0, 1, 2, 5, -3, -11][i]! : intBetween(-90, 21)
    const hour = intBetween(7, 18)
    const channel = pick(provider.channels)
    const isPast = offsetDays < 0
    const key = `${i}${member.id}`

    rows.push({
      id: id<'Appointment'>(`a-${i + 1}`),
      memberId: id<'User'>(member.id),
      memberName: `${member.firstName} ${member.lastName}`,
      providerId: provider.id,
      providerName: provider.name,
      discipline: provider.discipline,
      channel,
      startsAt: isoAt(offsetDays, hour, pick([0, 30])),
      durationMinutes: pick([30, 45, 60]),
      status: isPast
        ? pick([
            AppointmentStatus.Completed,
            AppointmentStatus.Completed,
            AppointmentStatus.Completed,
            AppointmentStatus.Cancelled,
            AppointmentStatus.NoShow,
          ])
        : i % 5 === 0
          ? AppointmentStatus.Pending
          : AppointmentStatus.Confirmed,
      price: provider.sessionRate,
      joinUrl: channelJoinUrl(channel, key),
      memberGoal: member.title,
      notes: isPast ? pick(['Progressed to 3x5 back squat.', 'Reviewed food log; protein up.', 'Shoulder ROM improved.', '']) : undefined,
      createdAt: isoAt(offsetDays - intBetween(2, 14), 12),
    })
  }
  return rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
})()

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/** 26 weekly weigh-ins trending toward the member's goal, with noise. */
export const BODY_METRICS: BodyMetricEntry[] = (() => {
  const rows: BodyMetricEntry[] = []
  for (const member of memberSeeds) {
    const heightCm = intBetween(158, 192)
    let weightKg = between(62, 104)
    const weeklyTrend = between(-0.45, -0.05)
    let bodyFat = between(18, 33)

    for (let week = 25; week >= 0; week--) {
      weightKg += weeklyTrend + between(-0.35, 0.35)
      bodyFat = Math.max(8, bodyFat - between(0.02, 0.16))
      rows.push({
        id: id<'MetricEntry'>(`m-${member.id}-${week}`),
        memberId: id<'User'>(member.id),
        recordedOn: isoDate(-week * 7),
        weightKg: Math.round(weightKg * 10) / 10,
        heightCm: Math.round(heightCm),
        bodyFatPercent: Math.round(bodyFat * 10) / 10,
        restingHeartRate: intBetween(52, 74),
        waistCm: Math.round((weightKg * 0.92 + between(-4, 4)) * 10) / 10,
      })
    }
  }
  return rows
})()

export const ACTIVITY: ActivityEntry[] = (() => {
  const rows: ActivityEntry[] = []
  for (const member of memberSeeds) {
    for (let day = 89; day >= 0; day--) {
      const isRestDay = day % 7 === 0 || day % 7 === 4
      rows.push({
        memberId: id<'User'>(member.id),
        date: isoDate(-day),
        steps: isRestDay ? intBetween(3200, 7400) : intBetween(7200, 15400),
        activeMinutes: isRestDay ? intBetween(10, 35) : intBetween(45, 110),
        caloriesBurned: isRestDay ? intBetween(1900, 2250) : intBetween(2350, 3150),
        caloriesConsumed: intBetween(1750, 2850),
        proteinGrams: intBetween(95, 195),
        waterMl: intBetween(1400, 3600),
        sleepHours: Math.round(between(5.4, 8.6) * 10) / 10,
        workouts: isRestDay ? 0 : 1,
      })
    }
  }
  return rows
})()

export const GOALS: MemberGoal[] = memberSeeds.map((member) => {
  // Derive the target from the member's own latest weigh-in. A random target
  // produces nonsense on the chart — a "target" line sitting above someone who
  // is already losing weight reads as a bug, because it looks like one.
  const latest = BODY_METRICS.filter((m) => m.memberId === id<'User'>(member.id)).at(-1)
  const currentKg = latest?.weightKg ?? 80

  return {
    memberId: id<'User'>(member.id),
    targetWeightKg: Math.round(currentKg * between(0.9, 0.96)),
    dailyCalorieTarget: intBetween(1900, 2700),
    dailyProteinTarget: intBetween(120, 190),
    dailyStepTarget: pick([8000, 10000, 12000]),
    weeklyWorkoutTarget: pick([3, 4, 5]),
    focus: member.title ?? 'General health',
  }
})

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const PRODUCTS: Product[] = [
  {
    id: id<'Product'>('p-1'),
    slug: 'foundation-12-week',
    name: 'Foundation: 12-Week Transformation',
    tagline: 'The programme most members start with',
    description:
      'Twelve weeks of progressive strength work built around four sessions a week, with video technique reviews, a weekly check-in and a nutrition baseline you can actually keep to.',
    category: ProductCategory.Program,
    price: money(29900),
    compareAtPrice: money(39900),
    accent: '#b6ef21',
    rating: 4.9,
    reviewCount: 412,
    inStock: true,
    badge: 'Best seller',
    digital: true,
    instructorId: id<'User'>('u-coach-mara'),
  },
  {
    id: id<'Product'>('p-2'),
    slug: 'golf-power-block',
    name: 'Golf Power Block',
    tagline: 'Eight weeks to a longer, more repeatable swing',
    description:
      'Rotational power, hip mobility and anti-rotation strength, sequenced so you peak going into the season rather than in February.',
    category: ProductCategory.Program,
    price: money(21900),
    accent: '#4cc9f0',
    rating: 4.8,
    reviewCount: 156,
    inStock: true,
    digital: true,
    instructorId: id<'User'>('u-coach-devon'),
  },
  {
    id: id<'Product'>('p-3'),
    slug: 'pain-free-back',
    name: 'Pain-Free Back Protocol',
    tagline: 'Built by a DPT, not by an algorithm',
    description:
      'A six-week graded exposure plan for non-specific low back pain, with screening video, daily mobility and a return-to-lifting ramp.',
    category: ProductCategory.Program,
    price: money(17900),
    accent: '#ff6a3d',
    rating: 4.9,
    reviewCount: 288,
    inStock: true,
    badge: 'Clinician-led',
    digital: true,
    instructorId: id<'User'>('u-coach-tomas'),
  },
  {
    id: id<'Product'>('p-4'),
    slug: 'whey-isolate-2kg',
    name: 'Whey Isolate — 2kg',
    tagline: '27g protein, third-party tested',
    description:
      'Unflavoured or vanilla. Batch-tested for banned substances, which matters if you compete in anything tested.',
    category: ProductCategory.Supplement,
    price: money(6900),
    accent: '#e2ff8f',
    rating: 4.7,
    reviewCount: 934,
    inStock: true,
    digital: false,
  },
  {
    id: id<'Product'>('p-5'),
    slug: 'creatine-monohydrate',
    name: 'Creatine Monohydrate — 500g',
    tagline: 'The one supplement with the evidence behind it',
    description: 'Micronised, unflavoured, 5g per serving. No loading phase required.',
    category: ProductCategory.Supplement,
    price: money(3200),
    accent: '#34d399',
    rating: 4.9,
    reviewCount: 1521,
    inStock: true,
    digital: false,
  },
  {
    id: id<'Product'>('p-6'),
    slug: 'full-panel-bloodwork',
    name: 'Full Panel Bloodwork + Review',
    tagline: '48 markers, read back to you by a physician',
    description:
      'Metabolic, lipid, thyroid, iron and hormone panels drawn at a lab near you, followed by a 45-minute review call with Dr Sørensen.',
    category: ProductCategory.Testing,
    price: money(34900),
    accent: '#fbbf24',
    rating: 4.8,
    reviewCount: 203,
    inStock: true,
    badge: 'Includes consult',
    digital: false,
    instructorId: id<'User'>('u-coach-anke'),
  },
  {
    id: id<'Product'>('p-7'),
    slug: 'resistance-band-set',
    name: 'Resistance Band Set',
    tagline: 'Five bands, 5–80 lb, travel bag',
    description: 'Layered latex that does not snap in month three. Fits in carry-on.',
    category: ProductCategory.Equipment,
    price: money(4900),
    compareAtPrice: money(6500),
    accent: '#a78bfa',
    rating: 4.6,
    reviewCount: 617,
    inStock: true,
    digital: false,
  },
  {
    id: id<'Product'>('p-8'),
    slug: 'training-tee',
    name: 'Kedem Life Training Tee',
    tagline: 'Heavyweight cotton, cut for lifting',
    description: 'Does not cling, does not ride up on overhead work. Black or bone.',
    category: ProductCategory.Apparel,
    price: money(3800),
    accent: '#eaf1f7',
    rating: 4.5,
    reviewCount: 224,
    inStock: false,
    digital: false,
  },
  {
    id: id<'Product'>('p-9'),
    slug: 'membership-performance',
    name: 'Performance Membership',
    tagline: 'Unlimited coaching, monthly',
    description:
      'Two 1:1 sessions a month, unlimited messaging with your coach, full programme library and 15% off everything in the store.',
    category: ProductCategory.Membership,
    price: money(14900),
    accent: '#b6ef21',
    rating: 4.9,
    reviewCount: 388,
    inStock: true,
    badge: 'Most popular',
    digital: true,
  },
  {
    id: id<'Product'>('p-10'),
    slug: 'nutrition-reset',
    name: 'Nutrition Reset — 4 Weeks',
    tagline: 'Rebuild the basics without a food scale',
    description:
      'Four weeks of guided habit change with a dietitian: protein anchoring, plate construction and eating out without derailing.',
    category: ProductCategory.Program,
    price: money(15900),
    accent: '#f472b6',
    rating: 4.8,
    reviewCount: 341,
    inStock: true,
    digital: true,
    instructorId: id<'User'>('u-coach-priya'),
  },
  {
    id: id<'Product'>('p-11'),
    slug: 'gut-health-panel',
    name: 'Gut Health Panel',
    tagline: 'Stop guessing about bloating',
    description: 'At-home microbiome and inflammation markers with a dietitian-led interpretation call.',
    category: ProductCategory.Testing,
    price: money(24900),
    accent: '#22d3ee',
    rating: 4.6,
    reviewCount: 129,
    inStock: true,
    digital: false,
    instructorId: id<'User'>('u-coach-priya'),
  },
  {
    id: id<'Product'>('p-12'),
    slug: 'lifting-belt',
    name: '10mm Lever Lifting Belt',
    tagline: 'IPF-legal, broken in from day one',
    description: 'Single-ply leather, lever closure, sized for the waist you actually have.',
    category: ProductCategory.Equipment,
    price: money(11900),
    accent: '#f59e0b',
    rating: 4.9,
    reviewCount: 452,
    inStock: true,
    digital: false,
  },
]

// ---------------------------------------------------------------------------
// Orders & payments
// ---------------------------------------------------------------------------

export const ORDERS: Order[] = (() => {
  const rows: Order[] = []
  for (let i = 0; i < 38; i++) {
    const customer = i < 4 ? memberSeeds[0]! : pick(memberSeeds)
    const lineCount = intBetween(1, 3)
    const chosen = Array.from({ length: lineCount }, () => pick(PRODUCTS))
    const unique = [...new Map(chosen.map((p) => [p.id, p])).values()]

    const lines = unique.map((product) => ({
      productId: product.id,
      name: product.name,
      quantity: intBetween(1, 2),
      unitPrice: product.price,
      instructorId: product.instructorId,
    }))

    const subtotalMinor = lines.reduce((sum, l) => sum + l.unitPrice.amountMinor * l.quantity, 0)
    const allDigital = unique.every((p) => p.digital)
    const shippingMinor = allDigital || subtotalMinor >= 12_500 ? 0 : 795
    const taxMinor = Math.round(subtotalMinor * 0.0825)
    const daysAgo = intBetween(0, 120)

    rows.push({
      id: id<'Order'>(`o-${i + 1}`),
      reference: `BF-${(10_428 + i).toString()}`,
      customerId: id<'User'>(customer.id),
      customerName: `${customer.firstName} ${customer.lastName}`,
      customerEmail: customer.email,
      lines,
      subtotal: money(subtotalMinor),
      shipping: money(shippingMinor),
      tax: money(taxMinor),
      total: money(subtotalMinor + shippingMinor + taxMinor),
      status:
        daysAgo > 20
          ? pick([OrderStatus.Delivered, OrderStatus.Delivered, OrderStatus.Refunded])
          : pick([
              OrderStatus.Paid,
              OrderStatus.Processing,
              OrderStatus.Shipped,
              OrderStatus.AwaitingPayment,
            ]),
      placedAt: isoAt(-daysAgo, intBetween(8, 21)),
      trackingNumber: allDigital ? undefined : `1Z${intBetween(100000, 999999)}US`,
    })
  }
  return rows.sort((a, b) => b.placedAt.localeCompare(a.placedAt))
})()

export const PAYMENTS: Payment[] = ORDERS.filter(
  (o) => o.status !== OrderStatus.AwaitingPayment && o.status !== OrderStatus.Cancelled,
).map((order, i) => {
  const feeMinor = Math.round(order.total.amountMinor * 0.029) + 30
  const method = pick([
    PaymentMethod.Card,
    PaymentMethod.Card,
    PaymentMethod.ApplePay,
    PaymentMethod.GooglePay,
    PaymentMethod.BankTransfer,
  ])
  return {
    id: id<'Payment'>(`pay-${i + 1}`),
    reference: `ch_${(3_882_100 + i * 7).toString(36)}`,
    orderId: order.id,
    customerId: order.customerId,
    customerName: order.customerName,
    description: order.lines[0]?.name ?? 'Order',
    gross: order.total,
    fee: money(feeMinor),
    net: money(order.total.amountMinor - feeMinor),
    method,
    cardLast4: method === PaymentMethod.BankTransfer ? undefined : String(intBetween(1000, 9999)),
    cardBrand:
      method === PaymentMethod.BankTransfer ? undefined : pick(['Visa', 'Mastercard', 'Amex']),
    status:
      order.status === OrderStatus.Refunded
        ? PaymentStatus.Refunded
        : pick([
            PaymentStatus.Succeeded,
            PaymentStatus.Succeeded,
            PaymentStatus.Succeeded,
            PaymentStatus.Succeeded,
            PaymentStatus.Pending,
            PaymentStatus.Failed,
            PaymentStatus.Disputed,
          ]),
    processedAt: order.placedAt,
    payoutId: `po_${(9_120 + i).toString(36)}`,
  }
})

export const SUBSCRIPTIONS: Subscription[] = memberSeeds.slice(0, 16).map((member, i) => ({
  memberId: id<'User'>(member.id),
  memberName: `${member.firstName} ${member.lastName}`,
  planName: pick(['Performance', 'Performance', 'Essentials', 'Elite']),
  price: money(pick([7900, 14900, 29900])),
  interval: i % 6 === 0 ? ('year' as const) : ('month' as const),
  status: pick([
    'active' as const,
    'active' as const,
    'active' as const,
    'trialing' as const,
    'past_due' as const,
  ]),
  startedAt: isoAt(-intBetween(40, 600), 10),
  renewsAt: isoAt(intBetween(1, 30), 10),
}))

// ---------------------------------------------------------------------------
// Blog posts
// ---------------------------------------------------------------------------

type SeedPost = {
  id: string
  authorId: string
  slug: string
  title: string
  excerpt: string
  coverImageUrl?: string
  tags: string[]
  blocks: PostBlock[]
  /** Days ago the post went live; omit for a draft. */
  publishedDaysAgo?: number
}

const postSeeds: SeedPost[] = [
  {
    id: 'post-zone-2',
    authorId: 'u-coach-mara',
    slug: 'why-zone-2-is-the-base-of-everything',
    title: 'Why Zone 2 is the base of everything',
    excerpt:
      'Easy aerobic work feels too easy to matter. It is the single biggest lever most of our members have never pulled.',
    tags: ['Training', 'Conditioning'],
    publishedDaysAgo: 2,
    blocks: [
      {
        type: 'paragraph',
        text: 'Every intake screen we run tells the same story: people who can lift respectably, sprint when asked, and yet cannot hold a conversation on a twenty-minute jog. The engine is missing.',
      },
      { type: 'heading', text: 'What Zone 2 actually is' },
      {
        type: 'paragraph',
        text: 'Zone 2 is the highest intensity at which your body still clears lactate as fast as it makes it. Practically: you can talk in full sentences, your breathing is noticeable but controlled, and you could keep going for an hour without dreading it.',
      },
      {
        type: 'list',
        items: [
          'Heart rate roughly 60–70% of your maximum',
          'Nasal breathing is possible but not comfortable',
          'You finish feeling like you could have done more — that is the point',
        ],
      },
      { type: 'heading', text: 'Why it matters for strength athletes' },
      {
        type: 'paragraph',
        text: 'More mitochondria and better fat oxidation mean you recover faster between sets, between sessions and between training blocks. Our members who add two easy aerobic sessions a week report better sleep within a month.',
      },
      {
        type: 'quote',
        text: 'The goal is not to make the easy days hard. It is to make the hard days possible.',
        attribution: 'Mara Whitfield',
      },
      { type: 'heading', text: 'How to start this week' },
      {
        type: 'paragraph',
        text: 'Pick a modality you do not hate: incline walking, cycling, rowing, a hike. Two sessions of 30–45 minutes. Hold the talk test the whole way. If you are unsure of your zones, book a testing session and we will measure them properly.',
      },
      { type: 'video', url: 'https://www.youtube.com/watch?v=aUaInS6HIGo', caption: 'A short walkthrough of the talk test.' },
    ],
  },
  {
    id: 'post-protein',
    authorId: 'u-coach-priya',
    slug: 'protein-how-much-and-when',
    title: 'Protein: how much, and does timing matter?',
    excerpt:
      'The number most people need is higher than they think, and the timing question matters far less than the internet insists.',
    tags: ['Nutrition'],
    publishedDaysAgo: 6,
    blocks: [
      {
        type: 'paragraph',
        text: 'Of every nutrition question we field, protein is the one where the evidence is clearest and the habits are weakest. Here is the short version.',
      },
      { type: 'heading', text: 'The number' },
      {
        type: 'paragraph',
        text: 'For anyone training with intent, 1.6 to 2.2 grams per kilogram of body weight per day covers essentially everyone. If you are in a fat-loss phase, sit at the top of that range: protein is what protects the muscle you worked for.',
      },
      { type: 'heading', text: 'Timing' },
      {
        type: 'paragraph',
        text: 'Spread it across three or four meals with at least 25–40 grams each. The anabolic window is real but it is hours wide, not minutes. Finish the day on target and you have done the important part.',
      },
      {
        type: 'list',
        items: [
          'Breakfast is where most members fall short — aim for 30 g',
          'Whole food first; a shake is a tool, not a meal plan',
          'Older athletes need the higher end of the range',
        ],
      },
      {
        type: 'image',
        url: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1600&q=80',
        alt: 'A plate with grilled chicken, greens and grains',
        caption: 'A 40-gram plate does not have to look like a bodybuilding meal.',
      },
    ],
  },
  {
    id: 'post-knee',
    authorId: 'u-coach-tomas',
    slug: 'the-knee-pain-that-is-not-a-knee-problem',
    title: 'The knee pain that is not a knee problem',
    excerpt:
      'Most anterior knee pain we see in the studio is a hip and ankle story. Here is how we assess it and what we do first.',
    tags: ['Recovery', 'Physiotherapy'],
    publishedDaysAgo: 13,
    blocks: [
      {
        type: 'paragraph',
        text: 'The knee is a hinge caught between two joints that are supposed to move a lot. When the hip or the ankle stops doing its job, the knee pays.',
      },
      { type: 'heading', text: 'What we look at first' },
      {
        type: 'list',
        items: [
          'Ankle dorsiflexion — can the knee travel past the toes with the heel down?',
          'Hip control in a single-leg squat — does the knee dive inward?',
          'Training load over the last four weeks — did anything spike?',
        ],
      },
      { type: 'heading', text: 'The first two weeks' },
      {
        type: 'paragraph',
        text: 'We rarely stop people training. We change the angle, slow the tempo and add isometrics: a Spanish squat hold, split squats with a heel raise, and a lot of calf work. Pain that drops from a 6 to a 3 in a fortnight tells us we are on the right track.',
      },
      {
        type: 'quote',
        text: 'Rest is a diagnosis of nothing. Load is how tissue learns.',
        attribution: 'Tomás Reyes, DPT',
      },
    ],
  },
  {
    id: 'post-sleep',
    authorId: 'u-coach-jae',
    slug: 'sleep-is-a-training-variable',
    title: 'Sleep is a training variable',
    excerpt:
      'We programme sets, reps and rest. Almost nobody programmes the eight hours that decide whether any of it lands.',
    tags: ['Recovery', 'Mindset'],
    publishedDaysAgo: 21,
    blocks: [
      {
        type: 'paragraph',
        text: 'If I could change one habit in every athlete I work with, it would not be their warm-up or their phone use. It would be a fixed wake time.',
      },
      { type: 'heading', text: 'Anchor the morning, not the night' },
      {
        type: 'paragraph',
        text: 'Bedtime drifts; wake time can be held. Pick one you can keep seven days a week and let the evening take care of itself. Within two weeks most people feel sleepy at a consistent hour without trying.',
      },
      { type: 'heading', text: 'Three rules that survive real life' },
      {
        type: 'list',
        items: [
          'Daylight in the first hour, even through a window',
          'Caffeine ends eight hours before bed',
          'The bedroom is for sleep — training plans and emails live elsewhere',
        ],
      },
    ],
  },
  {
    id: 'post-open-day',
    authorId: 'u-admin-1',
    slug: 'ironworks-spring-open-day',
    title: 'Ironworks spring open day: bring a friend',
    excerpt:
      'One Saturday, every coach on the floor, free movement screens and a look at the new recovery suite. Members bring one guest.',
    coverImageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1600&q=80',
    tags: ['Studio news'],
    publishedDaysAgo: 30,
    blocks: [
      {
        type: 'paragraph',
        text: 'The recovery suite is finished, the new rig is in, and we want to show it off. Doors open at nine and the coaches will run screens all morning.',
      },
      { type: 'heading', text: 'What is on' },
      {
        type: 'list',
        items: [
          '09:00 – Doors, coffee and a tour of the new floor',
          '10:00 – Free 15-minute movement screens (book at the desk)',
          '12:00 – Panel: what testing tells you that a scale cannot',
          '13:30 – Recovery suite demos: cold, heat and compression',
        ],
      },
      {
        type: 'paragraph',
        text: 'Members may bring one guest. Guests who join on the day get their first month at the member rate.',
      },
    ],
  },
  {
    id: 'post-golf-draft',
    authorId: 'u-coach-devon',
    slug: 'rotational-power-for-golfers',
    title: 'Rotational power for golfers: the three lifts that transfer',
    excerpt: 'Not every exercise in the gym shows up on the course. These three do, and here is the progression we use.',
    tags: ['Training', 'Golf'],
    blocks: [
      {
        type: 'paragraph',
        text: 'Draft — collecting the video clips from the last testing block before this goes live.',
      },
      { type: 'heading', text: 'Medicine ball rotational throws' },
      { type: 'paragraph', text: 'TODO: progression and sets.' },
    ],
  },
]

export const POSTS: Post[] = postSeeds.map((seed) => {
  const author = USERS.find((u) => u.id === seed.authorId)!
  const publishedAt = seed.publishedDaysAgo === undefined ? null : isoAt(-seed.publishedDaysAgo, 9, 30)
  const createdAt = isoAt(-(seed.publishedDaysAgo ?? 0) - 1, 16, 15)
  return {
    id: id<'Post'>(seed.id),
    tenantId: DEFAULT_TENANT.id,
    tenantName: DEFAULT_TENANT.name,
    tenantSlug: DEFAULT_TENANT.slug,
    slug: seed.slug,
    title: seed.title,
    excerpt: seed.excerpt,
    coverImageUrl: seed.coverImageUrl ?? null,
    tags: seed.tags,
    blocks: seed.blocks,
    authorId: author.id,
    authorName: `${author.firstName} ${author.lastName}`,
    authorRole: author.role,
    authorTitle: author.title,
    authorAvatarUrl: author.avatarUrl ?? null,
    status: publishedAt ? PostStatus.Published : PostStatus.Draft,
    publishedAt,
    createdAt,
    updatedAt: publishedAt ?? createdAt,
    readingMinutes: readingMinutes(seed.blocks),
  }
})

export const DEMO_MEMBER_ID: UserId = demoMemberId
export const DEMO_TENANT_ID: TenantId = DEFAULT_TENANT.id

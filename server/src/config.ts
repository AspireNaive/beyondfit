import 'dotenv/config'
import { z } from 'zod'

/**
 * All configuration comes from the environment and is validated once at boot,
 * so a missing secret fails loudly at start-up instead of on the first request.
 */
const bool = z.enum(['true', 'false']).transform((v) => v === 'true')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  /** Interface to bind; unset = every interface (what Passenger/pm2 expect). */
  HOST: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /** Firebase project the API talks to (also the emulator's project id). */
  FIREBASE_PROJECT_ID: z.string().default('beyondfit-cc69a'),
  /** Service-account JSON, base64-encoded, for hosts outside Google Cloud (GoDaddy). */
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
  /** Alternative: a path to the service-account JSON file. */
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  /** Set (e.g. 127.0.0.1:8085) to use the local Firestore emulator instead of the real database. */
  FIRESTORE_EMULATOR_HOST: z.string().optional(),
  FIRESTORE_DATABASE_ID: z.string().default('(default)'),
  /** Use HTTPS/REST instead of gRPC for Firestore — for hosts that only allow plain HTTP(S) egress (GoDaddy). */
  FIRESTORE_PREFER_REST: bool.default('false'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_HOURS: z.coerce.number().positive().default(12),
  REMEMBER_ME_TTL_DAYS: z.coerce.number().positive().default(30),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().positive().default(30),

  CORS_ORIGINS: z.string().default(''),
  SERVE_STATIC: bool.default('false'),
  STATIC_DIR: z.string().default('../dist'),
  APP_URL: z.string().url().default('http://localhost:5173'),
  TRUST_PROXY: z.string().default('0'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  PAYMENT_PROVIDER: z.enum(['manual']).default('manual'),

  /** Claude, for reading calories off food photos. Unset = photo analysis off, manual logging still works. */
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-opus-5'),

  BOOTSTRAP_TENANT_NAME: z.string().default('Kedem Life'),
  BOOTSTRAP_TENANT_SLUG: z.string().default('kedem'),
  BOOTSTRAP_ADMIN_EMAIL: z.string().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().optional(),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
  throw new Error(`Invalid environment:\n${issues}`)
}

const env = parsed.data

type ServiceAccount = { projectId: string; clientEmail: string; privateKey: string }

/** Decodes FIREBASE_SERVICE_ACCOUNT (base64 of the JSON key) into cert() input. */
function serviceAccount(): ServiceAccount | null {
  if (!env.FIREBASE_SERVICE_ACCOUNT) return null
  const raw = env.FIREBASE_SERVICE_ACCOUNT.trim()
  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
  const parsed = JSON.parse(json) as { project_id?: string; client_email?: string; private_key?: string }
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not a service-account key (project_id, client_email, private_key)')
  }
  return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key }
}

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  host: env.HOST,
  logLevel: env.LOG_LEVEL,
  firebase: {
    projectId: env.FIREBASE_PROJECT_ID,
    databaseId: env.FIRESTORE_DATABASE_ID,
    emulatorHost: env.FIRESTORE_EMULATOR_HOST,
    preferRest: env.FIRESTORE_PREFER_REST,
    serviceAccount: serviceAccount(),
  },
  auth: {
    jwtSecret: env.JWT_SECRET,
    accessTtlSeconds: Math.round(env.ACCESS_TOKEN_TTL_HOURS * 3600),
    rememberMeTtlSeconds: Math.round(env.REMEMBER_ME_TTL_DAYS * 86_400),
    refreshTtlSeconds: Math.round(env.REFRESH_TOKEN_TTL_DAYS * 86_400),
  },
  corsOrigins: env.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  serveStatic: env.SERVE_STATIC,
  staticDir: env.STATIC_DIR,
  appUrl: env.APP_URL.replace(/\/$/, ''),
  trustProxy: env.TRUST_PROXY === '0' ? false : /^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY,
  smtp: env.SMTP_HOST
    ? {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT ?? 465,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
        from: env.SMTP_FROM ?? env.SMTP_USER ?? 'noreply@localhost',
      }
    : null,
  paymentProvider: env.PAYMENT_PROVIDER,
  ai: {
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.ANTHROPIC_MODEL,
    /** Photo analysis is available only when a key is configured. */
    enabled: Boolean(env.ANTHROPIC_API_KEY),
  },
  bootstrap: {
    tenantName: env.BOOTSTRAP_TENANT_NAME,
    tenantSlug: env.BOOTSTRAP_TENANT_SLUG,
    adminEmail: env.BOOTSTRAP_ADMIN_EMAIL,
    adminPassword: env.BOOTSTRAP_ADMIN_PASSWORD,
  },
} as const

export type Config = typeof config

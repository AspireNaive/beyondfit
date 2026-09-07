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

  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('kedem_life'),
  DB_SSL: bool.default('false'),
  DB_POOL_SIZE: z.coerce.number().int().positive().default(5),

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

/** DATABASE_URL wins over the individual DB_* parts when both are present. */
function databaseParts() {
  if (!env.DATABASE_URL) {
    return {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    }
  }
  const url = new URL(env.DATABASE_URL)
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
  }
}

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  host: env.HOST,
  logLevel: env.LOG_LEVEL,
  db: { ...databaseParts(), ssl: env.DB_SSL, poolSize: env.DB_POOL_SIZE },
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
  bootstrap: {
    tenantName: env.BOOTSTRAP_TENANT_NAME,
    tenantSlug: env.BOOTSTRAP_TENANT_SLUG,
    adminEmail: env.BOOTSTRAP_ADMIN_EMAIL,
    adminPassword: env.BOOTSTRAP_ADMIN_PASSWORD,
  },
} as const

export type Config = typeof config

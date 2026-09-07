import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2/promise'
import { config } from '../config.js'

/**
 * One pool per process. Sized small on purpose: GoDaddy shared MySQL caps
 * connections per user, and a Node API needs far fewer than people expect.
 */
export const pool: Pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.poolSize,
  maxIdle: config.db.poolSize,
  idleTimeout: 60_000,
  enableKeepAlive: true,
  // Every DATETIME is stored and read as UTC; DATE columns come back as
  // 'YYYY-MM-DD' strings so a calendar day never shifts with the server tz.
  timezone: 'Z',
  dateStrings: ['DATE'],
  decimalNumbers: true,
  charset: 'utf8mb4_unicode_ci',
  ...(config.db.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
})

export type Db = Pool | PoolConnection

export async function query<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params: readonly unknown[] = [],
  db: Db = pool,
): Promise<T[]> {
  const [rows] = await db.query<T[]>(sql, params as unknown[])
  return rows
}

export async function queryOne<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params: readonly unknown[] = [],
  db: Db = pool,
): Promise<T | null> {
  const rows = await query<T>(sql, params, db)
  return rows[0] ?? null
}

export async function execute(
  sql: string,
  params: readonly unknown[] = [],
  db: Db = pool,
): Promise<ResultSetHeader> {
  const [result] = await db.execute<ResultSetHeader>(sql, params as unknown as (string | number | Date | Buffer | null)[])
  return result
}

/** Runs `fn` inside a transaction; commits on success, rolls back on throw. */
export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (error) {
    await conn.rollback().catch(() => undefined)
    throw error
  } finally {
    conn.release()
  }
}

export const closePool = () => pool.end()

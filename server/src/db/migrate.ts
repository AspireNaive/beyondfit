import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { config } from '../config.js'
import { logger } from '../lib/logger.js'

/**
 * Forward-only SQL migrations. Each file in ../../migrations runs once, in
 * name order, inside its own connection with multi-statement support; the
 * name is recorded in schema_migrations so re-running is a no-op.
 *
 * Usage: npm run db:migrate   (reads the same env as the server)
 */
const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations/', import.meta.url))

export async function migrate(): Promise<string[]> {
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
    ...(config.db.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
  })
  try {
    await conn.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name VARCHAR(160) NOT NULL PRIMARY KEY,
         applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    )
    const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT name FROM schema_migrations')
    const applied = new Set(rows.map((r) => r.name as string))
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort()
    const ran: string[] = []
    for (const file of files) {
      if (applied.has(file)) continue
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8')
      await conn.query(sql)
      await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file])
      ran.push(file)
      logger.info({ file }, 'migration applied')
    }
    return ran
  } finally {
    await conn.end()
  }
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isDirectRun) {
  migrate()
    .then((ran) => {
      console.log(ran.length ? `Applied: ${ran.join(', ')}` : 'Database is up to date.')
      process.exit(0)
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

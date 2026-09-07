/** Once per run: migrate + reseed the test database from the demo fixtures. */
export default async function globalSetup() {
  process.env.NODE_ENV = 'test'
  process.env.DB_NAME = process.env.TEST_DB_NAME ?? 'kedem_life_test'
  process.env.DB_PORT = process.env.DB_PORT ?? '3307'
  process.env.LOG_LEVEL = 'silent'
  process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret-test-secret'
  const { seed } = await import('../scripts/seed.js')
  const { closePool } = await import('../src/db/pool.js')
  await seed({ reset: true })
  await closePool()
}

/** Once per run: empty the emulator and reseed it from the demo fixtures. */
export default async function globalSetup() {
  process.env.NODE_ENV = 'test'
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8085'
  process.env.FIREBASE_PROJECT_ID = 'demo-kedem'
  process.env.LOG_LEVEL = 'silent'
  process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret-test-secret'
  const { seed } = await import('../scripts/seed.js')
  await seed({ reset: true })
}

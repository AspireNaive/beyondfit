/** Runs before each test file: points the config at the test database. */
process.env.NODE_ENV = 'test'
process.env.DB_NAME = process.env.TEST_DB_NAME ?? 'kedem_life_test'
process.env.DB_PORT = process.env.DB_PORT ?? '3307'
process.env.LOG_LEVEL = 'silent'
process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret-test-secret'
process.env.CORS_ORIGINS = ''

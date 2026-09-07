/** Runs before each test file: point the config at the Firestore emulator. */
process.env.NODE_ENV = 'test'
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8085'
process.env.FIREBASE_PROJECT_ID = 'demo-kedem'
process.env.LOG_LEVEL = 'silent'
process.env.JWT_SECRET ??= 'test-secret-test-secret-test-secret-test-secret'
process.env.CORS_ORIGINS = ''

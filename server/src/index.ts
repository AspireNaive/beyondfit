import { createApp } from './app.js'
import { config } from './config.js'
import { ping } from './db/firestore.js'
import { logger } from './lib/logger.js'

/**
 * Process entry. Works unchanged under cPanel's Node.js selector (Passenger
 * supplies PORT), pm2 on a VPS, or `node dist/index.js` anywhere.
 */
async function main() {
  try {
    await ping()
  } catch (error) {
    const hint = config.firebase.emulatorHost
      ? `Firestore emulator not reachable at ${config.firebase.emulatorHost}. Start it first: \`npm run emulators\` (needs JDK 21+ on PATH), or remove FIRESTORE_EMULATOR_HOST from .env to use the real database.`
      : `Firestore project ${config.firebase.projectId} not reachable. Check FIREBASE_SERVICE_ACCOUNT / GOOGLE_APPLICATION_CREDENTIALS and network access.`
    logger.fatal({ err: config.isProduction ? error : (error as Error).message }, hint)
    process.exit(1)
  }
  logger.info(
    { project: config.firebase.projectId, emulator: config.firebase.emulatorHost ?? null },
    'firestore reachable',
  )

  const app = createApp()
  const onListening = () =>
    logger.info({ port: config.port, host: config.host ?? '*', env: config.env, static: config.serveStatic }, 'kedem-life-api listening')
  const server = config.host ? app.listen(config.port, config.host, onListening) : app.listen(config.port, onListening)

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down')
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 10_000).unref()
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandled rejection'))
}

main().catch((error) => {
  logger.fatal({ err: error }, 'failed to start')
  process.exit(1)
})

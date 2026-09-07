/**
 * Vercel serverless entry: the same Express app the GoDaddy Node process
 * runs, mounted at /api by the rewrite in vercel.json. Firestore credentials
 * come from FIREBASE_SERVICE_ACCOUNT in the project's environment variables.
 */
import { createApp } from '../server/src/app.js'

export default createApp()

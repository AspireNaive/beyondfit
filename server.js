/**
 * Process entry for GoDaddy Node.js Hosting — and any host that runs the app
 * as a single long-lived Node process (`npm run build`, then `npm start`).
 *
 * One process serves both halves from the same origin: the Vite build in
 * ./dist as static files, and the Express API under /api. The front end calls
 * /api relatively, so there is no CORS and no host-specific front-end config.
 *
 * Vercel does not use this file; it mounts the same Express app as a
 * serverless function from api/index.ts.
 *
 * The platform supplies PORT. Everything else — FIREBASE_SERVICE_ACCOUNT,
 * JWT_SECRET, APP_URL — comes from the environment variables set in the hosting
 * dashboard (see server/README.md). The defaults below only fill in what a
 * single-process host behind a proxy always needs; an explicit variable wins.
 */
process.env.NODE_ENV ??= 'production'
// Serve ../dist (relative to server/) from this process.
process.env.SERVE_STATIC ??= 'true'
// Behind the platform's CDN/proxy: read the client IP from X-Forwarded-For.
process.env.TRUST_PROXY ??= '1'
// Only outbound HTTP/HTTPS is allowed on the platform; REST is plain HTTPS,
// while gRPC needs HTTP/2 end-to-end. Set FIRESTORE_PREFER_REST=false to opt out.
process.env.FIRESTORE_PREFER_REST ??= 'true'

await import('./server/dist/index.js')

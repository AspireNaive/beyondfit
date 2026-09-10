import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express, { Router, type Express } from 'express'
import expressStaticGzip from 'express-static-gzip'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import { authenticate } from './auth/middleware.js'
import { authRouter } from './auth/routes.js'
import { config } from './config.js'
import { errorHandler } from './lib/errors.js'
import { logger } from './lib/logger.js'
import { appointmentsRouter } from './modules/appointments/routes.js'
import { productsRouter } from './modules/catalog/routes.js'
import { postsRouter } from './modules/content/routes.js'
import { directoryRouter } from './modules/directory/routes.js'
import { contactRouter, newsletterRouter } from './modules/marketing/routes.js'
import { ordersRouter, paymentsRouter, subscriptionsRouter } from './modules/orders/routes.js'
import { membersRouter } from './modules/progress/routes.js'
import { providersRouter } from './modules/providers/routes.js'
import { tenantRouter, tenantsRouter } from './modules/tenants/routes.js'
import { openApiDocument } from './openapi.js'

/**
 * Same CSP the static hosts use (vercel.json / firebase.json), applied when
 * this process serves the built front end itself.
 */
const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com'],
  // Blog authors link images and videos from wherever they host them.
  imgSrc: ["'self'", 'data:', 'https:'],
  mediaSrc: ["'self'", 'https:'],
  frameSrc: ['https://www.youtube-nocookie.com', 'https://player.vimeo.com'],
  connectSrc: ["'self'"],
  frameAncestors: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  objectSrc: ["'none'"],
}

export function createApp(): Express {
  const app = express()
  app.set('trust proxy', config.trustProxy)
  app.disable('x-powered-by')

  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    }),
  )
  app.use(
    helmet({
      contentSecurityPolicy: config.serveStatic ? { directives: CSP_DIRECTIVES } : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  )
  if (config.corsOrigins.length > 0) {
    app.use(
      cors({
        origin: config.corsOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['RateLimit', 'RateLimit-Policy', 'Retry-After'],
        maxAge: 86_400,
      }),
    )
  }
  app.use(express.json({ limit: '256kb' }))

  // ---- /api ---------------------------------------------------------------
  const api = Router()
  api.get('/health', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ status: 'ok', uptime: Math.round(process.uptime()) })
  })
  api.get('/openapi.json', (_req, res) => res.json(openApiDocument))
  api.get('/docs', (_req, res) => {
    res.type('html').send(DOCS_HTML)
  })

  api.use(authenticate)
  api.use('/auth', authRouter)
  api.use('/directory', directoryRouter)
  api.use('/providers', providersRouter)
  api.use('/appointments', appointmentsRouter)
  api.use('/members', membersRouter)
  api.use('/products', productsRouter)
  api.use('/posts', postsRouter)
  api.use('/orders', ordersRouter)
  api.use('/payments', paymentsRouter)
  api.use('/subscriptions', subscriptionsRouter)
  api.use('/tenant', tenantRouter)
  api.use('/tenants', tenantsRouter)
  api.use('/contact', contactRouter)
  api.use('/newsletter', newsletterRouter)
  api.use((req, res) => {
    res
      .status(404)
      .type('application/problem+json')
      .json({ type: 'about:blank', title: 'Not Found', status: 404, detail: `No route for ${req.method} ${req.path}` })
  })
  app.use('/api', api)

  // ---- Optional: serve the Vite build from this process --------------------
  if (config.serveStatic) mountStatic(app)

  app.use(errorHandler)
  return app
}

function mountStatic(app: Express) {
  const dir = resolve(fileURLToPath(new URL('..', import.meta.url)), config.staticDir)
  const index = join(dir, 'index.html')
  if (!existsSync(index)) {
    logger.warn({ dir }, 'SERVE_STATIC is on but no build was found; run `npm run build` in the web root')
    return
  }
  app.use(
    expressStaticGzip(dir, {
      enableBrotli: true,
      orderPreference: ['br', 'gz'],
      index: false,
      serveStatic: {
        setHeaders: (res, path) => {
          if (path.includes(`${dir}/assets/`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          else if (path.includes(`${dir}/media/`)) res.setHeader('Cache-Control', 'public, max-age=604800')
          else res.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate')
        },
      },
    }),
  )
  // Every other GET is a client-side route; a path with an extension is a real 404.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    if (/\.[a-z0-9]+$/i.test(req.path)) return next()
    res.set('Cache-Control', 'no-cache, max-age=0, must-revalidate').sendFile(index)
  })
}

const DOCS_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Kedem Life API</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"></head>
<body><div id="swagger"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>window.onload=()=>SwaggerUIBundle({url:'/api/openapi.json',dom_id:'#swagger',persistAuthorization:true})</script>
</body></html>`

import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Static file server for Azure App Service.
 *
 * Zero dependencies on purpose: the deployment artifact is `dist/` plus this
 * file, so App Service installs nothing and cold starts are as fast as Node
 * can boot. Everything below mirrors the hosting rules the app was already
 * verified against — SPA fallback, the split cache policy, and the CSP.
 *
 * The one real difference from a CDN host: App Service does **not** compress
 * responses for a custom Node server, so this serves the `.br` / `.gz` files
 * the build emits via content negotiation. On Firebase those were dead weight;
 * here they are the entire compression story.
 */

const ROOT = resolve(fileURLToPath(new URL('./dist', import.meta.url)))
const PORT = Number(process.env.PORT) || 8080

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

const CSP =
  "default-src 'self'; " +
  "script-src 'self'; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; " +
  "img-src 'self' data:; " +
  "media-src 'self'; " +
  "connect-src 'self'; " +
  "frame-ancestors 'none'; " +
  "base-uri 'self'; " +
  "form-action 'self'; " +
  "object-src 'none'"

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), interest-cohort=()',
  'Content-Security-Policy': CSP,
}

/**
 * Content-hashed filenames under /assets can be cached forever. Everything
 * else — above all index.html and every SPA-rewritten route — must revalidate,
 * or a deploy takes hours to reach anyone.
 */
function cacheControlFor(urlPath) {
  if (urlPath.startsWith('/assets/')) return 'public, max-age=31536000, immutable'
  if (urlPath.startsWith('/media/') || urlPath === '/favicon.svg') return 'public, max-age=604800'
  return 'no-cache, max-age=0, must-revalidate'
}

/** Resolve a URL path to a file inside ROOT, or null if it escapes. */
function safeResolve(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0].split('#')[0])
  const candidate = resolve(join(ROOT, normalize(decoded)))
  // normalize() collapses `..`; this check is what actually stops traversal.
  if (candidate !== ROOT && !candidate.startsWith(ROOT + sep)) return null
  return candidate
}

const isFile = (p) => {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

/** Pick the best pre-compressed variant the client will accept. */
function negotiate(filePath, acceptEncoding = '') {
  if (/\bbr\b/.test(acceptEncoding) && isFile(`${filePath}.br`)) {
    return { path: `${filePath}.br`, encoding: 'br' }
  }
  if (/\bgzip\b/.test(acceptEncoding) && isFile(`${filePath}.gz`)) {
    return { path: `${filePath}.gz`, encoding: 'gzip' }
  }
  return { path: filePath, encoding: null }
}

function send(res, status, filePath, urlPath, acceptEncoding, method) {
  const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
  const chosen = negotiate(filePath, acceptEncoding)
  const stats = statSync(chosen.path)

  const headers = {
    ...SECURITY_HEADERS,
    'Content-Type': type,
    'Content-Length': stats.size,
    'Cache-Control': cacheControlFor(urlPath),
    // Compressed and identity bytes differ per Accept-Encoding — caches must
    // key on it or a br body gets served to a client that cannot read it.
    Vary: 'Accept-Encoding',
    ETag: `W/"${stats.size}-${stats.mtimeMs.toString(36)}"`,
  }
  if (chosen.encoding) headers['Content-Encoding'] = chosen.encoding

  res.writeHead(status, headers)

  if (method === 'HEAD') {
    res.end()
    return
  }
  createReadStream(chosen.path).pipe(res)
}

const INDEX = join(ROOT, 'index.html')

const server = createServer((req, res) => {
  const method = req.method ?? 'GET'
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD', ...SECURITY_HEADERS }).end('Method Not Allowed')
    return
  }

  const urlPath = (req.url ?? '/').split('?')[0]

  // Health probe for App Service — cheap, and never falls through to the SPA.
  if (urlPath === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify({ status: 'ok', uptime: Math.round(process.uptime()) }))
    return
  }

  const accept = req.headers['accept-encoding']?.toString() ?? ''
  const resolved = safeResolve(urlPath)

  if (!resolved) {
    res.writeHead(400, SECURITY_HEADERS).end('Bad Request')
    return
  }

  if (isFile(resolved)) {
    send(res, 200, resolved, urlPath, accept, method)
    return
  }

  // A request that looks like a file but is not one is a genuine 404. Falling
  // back to index.html there would answer a missing script with HTML and turn
  // a build mistake into a baffling console error.
  if (extname(urlPath)) {
    res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Not Found')
    return
  }

  // Everything else is a client-side route.
  send(res, 200, INDEX, '/', accept, method)
})

if (!existsSync(INDEX)) {
  console.error(`[beyondfit] No build found at ${ROOT}. Run \`npm run build\` first.`)
  process.exit(1)
}

server.listen(PORT, () => {
  console.log(`[beyondfit] serving ${ROOT} on :${PORT}`)
})

// App Service sends SIGTERM on restart/scale-in; close cleanly so in-flight
// responses are not cut off mid-stream.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`[beyondfit] ${signal} received, closing`)
    server.close(() => process.exit(0))
  })
}

# Kedem Life API

Node.js (Express 5) + MySQL/MariaDB backend for the Kedem Life web app. It
implements every port the front end calls (`src/domain/ports.ts` → HTTP adapter
`src/infrastructure/http/container.ts`), so the web app switches from demo data
to real data with one setting: `VITE_API_MODE=http`.

- Endpoint summary: [`../docs/API.md`](../docs/API.md)
- OpenAPI: `openapi.json` (served live at `/api/openapi.json`, browsable at `/api/docs`)
- Postman: `../postman/kedem-life-api.postman_collection.json`

## Layout

```
server/
  migrations/        forward-only SQL, applied in name order (npm run db:migrate)
  scripts/seed.ts    demo data — the same fixtures the mock adapter used
  scripts/bootstrap.ts  production: one tenant + one admin from env, nothing else
  src/
    index.ts         process entry (PORT from env; works under Passenger / pm2 / node)
    app.ts           middleware + route mounting; optional static serving of ../dist
    config.ts        env → typed config, validated at boot
    domain.ts        enums and response shapes (mirror of the front end's domain)
    auth/            password hashing, JWT + refresh tokens, guards, /auth routes
    modules/<name>/  repository.ts (SQL) · service.ts (rules) · routes.ts (HTTP + zod)
    db/              mysql2 pool, transactions, migration runner
    lib/             problem+json errors, typed route helper, logger, mailer
  test/              vitest + supertest integration tests against a real database
```

Conventions: SQL lives only in `repository.ts`; business rules and authorization
only in `service.ts`; routes validate with zod and stay thin. Money is minor
units + currency. Every `DATETIME` is UTC; `DATE` columns are calendar days.
Errors are RFC 7807 `application/problem+json` (`detail` is user-facing,
`code` is machine-readable, `errors` maps to form fields).

## Run locally

Requirements: Node 20 (`nvm use` in the repo root), a MySQL 8 / MariaDB 10.6+ server.

```bash
cd server
cp .env.example .env            # set DB_* and a real JWT_SECRET
npm install
npm run db:seed -- --reset      # migrations + demo data (password for every demo user: kedemlife)
npm run dev                     # http://127.0.0.1:4000/api/health
```

Then in the repo root `npm run dev` — Vite proxies `/api` to the API, so the
browser stays same-origin. Sign in with `member@kedemlife.app` / `kedemlife`
(or coach@, admin@, manager@).

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | tsx watch mode |
| `npm run build` / `npm start` | compile to `dist/` and run it |
| `npm run db:migrate` | apply pending migrations |
| `npm run db:seed [-- --reset]` | demo data (`--reset` empties every table first) |
| `npm run db:bootstrap` | production: create the default tenant + an `app_manager` from `BOOTSTRAP_*` |
| `npm test` | integration suite (needs `kedem_life_test` on the same server; override with `TEST_DB_NAME`) |

## Configuration

See `.env.example`; everything is validated in `src/config.ts`. The ones that matter in production:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` or `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` | GoDaddy shows these under cPanel → MySQL Databases |
| `JWT_SECRET` | ≥ 32 random chars; rotating it signs everyone out |
| `CORS_ORIGINS` | only when the site is on another origin (e.g. `https://beyondfit.vercel.app`) |
| `SERVE_STATIC=true` | this process also serves the Vite build from `../dist` (same-origin, no CORS) |
| `APP_URL` | where password-reset links point |
| `TRUST_PROXY=1` | behind Passenger/Nginx/Apache so rate limits see real client IPs |
| `SMTP_*` | GoDaddy relay `smtpout.secureserver.net:465`; without SMTP, reset links are logged instead |
| `PAYMENT_PROVIDER=manual` | records payments as taken; see "What is stubbed" |

## Deploying on GoDaddy

The database is always GoDaddy's MySQL. Where the API process runs depends on the plan:

**A. cPanel hosting with the Node.js selector (Web Hosting Plus / Deluxe+ on Linux)**
1. Build locally: `cd server && npm run build`, and `npm run build` in the repo root for the site.
2. Upload `server/` (without `node_modules`) and `dist/` to e.g. `~/kedem-api` and `~/kedem-api/dist`.
3. cPanel → *Setup Node.js App* → Node 20, application root `kedem-api`, startup file `dist/index.js`, mode production. Add the env vars from the table above (`SERVE_STATIC=true`, `STATIC_DIR=../dist`, `TRUST_PROXY=1`, no `CORS_ORIGINS`).
4. *Run NPM Install*, then in the app's terminal: `npm run db:migrate` and `npm run db:bootstrap` (or `npm run db:seed` for a demo).
5. Point the domain at the app. One origin serves both the site and `/api`.

**B. GoDaddy VPS / Dedicated**
`npm ci --omit=dev && npm run build`, run with pm2 (`pm2 start dist/index.js --name kedem-api`), put Nginx or Apache in front with TLS, set `TRUST_PROXY=1`. Same env otherwise.

**C. Site stays on Vercel, API elsewhere** (interim)
Set `VITE_API_URL=https://api.<your-domain>/api` and `VITE_API_MODE=http` on Vercel, add that origin to `connect-src` in `vercel.json`, and set `CORS_ORIGINS=https://beyondfit.vercel.app` on the API. Until an API host exists, keep `VITE_API_MODE=mock` on Vercel (that is the current setting).

Remote access to GoDaddy MySQL from another host needs cPanel → *Remote MySQL* → add the API host's IP. Shared MySQL caps connections per user, so keep `DB_POOL_SIZE` small (5 is plenty).

## Security notes

- Passwords: bcrypt cost 12. Sessions: short-lived HS256 JWT + rotating opaque refresh tokens stored hashed; logout revokes the session's refresh token, a password reset revokes them all.
- Portal check: member credentials are refused at `/login/admin` even when valid.
- Every list is scoped server-side from the token (never from a client-supplied id); cross-tenant reads return `null`/403.
- Booking is serialised per provider inside a transaction and backed by a unique index on the live slot, so two people cannot take one slot.
- Helmet headers, per-IP rate limits on credential and public-form endpoints, JSON bodies capped at 256 KB, `x-powered-by` off.

## What is stubbed (and where to plug in)

| Area | Today | Next step |
| --- | --- | --- |
| Card payments | `PAYMENT_PROVIDER=manual` marks the order paid and records a payment with a card-style fee | implement `PaymentProvider` in `src/modules/orders/payment-provider.ts` for Stripe/Razorpay; keep orders `awaiting_payment` until the webhook |
| Zoom / Meet links | not generated; phone consults get the provider's `tel:` number | Zoom or Google Calendar API in `src/modules/appointments/service.ts#joinUrlFor` |
| Email | password-reset and contact notifications go out only when `SMTP_*` is set | set the GoDaddy SMTP relay |
| Subscription renewals | `renews_at` is stored; nothing charges on that date | a scheduled job (cron on the host) that charges via the provider and advances `renews_at` |

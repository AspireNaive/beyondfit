# Kedem Life API

Node.js (Express 5) + Cloud Firestore backend for the Kedem Life web app. It
implements every port the front end calls (`src/domain/ports.ts` → HTTP adapter
`src/infrastructure/http/container.ts`), so the web app switches from demo data
to real data with one setting: `VITE_API_MODE=http`.

- Endpoint summary: [`../docs/API.md`](../docs/API.md)
- OpenAPI: `src/openapi.json` (served live at `/api/openapi.json`, browsable at `/api/docs`)
- Postman: `../postman/kedem-life-api.postman_collection.json`

## Layout

```
server/
  scripts/seed.ts        demo data — the same fixtures the mock adapter used
  scripts/bootstrap.ts   production: one tenant + one admin from env, nothing else
  src/
    index.ts             process entry (PORT from env); ../server.js wraps it for GoDaddy Node.js Hosting
    app.ts               middleware + route mounting; optional static serving of ../dist
    config.ts            env → typed config, validated at boot
    domain.ts            enums and response shapes (mirror of the front end's domain)
    auth/                password hashing, JWT + refresh tokens, guards, /auth routes
    modules/<name>/      repository.ts (Firestore) · service.ts (rules) · routes.ts (HTTP + zod)
    db/firestore.ts      Admin SDK client, collection names, transaction helpers
    lib/                 problem+json errors, typed route helper, logger, mailer
  test/                  vitest + supertest integration tests against the Firestore emulator
../firestore.rules       closed to browsers — only this API (Admin SDK) reads and writes
../firestore.indexes.json  composite indexes the queries need; deploy with `firebase deploy --only firestore`
```

Conventions: Firestore access lives only in `repository.ts`; business rules and
authorization only in `service.ts`; routes validate with zod and stay thin.
Money is minor units + currency. Timestamps are Firestore `Timestamp`s
(UTC); calendar days are `YYYY-MM-DD` strings. Errors are RFC 7807
`application/problem+json` (`detail` is user-facing, `code` is
machine-readable, `errors` maps to form fields).

### Data model (collections)

| Collection | Document id | Notes |
| --- | --- | --- |
| `tenants` | id | `isDefault` marks the studio sign-ups land on |
| `users` / `userEmails` | id / email | `userEmails` gives the unique-email guarantee Firestore lacks (created in the same transaction) |
| `providers` | userId | bookable half of a coach; `hours[]` and `timeOff[]` embedded |
| `appointments` / `slotLocks` | id / `${providerId}_${startsAtMs}` | the lock is created in the booking transaction, so one slot can never be sold twice |
| `bodyMetrics` / `activity` | `${memberId}_${day}` | same-day logging is an overwrite by construction |
| `goals` | memberId | |
| `products` / `productSlugs` | id / slug | slug uniqueness via the lock document |
| `orders` | id | lines embedded; `instructorIds[]` for the coach view; `counters/orders` hands out `KL-10001…` |
| `payments`, `subscriptions` | id | |
| `refreshTokens`, `passwordResetTokens` | sha256(token) | raw tokens are never stored |
| `contactMessages`, `newsletterSubscribers` | id / email | |

## Run locally

Requirements: Node 20 (`nvm use` in the repo root) and, for the emulator, a
JDK 21+ on your PATH (`brew install openjdk@21`, then
`export PATH="$(brew --prefix openjdk@21)/bin:$PATH"` in that shell). Your
system Java is not changed.

```bash
cd server
cp .env.example .env            # set a real JWT_SECRET; keep FIRESTORE_EMULATOR_HOST for local work
npm install
npm run emulators               # terminal 1: Firestore emulator on 127.0.0.1:8085 (data kept in ../.firestore-emulator)
npm run db:seed -- --reset      # terminal 2: demo data (password for every demo user: kedemlife)
npm run dev                     # http://127.0.0.1:4000/api/health
```

Then in the repo root `npm run dev` — Vite proxies `/api` to the API, so the
browser stays same-origin. Sign in with `member@kedemlife.app` / `kedemlife`
(or coach@, admin@, manager@).

To develop against the **real** Firestore instead of the emulator, remove
`FIRESTORE_EMULATOR_HOST` from `.env` and set `FIREBASE_SERVICE_ACCOUNT` (see
Configuration). `npm run db:seed -- --reset` then empties the real database —
only do that on a project you are happy to wipe.

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | tsx watch mode |
| `npm run build` / `npm start` | compile to `dist/` and run it |
| `npm run emulators` | Firestore emulator with persisted data |
| `npm run db:seed [-- --reset]` | demo data (`--reset` empties every collection first) |
| `npm run db:seed:posts` | only the demo blog posts, into a database that already has studios and people; skips what exists |
| `npm run db:bootstrap` | production: create the default tenant + an `app_manager` from `BOOTSTRAP_*` |
| `npm test` | starts the emulator, seeds it, runs the integration suite, stops it |

## Configuration

See `.env.example`; everything is validated in `src/config.ts`. The ones that matter in production:

| Variable | Notes |
| --- | --- |
| `FIREBASE_PROJECT_ID` | `beyondfit-cc69a` |
| `FIREBASE_SERVICE_ACCOUNT` | base64 of the service-account JSON key (hosts outside Google Cloud, i.e. GoDaddy). Alternative: `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json` |
| `JWT_SECRET` | ≥ 32 random chars; rotating it signs everyone out |
| `SERVE_STATIC=true` | this process also serves the Vite build from `STATIC_DIR` (same origin, no CORS) |
| `CORS_ORIGINS` | only when the site is on another origin (e.g. `https://beyondfit.vercel.app`) |
| `APP_URL` | where password-reset links point |
| `TRUST_PROXY=1` | behind Passenger/Nginx/Apache so rate limits see real client IPs |
| `FIRESTORE_PREFER_REST=true` | Firestore over HTTPS/REST instead of gRPC, for hosts that only allow plain HTTP(S) egress (set by `server.js` on GoDaddy) |
| `SMTP_*` | GoDaddy relay `smtpout.secureserver.net:465`; without SMTP, reset links are logged instead |
| `PAYMENT_PROVIDER=manual` | records payments as taken; see "What is stubbed" |

## Deploying on GoDaddy Node.js Hosting

The live site (kedemlife.com) runs on [GoDaddy Node.js Hosting](https://www.godaddy.com/hosting/nodejs):
the `AspireNaive/beyondfit` repository is connected, and every push to `main`
rebuilds and redeploys. The platform runs, from the repo root, a production
install (no `devDependencies`), then `npm run build`, then `npm start`, on
Node.js 22, and supplies `PORT`.

- `npm run build` compiles the site (`dist/`) and the API (`server/dist/`).
- `npm start` runs the root `server.js`, which starts the API as **one process
  that also serves the site**, so `/api` is same-origin and there is no CORS.
  It defaults `NODE_ENV=production`, `SERVE_STATIC=true`, `TRUST_PROXY=1` and
  `FIRESTORE_PREFER_REST=true` (only HTTP/HTTPS egress is allowed on the
  platform; REST is plain HTTPS). An explicit variable in the dashboard wins.
- Everything the build or start needs is in `dependencies` (TypeScript, Vite
  and its plugins, the `@types/*` the compile needs); `devDependencies` hold
  only local tooling (tests, emulator, linter).

Secrets go in the app's **Settings → Manage Secrets** as `.env`-style lines:

```
FIREBASE_PROJECT_ID=beyondfit-cc69a
FIREBASE_SERVICE_ACCOUNT=<base64 of the service-account key: base64 -i key.json | tr -d '\n'>
JWT_SECRET=<48 random bytes>
APP_URL=https://kedemlife.com
```

Add them **before** merging a change that touches `start`: the API exits at
boot when Firestore is unreachable, and the platform would keep restarting it.
`https://kedemlife.com/api/health` answering `{"status":"ok"}` means the API is
up; the site signs in against the same Firestore database Vercel uses.

Platform limits that matter here: outbound traffic is HTTP/HTTPS only, so
external SMTP does not work — leave `SMTP_*` unset (reset links are logged)
until the mailer is moved to the platform's email gateway. `db:seed` and
`db:bootstrap` need `tsx` (a dev dependency): run them from a laptop, never on
the platform.

Other single-process hosts (cPanel Passenger, pm2 on a VPS) work the same way:
build, then `npm start` with the variables above; Cloud Run / Cloud Functions
can drop `FIREBASE_SERVICE_ACCOUNT` and use `applicationDefault()` credentials.

## Security notes

- Passwords: bcrypt cost 12. Sessions: short-lived HS256 JWT + rotating opaque refresh tokens stored as hashes; logout revokes the session's refresh token, a password reset revokes them all.
- Portal check: member credentials are refused at `/login/admin` even when valid.
- Every list is scoped server-side from the token (never from a client-supplied id); cross-tenant reads return `null`/403.
- Firestore rules deny all client access; only the API's service account can read or write.
- Booking runs in a transaction that creates the slot lock document, so two people cannot take one slot.
- Helmet headers, per-IP rate limits on credential and public-form endpoints, JSON bodies capped at 256 KB, `x-powered-by` off.

## What is stubbed (and where to plug in)

| Area | Today | Next step |
| --- | --- | --- |
| Card payments | `PAYMENT_PROVIDER=manual` marks the order paid and records a payment with a card-style fee | implement `PaymentProvider` in `src/modules/orders/payment-provider.ts` for Stripe/Razorpay; keep orders `awaiting_payment` until the webhook |
| Zoom / Meet links | not generated; phone consults get the provider's `tel:` number | Zoom or Google Calendar API in `src/modules/appointments/service.ts#joinUrlFor` |
| Email | password-reset and contact notifications go out only when `SMTP_*` is set | set the GoDaddy SMTP relay |
| Subscription renewals | `renewsAt` is stored; nothing charges on that date | a scheduled job (cPanel cron) that charges via the provider and advances `renewsAt` |

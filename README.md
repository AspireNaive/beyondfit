# Kedem Life

A multi-tenant coaching platform (PaaS) for gyms and studios: a marketing site
with a video-background homepage, four sign-in portals, 1:1 booking with
coaches and clinical specialists, member progress tracking, a storefront, a
public blog written by coaches and studio staff, and role-scoped dashboards for
members, coaches, admins and platform operators.

This repository is the **React front end**. It runs standalone today against an
in-memory adapter, and switches to the Node API in `server/` with one environment variable.

---

## Backend (Node.js API + Cloud Firestore)

The app is no longer demo-only: `server/` is a Node.js (Express 5) API on
Cloud Firestore (Firebase project `beyondfit-cc69a`) that implements every
port in `src/domain/ports.ts` — auth, directory, specialists and booking,
progress, catalogue, orders and payments, memberships, tenants, the blog, and
the marketing forms. The front end talks to it through
`src/infrastructure/http/container.ts`; `VITE_API_MODE=http` is the default and
`mock` keeps the in-memory adapter for UI work without a database.

```bash
# terminal 1 — Firestore emulator (needs JDK 21+ on PATH; see server/README.md)
cd server && npm install && npm run emulators
# terminal 2 — API against the emulator, seeded with demo data
cd server && cp .env.example .env && npm run db:seed -- --reset && npm run dev
# terminal 3 — web, proxies /api to the API
npm run dev
```

Root shortcuts: `npm run dev:api`, `npm run test:api`, `npm run build:api`, `npm run db:seed`, `npm run db:seed:posts`.
Docs: `server/README.md` (setup, configuration, GoDaddy deployment),
`docs/API.md` (every endpoint), `/api/docs` on a running server (Swagger UI),
`postman/kedem-life-api.postman_collection.json`.

## Blog

`/blog` is a public, social-style feed — readable signed in or not — of
articles written by coaches, studio admins and platform staff
(`content:write`). Newest first, one column, and older posts keep loading as
you scroll. Every studio has its own blog at `/blog/studio/:slug` and every
coach theirs at `/blog/author/:id`; the search box looks inside the article
body, not just at titles. Each article is a list of typed blocks (headings,
paragraphs, images, video links, quotes, bullet lists) rather than HTML, so
rendering is safe by construction and the reader gets a table of contents and
a reading-progress bar for free. Staff write and manage posts at `/app/blog`
(drafts, publish/unpublish, delete); a coach manages their own posts, an admin
their studio's, an app manager everything. YouTube and Vimeo links embed
inline; other video links open in a new tab.

Posts live in Firestore (`posts` and `postSlugs`) behind the API in `server/`;
the in-memory adapter is only used with `VITE_API_MODE=mock`. `npm run
db:seed` loads the demo posts with everything else; `npm run db:seed:posts`
adds just the posts to a database that already has studios and people.

## Running it

```bash
nvm use             # reads .nvmrc → Node 20
npm install
npm run dev         # http://localhost:5173
```

**Node 20.19+ is required** (Vite 8 / rolldown / Tailwind v4 oxide). If your
shell defaults to an older Node, `npm install` will stop with an `EBADENGINE`
error rather than building a tree with wrong-ABI native binaries — installing
under Node 16 silently omits `@tailwindcss/oxide-darwin-arm64` and
`@rolldown/binding-darwin-arm64`, and Vite then dies with a confusing
`SyntaxError: ... does not provide an export named 'styleText'`.

If you hit that, the fix is a clean reinstall on the right Node:

```bash
nvm use && rm -rf node_modules && npm ci
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Typecheck (`tsc -b`) then production build |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | oxlint |
| `npm run build -- --mode analyze` | Build + write `dist/stats.html` bundle treemap |

### Demo accounts

Every account uses the password **`kedemlife`**. Each sign-in screen also has
one-click buttons that fill the form for you.

| Role | Email | Portal |
| --- | --- | --- |
| Member | `member@kedemlife.app` | `/login` or `/login/member` |
| Coach | `coach@kedemlife.app` | `/login/instructor` |
| Admin | `admin@kedemlife.app` | `/login/admin` |
| App manager | `manager@kedemlife.app` | `/login/admin` |

Portals are enforced, not cosmetic: presenting member credentials at
`/login/admin` is rejected even though the password is correct — the same rule
the API applies as well.

---

## Deployment

Live on GoDaddy Node.js Hosting: **https://kedemlife.com** — and on Vercel:
**https://beyondfit.vercel.app** (Firebase Hosting mirror: https://beyondfit-cc69a.web.app).
Both talk to the same Firestore database.

> **GoDaddy** builds from `main` on every push (`npm run build`, then `npm start`).
> `npm start` runs the root `server.js`: one Node process that serves `dist/`
> and the API under `/api`. Setup and the required secrets are in
> `server/README.md` → *Deploying on GoDaddy Node.js Hosting*.
>
> **Vercel** serves `dist/` from its CDN and runs the same Express app as a
> serverless function (`api/index.ts`, rewritten from `/api/*`).
>
> Neither host deploys Firestore indexes. After merging a change that adds
> some (`firestore.indexes.json`), run
> `npx firebase deploy --only firestore:indexes --project beyondfit-cc69a` once;
> the API sorts in memory until they exist, so the site stays up meanwhile.

```bash
npm run deploy           # builds, then deploys to the live channel
npm run deploy:preview   # temporary preview URL, expires in 7 days
npm run serve:prod       # serve dist/ locally *with* the real hosting headers
```

`firebase.json` carries the `predeploy` hook, so `npm run deploy` always ships a
fresh `tsc -b && vite build` — you cannot accidentally deploy a stale `dist/`.

Three things in that config are load-bearing:

- **The SPA rewrite** (`** → /index.html`). Without it, a hard refresh on
  `/app/progress` or any shared deep link 404s, because those paths only exist
  inside the router.
- **Split cache policy.** `/assets/**` is `immutable, max-age=31536000` because
  those filenames are content-hashed; everything else — crucially `index.html`
  and every rewritten route — is `no-cache, must-revalidate`. Get this backwards
  and a deploy takes an hour to reach users, or hashed assets are re-fetched
  forever. Verify with `npm run serve:prod`, which applies the same headers.
- **`*.gz` / `*.br` are excluded from upload.** Firebase compresses on the fly
  (responses come back `content-encoding: br`), so the pre-compressed copies the
  build emits would be dead weight — 46 extra files serving nothing. They are
  still produced for any origin you self-host behind nginx.

A CSP is set in the same file. It currently allows `connect-src 'self'` only —
**when you point the app at the API on another origin, add that origin to
`connect-src`** or every request will be blocked.

`serve:prod` is the honest local check: `npm run preview` serves the built app
but *not* the hosting headers, so it cannot catch a CSP or caching mistake.

## Architecture

Feature-based on the outside, domain-driven on the inside.

```
src/
  app/                 composition root — router, query client, error boundary
  domain/              pure model. No React, no HTTP, no framework imports.
    shared/            branded ids, Money, Page<T>
    identity/          Role, Permission, UserProfile, Tenant, AuthSession
    scheduling/        Provider, Appointment, availability, cancellation rules
    progress/          body metrics, activity, BMI/BMR maths
    commerce/          Product, Cart, Order, Payment, Subscription
    ports.ts           the interfaces the UI depends on
  infrastructure/      adapters that implement the ports
    mock/              in-memory repositories + deterministic seed data
    http/              the API client (api-client.ts + container.ts)
    container.ts       picks the adapter from VITE_API_MODE
  features/            vertical slices — auth, marketing, booking, progress,
                       profiles, shop, orders, payments, dashboard, tenant
  shared/              cross-cutting UI primitives, layouts, charts, utils
```

Three rules keep it honest:

1. **`domain/` imports nothing.** It is plain TypeScript — the business rules
   (cancellation window, permission matrix, cart totals, BMI bands) live there
   and are trivially unit-testable.
2. **The UI depends on `domain/ports.ts`, never on an adapter.** Screens call
   `container.scheduling.book(...)`, not `fetch`.
3. **Closed sets are `const` objects, not TS `enum`s.** The build runs with
   `erasableSyntaxOnly`, and it means every enum value is real data the API
   client can serialise directly.

---

## Backend integration

`src/infrastructure/http/container.ts` is the contract and `server/` is the
implementation. `VITE_API_MODE=http` (default) makes `container.ts` use
`createHttpContainer()`; every repository call then goes over HTTP.
`src/infrastructure/http/api-client.ts` handles bearer tokens, RFC 7807
`application/problem+json` errors (flattening field errors onto forms),
timeouts and 401 handling. Endpoint reference: `docs/API.md`.

The client-side route guards are a **UX affordance, not a security control** —
the API authorises every request from the bearer token.

---

## Performance

The brief was "fast, and scalable to millions of users". What that meant in
practice:

- **131 kB brotli initial transfer**, JS + CSS, for the marketing homepage.
- **Every page is a lazy chunk.** A visitor who only reads the homepage never
  downloads the dashboard, the booking calendar or the checkout.
- **No charting library.** Recharts cost 91 kB brotli and — because it landed in
  a shared chunk — was being `modulepreload`ed on the marketing homepage, which
  never draws a chart. The five progress charts are now ~500 lines of SVG in
  `src/shared/charts/primitives.tsx`, with the same crosshair, tooltips and mark
  specs. Net saving: 392 kB raw off the wire.
- **Long-lived vendor chunks** (`react`, `router`, `query`) are split from app
  code, so shipping a feature does not invalidate the framework in every cache.
- **Pre-compressed assets.** The build emits `.gz` and `.br` alongside each
  asset so the origin serves them without per-request CPU.
- **The hero video is opt-in** — skipped on save-data, slow connections,
  reduced-motion and narrow viewports. See `public/media/README.md`.
- **Money is integer minor units**, and `Intl.NumberFormat` instances are cached
  rather than constructed per table row.

Mobile: verified zero horizontal overflow at 390px; tables collapse to card
lists below `md` rather than scrolling sideways.

---

## Data visualisation

Chart colours are validated, not chosen by eye. The brand accent (volt,
`#d0fb54`) is **not** used for data marks — it sits at OKLCH L≈0.93, far outside
the 0.48–0.67 band a dark-surface series colour must occupy, and a lime series
next to an orange one collapses under deuteranopia (measured ΔE 1.3, i.e.
indistinguishable). Series use a palette validated against this app's own chart
surface:

```
"#3987e5,#d95926,#199e70" --mode dark --surface "#0e141c" --pairs all
→ lightness band PASS · chroma PASS · CVD ΔE 9.4 PASS
  normal-vision ΔE 20.9 PASS · contrast PASS
```

Slots are assigned in fixed order and never cycled. A fourth series would mean
folding the tail into "Other" or faceting — not inventing a hue. Every chart
also has a table view (`Show table` on the progress page) so the numbers are
reachable without colour.

---

## What is deliberately not here

- **A database.** The brief was UI-first; `infrastructure/mock/` stands in until
  the API is deployed.
- **Real payment processing.** Checkout collects details and posts an order; no
  gateway is wired up.
- **Tests.** The domain layer is pure and designed to be tested first if you
  want to add Vitest — start with `domain/progress/model.ts` and
  `domain/commerce/model.ts`.

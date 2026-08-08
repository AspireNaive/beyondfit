# BeyondFit

A multi-tenant coaching platform (PaaS) for gyms and studios: a marketing site
with a video-background homepage, four sign-in portals, 1:1 booking with
coaches and clinical specialists, member progress tracking, a storefront, and
role-scoped dashboards for members, coaches, admins and platform operators.

This repository is the **React front end**. It runs standalone today against an
in-memory adapter, and switches to the .NET API with one environment variable.

---

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

Every account uses the password **`beyondfit`**. Each sign-in screen also has
one-click buttons that fill the form for you.

| Role | Email | Portal |
| --- | --- | --- |
| Member | `member@beyondfit.app` | `/login` or `/login/member` |
| Coach | `coach@beyondfit.app` | `/login/instructor` |
| Admin | `admin@beyondfit.app` | `/login/admin` |
| App manager | `manager@beyondfit.app` | `/login/admin` |

Portals are enforced, not cosmetic: presenting member credentials at
`/login/admin` is rejected even though the password is correct — the same rule
the .NET endpoint should apply.

---

## Deployment

Live on Firebase Hosting: **https://beyondfit-cc69a.web.app**

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
**when you point the app at the .NET API on another origin, add that origin to
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
    http/              the .NET client (api-client.ts + container.ts)
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
   `erasableSyntaxOnly`, and it means every enum value is real data the .NET
   client can serialise directly.

---

## Wiring up the .NET backend

```bash
# .env.local
VITE_API_MODE=http
VITE_API_PROXY_TARGET=http://localhost:5119   # your `dotnet run` port
```

That is the whole integration. No screen or hook changes — `container.ts` swaps
`mockContainer` for `createHttpContainer()`, and every repository call goes over
HTTP instead. `src/infrastructure/http/api-client.ts` already handles bearer
tokens, RFC 7807 `ProblemDetails` errors (including flattening `ModelState`
onto form fields), timeouts and 401 handling.

### Endpoints the API needs to expose

Defined in `src/infrastructure/http/container.ts` — that file is the contract.

**Auth**

| Method | Path | Body / notes |
| --- | --- | --- |
| `POST` | `/api/auth/login` | `{ email, password, portal, tenantSlug?, rememberMe? }` → `AuthSession`. Reject when `portal` does not accept the account's role. |
| `POST` | `/api/auth/register` | `{ firstName, lastName, email, password, phone?, goal? }` → `AuthSession` |
| `POST` | `/api/auth/logout` | — |
| `GET` | `/api/auth/me` | Revalidates the bearer token → `AuthSession` |
| `POST` | `/api/auth/password-reset` | `{ email }`. Always 204, even for unknown addresses (no account enumeration). |

**Directory, scheduling, progress, commerce**

| Method | Path |
| --- | --- |
| `GET` | `/api/directory/mapped` — scope derived from the token, always includes self |
| `GET` | `/api/directory/{userId}` · `/api/directory?role=` |
| `GET` | `/api/providers` · `/api/providers/{id}` · `/api/providers/{id}/availability?date=` |
| `GET` `POST` | `/api/appointments` · `POST /api/appointments/{id}/cancel` |
| `GET` | `/api/members/{id}/body-metrics` · `/activity?days=` · `/goal` |
| `POST` | `/api/members/{id}/body-metrics` |
| `GET` | `/api/products` · `/api/products/{slug}` |
| `GET` `POST` | `/api/orders` · `PATCH /api/orders/{id}` |
| `GET` | `/api/payments` · `/api/subscriptions` |
| `GET` | `/api/tenant` · `/api/tenants` |

The client-side route guards are a **UX affordance, not a security control** —
authorise every request server-side from the bearer token.

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
  the .NET API exists.
- **Real payment processing.** Checkout collects details and posts an order; no
  gateway is wired up.
- **Tests.** The domain layer is pure and designed to be tested first if you
  want to add Vitest — start with `domain/progress/model.ts` and
  `domain/commerce/model.ts`.

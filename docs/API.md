# Kedem Life API

Reference for the Node.js/Express REST API in `server/`. The machine-readable
source of truth is [`server/src/openapi.json`](../server/src/openapi.json) (OpenAPI 3.1),
served live at `GET /api/openapi.json` and rendered by Swagger UI at
`GET /api/docs`. A Postman collection covering every route is in
[`postman/kedem-life-api.postman_collection.json`](../postman/kedem-life-api.postman_collection.json).

## Overview

**Base URL.** Every path below is relative to `/api`. Locally the API listens on
port 4000 (`http://localhost:4000/api`); the Vite dev server proxies `/api` to it
so the front end can use the same origin. Unknown routes under `/api` return a
404 problem (see below).

**Authentication.** Bearer JWT: `Authorization: Bearer <accessToken>`. Tokens
come from `POST /auth/login`, `POST /auth/register` and `POST /auth/refresh`.
An access token lasts 12 hours (30 days when `rememberMe` is true); the refresh
token lasts 30 days and is single-use — `POST /auth/refresh` revokes the
presented token and returns a new pair. The bearer header is read on every
request, including public routes: a malformed or expired token yields 401 and a
suspended account yields 403 with `code: "suspended"`, even where no token was
required. The user row is re-read on each request, so role changes and
suspensions take effect immediately rather than at token expiry.

**JSON in, JSON out.** Request bodies are JSON (limit 256 kB). Responses are
JSON. Handlers that have nothing to return answer `204 No Content`. A few
single-record lookups deliberately return `200` with a JSON `null` body instead
of 404 (single directory profile, provider, product by slug, order) so the front
end can render its own empty state; they are flagged in the tables.

**Errors** are RFC 7807 Problem Details sent as `application/problem+json`:

```json
{
  "type": "about:blank",
  "title": "Unprocessable Entity",
  "status": 422,
  "detail": "password: Use at least 8 characters.",
  "code": "validation",
  "errors": { "password": ["Use at least 8 characters."] }
}
```

- `type`, `title`, `status` are always present; `detail` is the message shown to
  the user.
- `code` appears only for specific failures: `invalid_credentials`,
  `wrong_portal`, `suspended`, `email_taken`, `seats_full`, `reset_invalid`,
  `out_of_stock`, `payment_failed`, `already_subscribed`, `slug_taken`, `validation`.
- `errors` maps a dotted field path (or `_`) to messages. It is present on
  every 422 schema failure and on some 422 business-rule failures.
- Schema validation (zod) is 422. Malformed JSON is 400. A duplicate key (email, product slug, booking slot) is 409.
  Anything unexpected is a 500 `Something went wrong.`

**Rate limits** (per IP, 15-minute window, `express-rate-limit`):

| Budget | Endpoints |
|---|---|
| 30 requests | `POST /auth/login`, `POST /auth/register`, `POST /auth/password-reset`, `POST /auth/password-reset/confirm` (one shared counter) |
| 10 requests | `POST /contact`, `POST /newsletter` (one shared counter) |

Exceeding a budget returns `429` with `RateLimit`, `RateLimit-Policy` (IETF
draft-8) and `Retry-After` headers. Note the 429 body is plain
`application/json` — `{ "title": "Too Many Requests", "status": 429, "detail": "..." }`
— without the `type` member. In `NODE_ENV=test` the limits are raised to 10 000.

## Roles & permissions

`server/src/domain.ts` defines four roles and nine permissions
(`ROLE_PERMISSIONS`). Each role includes everything the row before it has:

| Role | Permissions |
|---|---|
| `member` | `progress:read:self`, `appointments:write` |
| `coach` | member's + `progress:read:assigned`, `orders:read`, `content:write` |
| `admin` | coach's + `payments:read`, `catalog:write`, `tenant:write` |
| `app_manager` | admin's + `platform:write` |

Where the permissions bite:

| Permission | Gates |
|---|---|
| `catalog:write` | `POST /products`, `PATCH /products/{id}` |
| `content:write` | `GET /posts/mine`, `POST /posts`, `PATCH /posts/{id}`, `DELETE /posts/{id}` (then ownership rules apply) |
| `payments:read` | `GET /payments` |
| `platform:write` | `GET /tenants`, `POST /tenants`, `PATCH /tenants/{id}` on any studio with every field |
| `tenant:write` | `PATCH /tenants/{id}` on the caller's own studio, `name` and `primaryColor` only |
| `orders:read` | `PATCH /orders/{id}` (then ownership rules apply) |

`progress:read:*` and `appointments:write` are not checked by middleware; the
equivalent rules live in the services and are described per route below. Two
cross-cutting rules: `app_manager` sees and may act on every studio, and nothing
else ever crosses a studio (tenant) boundary.

**Sign-in portals** (`portal` field of `POST /auth/login`): `member` accepts
member accounts only; `coach` accepts coach only; `admin` accepts admin **and**
app_manager; `app_manager` accepts app_manager only. Valid credentials on the
wrong portal fail with 403 `wrong_portal`.

## System

| Method | Path | Auth | Purpose | Notes |
|---|---|---|---|---|
| GET | `/health` | public | Liveness | `{ status: "ok", uptime }`; `Cache-Control: no-store`; not logged. |
| GET | `/openapi.json` | public | OpenAPI document | Serves `server/src/openapi.json`; a stub with empty `paths` if the file is missing. |
| GET | `/docs` | public | Swagger UI | HTML page; loads Swagger UI from cdn.jsdelivr.net. |

## Auth

| Method | Path | Auth | Purpose | Notes |
|---|---|---|---|---|
| POST | `/auth/login` | public, rate-limited | Sign in | Body `{ email, password, portal?="member", tenantSlug?, rememberMe? }` → 200 `AuthSession`. Order of checks: 400 `invalid_credentials` → 403 `suspended` → 403 `wrong_portal` → 400 `invalid_credentials` when `tenantSlug` is not the account's studio. 422 on schema. |
| POST | `/auth/register` | public, rate-limited | Create a member | Body `{ firstName, lastName, email, password(≥8), phone?, goal?, tenantSlug? }` → 201 `AuthSession`. Role is always `member`; joins the named studio or the default one; assigned to the studio's longest-serving active coach. 409 `email_taken`, 409 `seats_full`, 400 unknown studio / no studio, 422 weak password. |
| POST | `/auth/logout` | bearer | Sign out session | Revokes the session's refresh tokens → 204. The access token stays valid until expiry. |
| GET | `/auth/me` | bearer | Current user + studio | → 200 `{ user, tenant }` (no tokens). 404 if the studio is gone. |
| PATCH | `/auth/me` | bearer | Update own profile | Body any of `firstName, lastName, phone, avatarUrl, title, bio, location` (nullable ones accept `null`) → 200 `UserProfile`. |
| POST | `/auth/refresh` | public | Rotate tokens | Body `{ refreshToken }` → 200 `AuthSession`. Presented token is revoked; reuse, expiry, or a suspended/deleted user → 401. Not rate-limited. |
| POST | `/auth/password-reset` | public, rate-limited | Request reset email | Body `{ email }` → always 204 (no account enumeration). Token valid 30 min, single use, emailed as `APP_URL/reset-password?token=…`. |
| POST | `/auth/password-reset/confirm` | public, rate-limited | Set new password | Body `{ token, password(≥8) }` → 204 and every session of the user is revoked. 400 `reset_invalid`. |
| POST | `/auth/change-password` | bearer | Change own password | Body `{ currentPassword, newPassword(≥8) }` → 204. 400 `invalid_credentials` if the current password is wrong. Sessions stay valid. |

## Directory

All routes require a bearer token.

| Method | Path | Auth | Purpose | Notes |
|---|---|---|---|---|
| GET | `/directory/mapped` | bearer | People I may see | Always includes the caller. member → studio's coaches; coach → their assigned members + fellow coaches; admin → whole studio; app_manager → every user. → `UserProfile[]`. |
| GET | `/directory?role=` | bearer | List one role | `role` required (`member\|coach\|admin\|app_manager`, else 422). Scoped to the caller's studio (app_manager: platform-wide). A member asking for `role=member` gets 403. |
| GET | `/directory/{userId}` | bearer | One profile | 200 `UserProfile` **or `null`** when unknown or not visible. Visible: yourself; anyone for app_manager; otherwise same studio, where admin/coach see everyone and members see staff only. |

## Providers

Public — the specialist finder is part of the marketing site.

| Method | Path | Auth | Purpose | Notes |
|---|---|---|---|---|
| GET | `/providers` | public | List providers | Query `discipline?` (`coaching\|nutrition\|physiotherapy\|medical\|mental_performance`), `query?` (substring of name, title or credential). Active providers accepting bookings, all studios, by rating. Each carries `nextAvailable` (first day within 14 days with a free slot) when there is one. |
| GET | `/providers/{providerId}` | public | One provider | 200 `Provider` **or `null`** when unknown/inactive. |
| GET | `/providers/{providerId}/availability?date=` | public | Slots for one day | `date` required, `YYYY-MM-DD` in the provider's timezone (422 if malformed, 400 if not a real date). → `AvailabilitySlot[]` walking working hours in slot-length steps; `available` is false when past, booked, or in time off. Unknown provider → `[]`. |

## Appointments

All routes require a bearer token.

| Method | Path | Auth | Purpose | Notes |
|---|---|---|---|---|
| GET | `/appointments` | bearer | My sessions | member → booked by me; coach → where I am the provider; admin → whole studio; app_manager → all. Ordered by start. |
| POST | `/appointments` | bearer | Book | Body `{ providerId, startsAt (ISO with offset), durationMinutes (30\|45\|60), channel, goal?, notes? }` → 201 `Appointment` with `status: "confirmed"` at the provider's rate. Provider must be active and accepting bookings (400) and in the caller's studio unless app_manager (403). `startsAt` must equal a published slot start for that day (422), be in the future (409) and be free (409). Channel must be offered (422). Phone sessions get a `tel:` `joinUrl`. |
| POST | `/appointments/{id}/cancel` | bearer | Cancel | No body → 200 `Appointment`. Allowed: booking member, provider, studio admin, app_manager. Already cancelled → returned unchanged; completed/no_show → 409. 404 unknown. |
| PATCH | `/appointments/{id}` | bearer | Change status | Body `{ status: "confirmed"\|"completed"\|"no_show" }` → 200. Allowed: provider, studio admin, app_manager — **not** the member. Cancelled session → 409. 404 unknown. |

## Progress

All routes require a bearer token. **Access rule for every route:** the member
themself, app_manager, and — within the same studio — an admin, the member's
assigned coach, or any coach who has a non-cancelled appointment with the
member. Unknown member → 404; anyone else → 403.

| Method | Path | Auth | Purpose | Notes |
|---|---|---|---|---|
| GET | `/members/{memberId}/body-metrics` | bearer | Metric history | → `BodyMetricEntry[]` ordered by `recordedOn`. |
| POST | `/members/{memberId}/body-metrics` | bearer | Log a metric | Body `{ recordedOn (YYYY-MM-DD), weightKg, heightCm, bodyFatPercent?, restingHeartRate?, waistCm?, note? }` → 201 `BodyMetricEntry`. One entry per member per day: same `recordedOn` overwrites (still 201). A `memberId` in the body is ignored. |
| GET | `/members/{memberId}/activity?days=` | bearer | Daily activity | `days` 1–366, default 30 → `ActivityEntry[]`. |
| PUT | `/members/{memberId}/activity/{date}` | bearer | Replace one day | Body `{ steps, activeMinutes, caloriesBurned, caloriesConsumed, proteinGrams, waterMl, sleepHours, workouts }` — every field defaults to 0, so send the whole day → 200 `ActivityEntry`. |
| GET | `/members/{memberId}/goal` | bearer | Goal | → `MemberGoal`; the default (2200 kcal, 150 g protein, 10 000 steps, 4 workouts, "General health") when none saved. |
| PUT | `/members/{memberId}/goal` | bearer | Replace goal | Body `{ targetWeightKg?, dailyCalorieTarget (800–10000), dailyProteinTarget (20–500), dailyStepTarget (1000–100000), weeklyWorkoutTarget (0–14), focus }` → 200 `MemberGoal`. |

## Catalog

Public storefront reads; writes need `catalog:write` (admin, app_manager).

| Method | Path | Auth | Purpose | Notes |
|---|---|---|---|---|
| GET | `/products` | public | List products | Query `category?` (`program\|supplement\|equipment\|apparel\|testing\|membership`), `query?` (substring of name or tagline). Active products only, creation order. |
| GET | `/products/{slug}` | public | One product by **slug** | 200 `Product` **or `null`** when unknown or inactive. |
| POST | `/products` | bearer, `catalog:write` | Create | Body `{ slug, name, description, category, priceMinor, tagline?="", currency?="USD", compareAtMinor?, imageUrl?, accent?="#b6ef21", inStock?=true, badge?, digital?=false, instructorId? }` → 201 `Product`. 409 if the slug exists. |
| PATCH | `/products/{productId}` | bearer, `catalog:write` | Update | Same path shape as the GET but keyed by **id**. Any subset of the create fields plus `active` (false hides it from the catalogue and checkout) → 200 `Product` (returned even if inactive). 404 unknown id; a colliding slug surfaces as 409 from the database. |

## Content (blog)

Articles written by coaches and studio staff, readable by anyone — no token
needed. Stored in Firestore (`posts`, plus `postSlugs` for link uniqueness).
Every studio (`?tenant=`) and every coach (`?author=`) has their own feed.
Reads are public; writes need `content:write` (coach, admin, app_manager). Ownership:
a **coach** manages only posts they wrote, an **admin** every post in their
studio, an **app_manager** every post. A post body is a list of typed blocks —
`{ type: "heading" | "paragraph", text }`, `{ type: "image", url, alt, caption? }`,
`{ type: "video", url, caption? }`, `{ type: "quote", text, attribution? }`,
`{ type: "list", items[] }` — never HTML. Image and video `url`s must be
`http(s)`; the front end embeds YouTube and Vimeo links and renders anything
else as a link.

| Method | Path | Auth | Purpose | Notes |
|---|---|---|---|---|
| GET | `/posts` | public | The feed | Query `tenant?` (studio slug — that studio's own blog), `author?` (user id — that coach's own blog), `tag?` (case-insensitive), `query?` (substring of title, summary, tags **or the article body**), `page?=1`, `pageSize?=9` (1–50). Published posts only, newest `publishedAt` first → `{ items: Post[], total, page, pageSize }`. |
| GET | `/posts/mine` | bearer, `content:write` | Posts I manage | Drafts included, most recently edited first → `Post[]`. Scope by role as above. |
| GET | `/posts/{slug}` | public | One post by **slug** | 200 `Post` **or `null`**. Drafts are `null` unless the bearer may manage the post. |
| POST | `/posts` | bearer, `content:write` | Create | Body `{ title (3–160), slug, excerpt (10–300), blocks (1–200), tags?=[] (≤8), coverImageUrl?, status?="draft" }` → 201 `Post`. Author and studio come from the token. 409 `slug_taken`. |
| PATCH | `/posts/{postId}` | bearer, `content:write` | Update / publish / unpublish | Any subset of the create fields → 200 `Post`. `status: "published"` stamps `publishedAt` the first time only; unpublishing keeps it so the feed order is stable. 403 outside the caller's scope, 404 unknown, 409 slug clash. |
| DELETE | `/posts/{postId}` | bearer, `content:write` | Delete | → 204 and the slug is free again. 403 / 404 as above. |

## Orders

All routes require a bearer token.

| Method | Path | Auth | Purpose | Notes |
|---|---|---|---|---|
| GET | `/orders` | bearer | My orders | member → own; coach → orders containing a product they authored (`instructorId`); admin → whole studio; app_manager → all. Newest first. |
| POST | `/orders` | bearer | Checkout | Body `{ lines: [{ productId, quantity 1–20 }] (1–50), method?="card" }` → 201 `Order` with `status: "paid"`. One transaction: order + charge via the configured provider (`manual`, always succeeds) + payment row. Totals recomputed server-side: shipping 795 minor unless all digital or subtotal ≥ 12 500; tax 8.25 %. Membership lines also start a monthly subscription. 422 unknown/inactive product or mixed currencies; 409 `out_of_stock` / `payment_failed`. |
| GET | `/orders/{orderId}` | bearer | One order | 200 `Order` **or `null`** when unknown or not visible. Visible to the customer, studio admin, a coach who authored a line, app_manager. |
| PATCH | `/orders/{orderId}` | bearer, `orders:read` | Change status | Body `{ status }` (any `OrderStatus`) → 200 `Order`. Members get 403. admin: own studio; coach: only orders carrying their products; app_manager: any. `refunded` also refunds the order's payments; `shipped`/`delivered` stamp `fulfilledAt` once. Same status → no-op. 404 unknown. |

## Payments

| Method | Path | Auth | Purpose | Notes |
|---|---|---|---|---|
| GET | `/payments` | bearer, `payments:read` | Ledger | admin → own studio; app_manager → all; anyone else 403. Newest first. → `Payment[]` (gross, fee, net; manual provider fee = 2.9 % + 30 minor, 0 for `bank_transfer`). |

## Subscriptions

All routes require a bearer token.

| Method | Path | Auth | Purpose | Notes |
|---|---|---|---|---|
| GET | `/subscriptions` | bearer | Memberships | member/coach → their own; admin → studio's book; app_manager → all. Newest first. |
| POST | `/subscriptions` | bearer | Start a membership | Body `{ productId, method?="card" }` → 201 `Subscription` (monthly, `active`). Runs the same checkout as `POST /orders` for one unit, so an order and payment are created too. 422 if the product is not an active membership product; 409 `already_subscribed`; checkout 409s pass through. |
| POST | `/subscriptions/{id}/cancel` | bearer | Cancel | No body → 200 `Subscription` with `status: "cancelled"`. Allowed: the member, studio admin, app_manager. Idempotent. 404 unknown. |

## Tenants

All routes require a bearer token.

| Method | Path | Auth | Purpose | Notes |
|---|---|---|---|---|
| GET | `/tenant` | bearer | My studio | Any role → 200 `Tenant` (`seatsUsed` is the live count of active members). 404 if gone. |
| GET | `/tenants` | bearer, `platform:write` | All studios | app_manager only → `Tenant[]`. |
| POST | `/tenants` | bearer, `platform:write` | Create a studio | Body `{ name, slug, plan?="starter", seats?=100, primaryColor? }` → 201 `Tenant`. 409 if the slug exists. |
| PATCH | `/tenants/{tenantId}` | bearer | Update a studio | Body any of `name, plan, seats, primaryColor` (slug is immutable). app_manager: any studio, every field. admin: own studio only, and `plan`/`seats` are silently dropped. Everyone else 403. 404 unknown. |

## Marketing

Public forms; the two share one 10-per-15-minute budget per IP.

| Method | Path | Auth | Purpose | Notes |
|---|---|---|---|---|
| POST | `/contact` | public, rate-limited | Contact form | Body `{ firstName, lastName, email, message, phone?, topic?="other" (coaching\|testing\|specialists\|orders\|platform\|other) }` → 201 `{ id }`. Stored first; the notification email (when SMTP is configured) is sent in the background and can never fail the request. |
| POST | `/newsletter` | public, rate-limited | Newsletter sign-up | Body `{ email, source?="footer" }` → 204. Re-subscribing an existing address clears its `unsubscribed_at`. |

## Demo accounts

`npm run db:seed` in `server/` loads the demo studios and people. Every demo
account uses the password **`kedemlife`**.

| Email | Role | Login portal |
|---|---|---|
| `member@kedemlife.app` | member | `member` |
| `coach@kedemlife.app` | coach | `coach` |
| `admin@kedemlife.app` | admin | `admin` |
| `manager@kedemlife.app` | app_manager | `admin` (or `app_manager`) |

The admin portal accepts both `admin` and `app_manager` accounts. Useful seed
ids: tenant `t-ironworks` (slug `ironworks`), member `u-member-1`, coach /
provider `u-coach-mara`, products `p-1` … `p-12` (`p-9`, slug
`membership-performance`, is the membership), blog posts `post-zone-2`,
`post-protein`, `post-knee`, `post-sleep`, `post-open-day` (published) and
`post-golf-draft` (a draft by `u-coach-devon`). `npm run db:seed:posts` adds
just the blog posts to a database that already has studios and people.

# Kedem Life — Demo Guide

**Live site:** https://beyondfit.vercel.app

## What it is

A fitness coaching website and app. Gyms use it to run their business, and
members use it to train.

Four kinds of people log in, and each sees something different:

- **Members** — book sessions, track progress, buy things
- **Coaches** — see their calendar, their clients, and their orders
- **Admins** — run the gym: money, staff, members
- **App managers** — run the whole platform across many gyms

## How to log in

> Sign-in is gated until launch: `/login`, `/register` and `/forgot-password`
> redirect to `/launching-soon`. Set `VITE_AUTH_LAUNCHED=true` in the hosting
> environment to open the real screens.

Password for every account is **`kedemlife`**

| Who | Email |
| --- | --- |
| Member | `member@kedemlife.app` |
| Coach | `coach@kedemlife.app` |
| Admin | `admin@kedemlife.app` |
| App manager | `manager@kedemlife.app` |

You don't need to type these. Each login page has buttons that fill the form
for you.

## Suggested walkthrough (about 5 minutes)

**1. Start on the homepage**
Video plays behind the headline. Scroll down — programmes, testimonials,
questions. This is what a visitor sees before signing up.

**2. Log in as a Member** → click *App Login*, then the *Member* button
- **Dashboard** — next session, weight, step streak
- **Progress** — weight, body fat, calories, steps, sleep. Switch kg/lb.
  Hover a chart to read exact numbers. Click *Show table* for the raw data.
- **Find a specialist** — pick a coach, dietitian, physio or doctor
- **Book a session** — pick a day and time, choose Zoom / Google Meet / phone,
  say what you want out of it, confirm. You get a join link.

**3. Sign out, log in as a Coach** → *Coach* button on the instructor page
- Same calendar, but from the other side — you see the members
- **Orders** — the programmes they sold, and where each order is up to

**4. Sign out, log in as an Admin**
- Money in, fees, what's left
- Failed and disputed payments flagged at the top
- How many member seats the gym has used

**5. Shop** — add something to the basket, go to checkout

## Things worth pointing out

**Everyone sees only what they should.** A member who tries to open an admin
page gets sent back. Even the login pages are separate — member details won't
work on the admin login, even with the right password.

**It's fast.** The homepage is about 131 KB. Most sites are several times that.
Pages load only when you actually visit them.

**It works on a phone.** Try it. Tables turn into cards instead of scrolling
sideways, and the background video doesn't download at all on mobile — no
reason to spend someone's data on decoration.

**The data is fake, for now.** Everything runs in the browser with sample data,
so the site works before the backend exists. When the .NET API is ready, one
setting switches it over. No screens need rewriting.

## If someone asks

**"Can it handle real numbers of users?"**
The website part is just files on a CDN, which scales on its own. The database
work sits behind the .NET API, which scales separately.

**"How long to make it real?"**
The screens are done. What's left is the backend: real accounts, a database,
and payments. The website already knows exactly what to ask the API for.

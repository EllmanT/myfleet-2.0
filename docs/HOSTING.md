# Hosting: two Vercel projects, one domain

The landing page (`marketing/`, Astro, static) and the app (`frontend/` plus the `api/` backend, React) are two separate Vercel projects from this one repo. They look like one product because they share a domain:

| Address | Project | Root Directory |
|---|---|---|
| `yourdomain.com` and `www.yourdomain.com` | marketing | `marketing` |
| `app.yourdomain.com` | app + API | repo root (the existing `vercel.json`) |

Why two: Astro and Create React App build differently, the landing page should stay static and fast, and a change to the app should not redeploy the site (or the other way round). The app already routes every path to its own `index.html`, so putting it under a subdomain needs no change to it.

## Set up (once)

1. Marketing project: Vercel, Add New Project, import this repo, set **Root Directory** to `marketing`. Framework Astro is detected, `marketing/vercel.json` does the rest.
   Environment variables (Production):
   - `PUBLIC_APP_URL` = `https://app.yourdomain.com`
   - `PUBLIC_SITE_URL` = `https://yourdomain.com`
   - `PUBLIC_WHATSAPP_NUMBER` = `263778115084` (this is also the built-in default)
2. App project: keep the existing one. Add the domain `app.yourdomain.com` under Settings, Domains.
3. Domain: add `yourdomain.com` to the marketing project and `app.yourdomain.com` to the app project. Vercel shows the DNS records to create.
4. Backend CORS: add `https://app.yourdomain.com` to `ALLOWED_ORIGINS` (the landing page makes no API calls, so it does not need to be listed).
5. Clerk: add `https://app.yourdomain.com` as an allowed origin/redirect, and move to the production Clerk instance on that domain.
6. Optional: redirect `www` to the bare domain in the marketing project's Domains settings.

## How the buttons connect

"Start free" opens `PUBLIC_APP_URL/sign-up`, "Sign in" opens `PUBLIC_APP_URL/login`. In local development the landing page falls back to `http://localhost:3000`.

## Why not one project / one path

Serving the app under `yourdomain.com/app` needs rewrites between projects, a `basename` in React Router and Clerk, and shared cookies, for no user-visible gain. A subdomain is what most SaaS products use.

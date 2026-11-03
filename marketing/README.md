# myfleet marketing site

A separate static site (Astro, no client JavaScript) for the myfleet landing page. It lives in this folder and shares no code with the app. Sign-up is a plain link to the app, and WhatsApp is the other call to action.

## Run it

```bash
cd marketing
npm install
cp .env.example .env     # then edit the values
npm run dev              # http://localhost:4321
```

## Build and check

```bash
npm run build            # writes dist/
npm run preview          # serves dist/ locally
npm run check:contrast   # WCAG contrast of every colour pair the page uses, light and dark
npm run check:size       # raw/gzip/brotli size per file type, plus the first-view estimate
```

## Change the words

All page copy is in `src/content/site.ts`. Layout is in `src/pages/index.astro` and `src/components/`.
Look for `TODO(owner)` and `TODO(lawyer)` comments in that file: they mark decisions the owner has not confirmed (the free-period split, the 24-hour first-invoice promise, support hours, VAT line, photo page limits, the founding-price lock). Nothing unconfirmed is shown on the page as fact. Two switches at the top of the file (`flags`) turn the founding-price lock and the Allea case-study rows on or off.
Stay inside the playbook (`docs/marketing/LANDING_PAGE_PLAYBOOK.md`, section 0.1): only promise what is built.

The Privacy and Terms pages are DRAFT outlines (also in `site.ts`, under `legal`), marked "Draft, pending legal review" and set to `noindex`. Do not run ads or take public sign-ups until a lawyer has approved real versions.

## Swap in real screenshots

Every screenshot is a labelled "Demo company" placeholder until you give it a file. In `src/content/site.ts`, find the entry in `shots` and change its `src` from `null` to a path, for example:

```ts
'who-owes': { ..., src: '/img/shots/who-owes.webp', width: 960, height: 600, ... }
```

Put the file in `marketing/public/img/shots/`. Keep `width` and `height` equal to the real pixel size so the page does not jump while loading. For AVIF/WebP add `sources: { avif: '/img/shots/who-owes.avif', webp: '/img/shots/who-owes.webp' }`. Use captures of the demo company only (invented data, no real clients, drivers or plates).

For the hero, a real photo of a dummy logbook page goes in the `photo` slot of `src/components/LogbookToInvoice.astro` (instructions are at the top of that file). Keep it under about 60 KB.

The Allea Worldwide Logistics logo is used only in the case-study section, on an ivory tile (`src/assets/allea-logo.png`). The testimonial stays an obvious placeholder until Allea gives written permission.

## Environment variables

Set these in `.env` locally and in Vercel (Project, Settings, Environment Variables). All are public, so never put secrets here.

| Name | Purpose | Default |
|---|---|---|
| `PUBLIC_APP_URL` | "Start free" goes to this + `/sign-up`; "Sign in" goes to this + `/login` | `https://app.example.com` |
| `PUBLIC_WHATSAPP_NUMBER` | Digits only, international format, no `+` (for example `263771234567`) | `263000000000` (placeholder) |
| `PUBLIC_SITE_URL` | Canonical URL, sitemap, robots | `https://myfleet.example.com` |
| `PUBLIC_PLAUSIBLE_DOMAIN` | Set to your domain to add the cookieless Plausible script. Empty means no analytics | empty |

The values are baked in at build time, so redeploy after changing them. The WhatsApp QR code is generated at build time as inline SVG (the `qrcode` package is a dev dependency and nothing from it reaches the browser).

## Deploy on Vercel as its own project

1. In Vercel, add a new project from this repo.
2. Set **Root Directory** to `marketing`. Framework preset: Astro (build `npm run build`, output `dist`).
3. Add the environment variables above.
4. Add your domain. The root `vercel.json` belongs to the app and is not used by this project.
5. Before launch: replace the placeholder WhatsApp number and app URL, get the legal pages reviewed, and decide the `TODO(owner)` items.

## Design notes

Ink and ivory with one deep emerald (light `#FAF8F3`/`#15140F`/`#0E5A43`, dark `#0E0E0C`/`#F3F0E8`/`#3FAF85`), Instrument Serif for headlines, Inter for everything else, both self-hosted (Latin subset, WOFF2). Light and dark follow the system. The hero sequence is CSS only, plays once, and shows a static final state under `prefers-reduced-motion`. The sticky mobile bar and scroll reveals use CSS scroll timelines where supported and are simply visible elsewhere.

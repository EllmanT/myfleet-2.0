# myFleet marketing page: design direction and build approach

Date: 2026-11-03. Status: research and recommendation, no code changed.

**Owner decisions (applied throughout):**
1. Launch prices are **$9 / $29 / $59 per month** for **1-2 / 3-10 / 11-25 trucks**. They are a test: show them on the page, and revise after the first 10-15 operator conversations.
2. Screenshots come from a **demo company with invented data**, not real customer data. Label them "Demo company" and keep the invented data plausible (real corridors and units are fine; no real client, driver or plate names).
3. The landing page is a **separate static marketing site**. Sign-up buttons go to the app; the other primary CTA is WhatsApp.

Method note. Eight pages were fetched on 2026-11-03 via WebFetch (a summariser, so typography and motion are mostly NOT visible to it). Anything marked **[unverified]** is inference or recalled knowledge and should be checked in a browser before it is relied on. Claims about the page weight of third-party sites are not measured.

---

## 0. Teardowns

Fetched and read: Linear, Fleetio, Samsara, Stripe, Vercel, Apple (MacBook Air), TruckingOffice, Wave. Recalled only, not fetched: Notion, Arc, Rigbooks, Zoho Books (all **[unverified]**).

### 1. Apple, MacBook Air (https://www.apple.com/macbook-air/)
- Layout: one long single column of full-width modules, each a big headline, one short paragraph, one visual. Fine print in footnotes at the bottom.
- Type: short sentence-case display lines ("Built to go places."), bold or italic on key phrases. Typeface not visible to the fetch; Apple uses SF Pro **[unverified]**.
- Imagery: hero product shot, lifestyle photos in cafes, planes and backpacks, UI screenshots in context. Start/end frame pairs imply scroll-driven sequences (inferred, **[unverified]**).
- Proof: footnoted technical claims, not testimonials.
- CTA: "Buy" plus quiet "Learn more" links.
- Copy: confident fragments, a little wordplay, benefits stated emotionally.
- Copy: one idea per screen, footnoted claims, real product in real places.
- Avoid: Apple's budget. Do not attempt frame-sequence canvas scrubbing on a 3G audience.

### 2. Linear (https://linear.app)
- Layout: announcement bar, product screenshot hero, logo strip, numbered "Fig 0.1" captions, feature blocks each with a real UI mockup, changelog list, quotes, closing CTA.
- Type: large headline, small caption labels, monospace for code. Faces not visible **[unverified]**.
- Imagery: almost entirely real-looking product UI; no stock people.
- Proof: "50,000 product teams", named quotes from OpenAI and Ramp staff.
- CTA: "Get started" primary, "Contact sales" secondary.
- Copy: the "Fig" captions (editorial, specimen-sheet feel), UI as the only imagery, a changelog on the page as evidence of a living product.
- Avoid: dark-mode-only glow aesthetic; it is now the most imitated look in SaaS and reads as templated.

### 3. Stripe (https://stripe.com)
- Layout: nav, hero with one primary and one Google sign-up CTA, logo strip straight under the hero, bento product tiles, stats band, case studies, developer section, closing CTA.
- Imagery: abstract gradient textures plus small product graphics; case-study photos of real storefronts and objects.
- Proof: hard numbers ($1.9T volume, 99.999% uptime), named case studies with metrics (Hertz, Le Monde).
- CTA: "Get started" and "Sign up with Google" side by side, which removes a step.
- Copy: stats with a precise unit, case studies with a specific number, social sign-up in the hero.
- Avoid: the gradient backgrounds (a major source of the "purple-blue" smell once copied).

### 4. Vercel (https://vercel.com)
- Layout: H1, three bullets, two CTAs, then three proof sections each led by a named customer stat, then three small "recently shipped" cards.
- Proof: customer metric as the section headline (Notion, Zapier, Mintlify).
- CTA: "Deploy now" with a no-account path (`vercel deploy --temporary`).
- Copy: proof as the section heading; a zero-friction first action.
- Avoid: jargon-dense hero copy ("Agentic Infrastructure"); myFleet's buyer is a haulier, not a developer.

### 5. Fleetio (https://www.fleetio.com)
- Layout: hero, review badges (Capterra, G2), logo strip, three stat cards, animated truck surrounded by labelled UI mockups, case study, rating grid, industries, closing CTA, mega-menu nav.
- Imagery: an animated truck with floating UI labels.
- Proof: concrete outcomes ("$280K+ repair spend avoided", "90+ minutes saved daily", "4.8/5 from 1,000+ reviews").
- CTA: "Book a Demo", "Start a Free Trial", "View Pricing". Pricing not on the page.
- Copy: outcome numbers tied to a named customer; a truck as a recurring motif.
- Avoid: the mega-menu and demo-gated pricing; stat cards in a row of three; a counter inconsistency the fetch noticed (1.3M vs 1M assets), a reminder that unsourced stats damage trust.

### 6. Samsara (https://www.samsara.com)
- Layout: hero, logo row, stats band, six-tab "In Action" section, customer carousel, awards, resources, closing CTA.
- Imagery: dark map UI, a worker reviewing a digitised form on a phone.
- Proof: 380k+ accidents prevented, G2 No. 1, case studies with dollar figures (El Paso $1.3M).
- CTA: "Check our prices", "See a demo".
- Copy: the digitised-paperwork-on-a-phone image is exactly myFleet's story at human scale.
- Avoid: enterprise logo walls (DHL, Home Depot) that myFleet cannot honestly match; tab-heavy sections.

### 7. TruckingOffice (https://www.truckingoffice.com)
- Layout: nav, masthead with phone number, integration diagram, TMS and ELD sections in triplets (Organize / Streamline / Maximize), guarantees, testimonials.
- Imagery: product diagrams and screenshots, no people photos.
- Proof: named owner-operator testimonials; popularity claim with no data.
- CTA: "Start Free Trial Today" repeated; "No credit card required"; phone number.
- Copy: the plain guarantees (no contracts, cancel anytime, free support), a visible phone number, a no-card trial.
- Avoid: shouty headline punctuation ("...Want To Win!"), triplet-of-nouns sections, unsupported "most popular" claims.

### 8. Wave (https://www.wave.com), Africa fintech
- Layout: minimal. Hero with price-promise headline, app screenshot, store badges, six features, two testimonials, French toggle.
- Imagery: one app screenshot, small headshots.
- Proof: two first-person testimonials with local specifics (paying a Woyofal electricity bill).
- CTA: app store badges only.
- Copy: the pricing promise in the headline ("Send for only 1%"), local bill names, language toggle, small honest testimonials with small headshots.
- Avoid: no sign-up path and no volume numbers; myFleet needs a conversion route.

### Recalled only **[unverified]**
- Notion and Arc: editorial pages, hand-drawn or illustrated characters, big friendly serif or quirky display type, tangible "made by people" tone. Copy: illustration with a point of view, long-form manifesto copy. Avoid: whimsy that undermines "paperwork you can trust".
- Rigbooks, Zoho Books: accounting-for-small-business pages leaning on feature grids, screenshots and "start free" CTAs. Verify before citing.
- Africa logistics/fintech pages beyond Wave (for example Lori Systems, Flutterwave, Moniepoint) were not fetched; treat as a follow-up.

### What the eight have in common
1. The real product is the main image. 2. A concrete number or named customer is the proof. 3. One primary CTA, repeated. 4. One idea per section. 5. Plain verbs in the headline. Only Apple and Linear feel "premium"; the trucking competitors feel like software catalogues. That gap is the opportunity.

---

## 1. AI-slop tells and alternatives

| Tell | Why it reads as generated | Use instead |
|---|---|---|
| Blurred gradient blobs and mesh glows behind the hero | Default output of every template | Flat warm-neutral paper colour; one real photo or a ruled "ledger" texture |
| Purple-to-blue gradient, gradient text on headlines | The 2023-25 AI palette | One ink colour, one signal colour (see palette) |
| Glassmorphism on every card, backdrop-blur nav only is fine | Depth with no meaning | Opaque surfaces, 1px hairline borders |
| Three identical feature cards with emoji or Lucide icons | Template skeleton | Alternating full-width rows, each with a distinct real visual and different layout |
| Generic stock people shaking hands or smiling at laptops | Signals no real customers | Real photos: a logbook page, a driver's hands, a truck at Beitbridge, with permission |
| "Supercharge your...", "Unlock the power of...", "Seamless", "Effortless", "All-in-one" | Filler verbs | Say the job: "Photograph the logbook. Get the invoice." |
| Everything centred, hero with centred H1 over a mock | Zero hierarchy decisions | Left-aligned, asymmetric 12-col grid, text hangs off a strong left edge |
| Over-rounded everything (24px+ radii, pills on everything) | Soft default | 2-6px radii; square-ish like paper and stamps; pills only for tags |
| Fake dashboards with lorem or "John Doe, $12,345" data | Instantly false | Real screenshots of a demo company seeded with plausible invented data (real corridors such as Harare to Lusaka, real units), captioned as demo; never real client data |
| Bento grid for its own sake | Stripe look copied everywhere | Use only if tile sizes carry meaning |
| Fake logos or "Trusted by 10,000+" | Dishonest | Only real clients, with permission; otherwise state truthful small numbers ("run on 1 fleet since 2025") |
| Fake 5-star testimonials with initials avatars | Fabricated | Real names, trucks, voice notes transcribed; or none |
| Sticky glowing "Get started free" with sparkles | AI-product trope | Plain solid button, WhatsApp icon only if it is WhatsApp |
| Looping particle backgrounds, floating 3D blobs | Decoration | Route-line motif that draws once on scroll |
| Uniform 8px-gap card grids with equal weight | No rhythm | Vary section heights; use a big-type "specimen" band between sections |
| Stats row of "10x faster" with round numbers | Marketing numbers | Honest, specific: "One logbook page: about 40 seconds to a draft invoice **[measure this]**" |
| Overuse of Inter + system sans, no secondary voice | Default | Serif display + grotesk body + mono for figures (see typography) |
| Emoji bullets and checkmark lists of 10 | Padding | Five lines max, each a concrete capability |

Rule of thumb: if you could swap the logo and the page still works for any SaaS, it is templated.

---

## 2. Recommended design direction

### Concept: "The paper trail"
Haulage in Southern Africa runs on paper: logbooks, border papers, delivery notes, fuel slips. myFleet's promise is that paper becomes clean records and invoices without retyping. The page is built like a well-kept ledger: ruled lines, stamps, route lines, tabular figures. Calm, exact, trustworthy. Apple's restraint (one idea per screen, large type, silence) applied to a trucker's world.

Tagline candidates (plain, no hype), pick after testing:
- "From logbook to invoice."
- "Your trucks, your borders, your paperwork. In one place."

### Grid and layout
- 12-column grid, 1200px max content width, 24px gutters mobile / 32px desktop.
- Left-aligned text spanning cols 1-6, visuals bleeding off the right edge. Alternate sides every section but never centre the H1.
- Generous vertical rhythm: 120-160px between sections desktop, 72px mobile. Spacing scale 4/8/12/16/24/40/64/96/144.
- Thin hairline rules (1px, ink at 12% opacity) between sections, with small mono section numbers ("01 Capture", "02 Check", "03 Invoice"), borrowing Linear's Fig captions.

### Typography (open, web-licensable, self-hosted)
- Display: **Fraunces** (SIL OFL, variable, optical size axis) for headlines, used at 400-500 weight, tight tracking. Alternative: Newsreader (OFL).
- Body and UI: **Inter** is the safe default but is the most "AI-looking"; prefer **Instrument Sans** or **Geist** (OFL) **[verify licences on Google Fonts / GitHub before use]**.
- Figures and paperwork labels: **JetBrains Mono** or **IBM Plex Mono** (OFL), with `font-variant-numeric: tabular-nums`.
- Scale (fluid with clamp): H1 clamp(2.5rem, 6vw, 5rem) at 1.02 line height; H2 clamp(1.75rem, 3.5vw, 3rem); body 1.0625rem / 1.6; caption mono 0.75rem uppercase, letter-spacing 0.06em.
- Max 2 families loaded at weights actually used (see performance).

### Palette (restrained, 4 working colours + 1 signal)
- Paper: `#F6F2EA` (warm off-white) page background.
- Ink: `#14181F` text and primary buttons.
- Road: `#2B3441` secondary surfaces / footer.
- Signal: one accent only, a warm amber `#D98A1C` or border-stamp red `#B5392B`; use for the CTA focus ring, route line and one highlight per screen. (Amber carries hazard/trucking associations; red reads as a customs stamp. Choose one, test contrast.)
- Rule: `#14181F` at 12% for borders.
- Contrast: ink on paper is above 15:1; check Signal on paper for non-text only unless it passes 4.5:1. Dark mode is optional; do not ship a dark landing page just because Linear did.
- Check against `docs/brand` logo drafts before locking.

### Photography and illustration
- Primary imagery is **real**: (1) a photographed handwritten logbook page, slightly angled on a dashboard or desk, natural light; (2) real app screenshots of the demo company (invented data, small "Demo company" caption) in a minimal device frame (a plain 2px ink border and 10px radius, not a glossy phone mockup); (3) a few honest photos of trucks and border queues, ideally from clients, with written permission.
- Treatment: warm, slightly desaturated, consistent crop ratios (3:2 and 4:5). No stock.
- Illustration: only line-based route maps (Harare, Beitbridge, Johannesburg, Lusaka, Durban, Walvis Bay, Maputo corridors as plain SVG polylines with city dots in mono labels). One stroke weight, Signal colour.
- Stamps and paper details (perforation edge, ruled line, stapled corner) as small SVG accents, not textures that add weight.

### Motion (calm; motion explains, never decorates)
Use CSS scroll-driven animations (`animation-timeline: view()`) with an IntersectionObserver fallback **[browser support is partial; verify on caniuse]**.
1. **Hero sequence (the signature moment):** the logbook photo sits on the right. As the page loads (not scroll-jacked), highlighted fields in the photo get a thin Signal underline one after another (date, route, km, fuel), then the photo slides 24px and crossfades into the invoice rendered as HTML/SVG with the same values. Total about 3.5 s, plays once, ends on the invoice. Reduced motion: show the invoice with the photo beside it, static.
2. **Route line:** an SVG path drawn with `stroke-dashoffset` tied to scroll progress through the "borders" section; city dots pop in with 120ms stagger.
3. **Reveals:** headline lines rise 12px and fade, 400ms, `cubic-bezier(0.22, 1, 0.36, 1)`, once per element, triggered at 20% visibility.
4. **Figures:** a tabular number may count up once, only if the number is real and short.
5. Button press: `scale(0.98)` 100ms; hover under 150ms. No hover-only information.

What NOT to animate: body text, the nav, anything on every scroll tick that triggers layout; parallax on photos; looping blobs or particles; cursor followers; carousels that auto-advance; scroll-jacking or frame-sequence canvases; number tickers on every stat; page-load spinners; animation of width/height/top/left (use transform and opacity only).

### Copy principles
Verbs and nouns of the job. Name things: "logbook", "border post", "invoice", "diesel slip", "trailer". Currency and units in local form (USD and ZAR, km, litres). One claim per sentence. No exclamation marks. Prices shown on the page (TruckingOffice and Fleetio hide or gate them; Wave states its price in the headline).

---

## 3. Performance and low-bandwidth rules (Southern Africa)

Assume a mid-range Android on 3G/4G with patchy data and costly megabytes. Targets are proposals **[unverified against local network data; test on a throttled "Slow 4G" profile and a real device]**.

- **Page weight budget:** first view (HTML, CSS, JS, fonts, hero image) under **150 KB transferred**; whole page under **500 KB** excluding on-demand video. JS under **30 KB gzipped** total (ideally 0-10 KB). CSS under 20 KB.
- **Lighthouse (mobile) targets:** Performance 95+, Accessibility 100, Best Practices 100, SEO 100. LCP under 2.0 s on throttled Slow 4G, CLS under 0.05, INP under 150 ms.
- **Images:** AVIF with WebP fallback and JPEG last, via `<picture>`; sizes 480/800/1200 wide with `srcset` and correct `sizes`; explicit `width`/`height` to avoid layout shift; hero image preloaded and `fetchpriority="high"`; everything below the fold `loading="lazy"` and `decoding="async"`. Hero photo target: 40-60 KB at 800 px wide. Consider a 20 px blurred LQIP only if tiny.
- **Screenshots:** export at 1x and 2x, WebP lossy quality ~75, crop to the relevant region; use SVG for diagrams and route maps.
- **Fonts:** self-host WOFF2 only, subset to Latin (plus Latin-Extended if needed), variable fonts only if smaller than static pair; `font-display: swap` with a metric-matched fallback (`size-adjust`) to avoid shift; preload only the display font that appears in the hero; max about 60 KB total font weight. No Google Fonts runtime request (privacy and an extra connection).
- **JS:** no framework hydration for the marketing page if avoidable; no animation library (CSS only); one tiny script for the sticky CTA, the WhatsApp number builder and analytics. No Lottie, GSAP, Three.js, Framer Motion on this page. Third-party scripts: analytics only, loaded `defer`.
- **Video:** poster-only until the user taps or until the section is in view on fast connections; honour `navigator.connection.saveData` and `effectiveType` (see section 7).
- **Caching and delivery:** static HTML on a CDN edge, `Cache-Control: public, max-age=31536000, immutable` for hashed assets, short for HTML; Brotli; HTTP/2 or 3. Vercel edge nodes in Europe/Africa cover Southern Africa adequately **[unverified latency; measure from Johannesburg and Harare]**.
- **Offline / slow behaviour:** page must be readable with JS disabled and images not yet loaded (alt text, background colour blocks, text-first layout). A small service worker caching the shell is optional; only add it if it stays under 5 KB and does not complicate deploys. Provide a "Save-Data" lighter mode: skip the hero animation and video, serve smaller images.
- **Dark patterns to skip:** cookie banner that blocks content (use cookieless analytics), chat widgets, pop-ups.

### WhatsApp-first conversion
Southern African haulage owners live on WhatsApp. Make it the primary CTA, with the sign-up as secondary.
- **Link format:** `https://wa.me/<E164 number without + or spaces>?text=<URL-encoded message>`. Example: `https://wa.me/263XXXXXXXXX?text=Hi%20myFleet%2C%20I%20run%20a%20fleet%20of%20__%20trucks%20and%20want%20to%20see%20how%20it%20works.` Use a real business number **[to be supplied]**. Prefill differs by button: hero ("I'd like a demo"), pricing ("Question about the <plan> plan"), border module ("Tell me about cross-border trips").
- **Sticky mobile CTA:** a bottom bar, 56px tall, safe-area-inset aware, containing "Chat on WhatsApp" (primary) and "Start free" (secondary). Appear after the hero scrolls out of view, not before; hide when the keyboard is open. Do not cover the footer legal links (add bottom padding).
- **Desktop:** most desktop visitors will not have WhatsApp Web open; show a QR code (static SVG generated at build time, encoding the same wa.me link) beside the button, with "Scan to chat on your phone". A QR should be an SVG, under 3 KB.
- **UTM tracking:** append the source to the prefilled text as a short tag ("ref: pricing") rather than UTM, since WhatsApp strips query parameters from the app side; record the click event in analytics.
- **Fallback:** a mailto and a phone `tel:` link for people without WhatsApp.
- **Secondary CTA:** "Start free" goes straight to Clerk sign-up (see section 4). Offer Google sign-in at the top (Stripe pattern).
- **Trust near CTA:** reply time ("We answer in the same working day"), price shown, no card, cancel anytime (TruckingOffice-style guarantees, only if true).

---

## 4. Technical recommendation: where to build it

### Situation (from the repo)
The app is a Create React App (react-scripts 5), MUI 5, Redux, Clerk (`@clerk/clerk-react`), deployed on Vercel from one root `vercel.json` that rewrites every non-`/api` path to `/index.html` (SPA). Backend is an Express serverless function at `/api`. One developer.

### Options
| | A. Route inside the CRA app | B. Separate Astro static site | C. Separate Next.js site |
|---|---|---|---|
| SEO | Weak: client-rendered, needs prerendering hacks; CRA is unmaintained | Excellent: static HTML | Good: static export or SSG |
| Speed | Poor: MUI + Redux + AG Grid bundle ships to the first-time visitor (large; measure with `source-map-explorer` **[unverified size]**) | Best: zero JS by default, islands only where needed | Medium: still ships the React runtime (~40-90 KB gz) **[unverified]** |
| Deploy simplicity | Easiest: already deployed | Easy: second Vercel project, same repo as a `marketing/` folder or a separate repo | Easy, same as Astro |
| Clerk sign-up sharing | Trivial, same origin | Link to `app.myfleet...` sign-up; for a seamless session use a shared parent domain; Clerk supports satellite or multi-domain setups **[verify on Clerk docs]**. A plain link is enough | Same as Astro; also Clerk has a Next.js SDK, but you do not need it on marketing |
| Analytics | Same PostHog or Plausible snippet | Same; easier to keep cookieless | Same |
| Maintainability, one dev | Marketing churn risks breaking the app; CRA build is heavy | Separate concerns, simple `.astro` files, content in Markdown; low framework surface | More framework to maintain for no benefit |
| Design control | Fights MUI theme and global CSS | Full control, own CSS | Full control |

### Recommendation (confirmed by owner decision 3): **Option B, a separate Astro static site** at the apex domain (`myfleet.<tld>`), with the app staying at `app.myfleet.<tld>` (or `/app`).
Reasons:
1. The visitor's first impression is dominated by load time on poor networks; Astro can ship essentially zero JS, which CRA cannot.
2. SEO needs real HTML for crawlers; CRA does not provide it.
3. Marketing changes weekly; they should not trigger or risk the app's build (which already needs an 8 GB heap in `vercel.json`).
4. One developer can run Astro easily: pages are plain HTML-like files, CSS is scoped, images are optimised by `astro:assets`, and there is no state management.
5. The Clerk sign-up is just a link (`https://app.<domain>/sign-up?utm...`); no shared code required. Keep brand tokens (colours, fonts) in a small shared CSS file copied or published later if needed.

Implementation notes:
- Repo layout: new `marketing/` folder in this repo (monorepo, one PR), second Vercel project with Root Directory `marketing`. Keep the root `vercel.json` unchanged for the app.
- Domain switch: point the apex to the marketing project, the app to a subdomain; update Clerk allowed origins and redirect URLs **[plan this carefully; it is the one risky step, since existing users hit the app at the current URL]**. A staged alternative: launch marketing on `www.` first, keep the app at apex, then swap later.
- Analytics: **Plausible** (cookieless, around 1 KB script, no consent banner) for the marketing site **[verify script size and pricing]**; **PostHog** if product funnels from marketing to in-app events are wanted (heavier script, around tens of KB; load only after consent or on idle). Start with Plausible; add PostHog in the app, not on the marketing page.
- Forms: avoid forms; WhatsApp is the form.
- Content: Markdown/MDX for the changelog and a handful of pages (pricing, border-crossing guide, privacy). Blog is optional and a good SEO lever for "ZIMRA/SARS cross-border paperwork" style queries **[keyword demand unverified]**.
- Fallback if you refuse a second project: a `/` route in the CRA app that is code-split (`React.lazy`), has its own plain CSS, no MUI, and is prerendered with `react-snap` **[unmaintained; not recommended]**.

---

## 5. Accessibility and reduced motion

- WCAG 2.2 AA minimum across the page (target Lighthouse A11y 100 plus manual checks).
- `@media (prefers-reduced-motion: reduce)`: remove all transforms, route-line drawing and the logbook-to-invoice animation; show the final state statically; videos do not autoplay and show the poster with a play button.
- Provide the same information without motion: the hero must explain "logbook becomes invoice" in text and in a static side-by-side image.
- Colour contrast: 4.5:1 body, 3:1 large text and UI components; do not use Signal colour alone for meaning.
- Keyboard: skip link, logical focus order, visible focus ring (2px Signal outline with 2px offset), sticky bar must not trap focus or hide focused elements (`scroll-padding-bottom`).
- Semantics: one `h1`, ordered headings, landmarks (`header`, `main`, `nav`, `footer`), `lang` set; real `<button>` and `<a>`.
- Images: meaningful `alt` for logbook and screenshots that describes the content ("Handwritten logbook page showing Harare to Lusaka, 1,070 km"); empty alt for decoration.
- Video: captions or a transcript for any video with speech; no auto-playing audio; controls available; pause control for any motion over 5 s.
- Touch targets at least 44x44 px; zoom to 200 percent without loss; no horizontal scroll at 320 px.
- Do not rely on hover; QR code has an accompanying text link.
- Text spacing: allow user stylesheet overrides; use relative units.
- Test with NVDA or TalkBack and with a throttled connection.

---

## 6. Component inventory and wireframes

### Component inventory
- Layout: `Container`, `Section` (with hairline and mono number), `Grid12`.
- Navigation: `Header` (logo, 4 links max: Product, Borders, Pricing, Login; right side "Chat on WhatsApp"), `MobileMenu` (no JS, `<details>`), `Footer`.
- CTA: `WhatsAppButton` (prefill prop), `StartFreeButton`, `StickyMobileCta`, `WhatsAppQr`.
- Hero: `LogbookToInvoice` (static HTML/SVG, CSS-timed), `PosterPicture`.
- Content: `FigureCaption` (mono label), `FeatureRow` (alternating text/visual), `DeviceFrame` (screenshot), `RouteMap` (SVG with scroll-drawn path), `StatBand`, `PullQuote` (named, with real photo), `ComplianceChecklist`, `PricingTable` (3 plans, prices visible), `FaqList` (`<details>`), `Changelog`.
- Media: `Pic` (AVIF/WebP/JPEG with srcset), `LoopVideo` (poster, lazy, save-data aware), `VideoModal` (only if needed, native `<dialog>`).
- Utility: `Seo` (title, meta, JSON-LD `SoftwareApplication`), `Analytics`.

### Wireframes (desktop; mobile stacks to one column)

```
HEADER
+--------------------------------------------------------------------------+
| myFleet    Product  Borders  Pricing  Log in            [WhatsApp us]    |
+--------------------------------------------------------------------------+

01 HERO
+--------------------------------------------------------------------------+
| FIG 0.1  LOGBOOK -> INVOICE                                              |
|                                                                          |
| From logbook              +-------------------+   +------------------+   |
| to invoice.               |  [photo of paper  |-> |  INVOICE  #0412  |   |
|                           |   logbook, fields |   |  HRE-LUN 1,070km |   |
| Photograph the page.      |   underlined]     |   |  Total  USD ___  |   |
| Check the draft.          +-------------------+   +------------------+   |
| Send the invoice.                                                        |
|                                                                          |
| [Chat on WhatsApp]  Start free       (QR)  Scan to chat                  |
| Prices shown from $9/mo. No card.                                                   |
+--------------------------------------------------------------------------+

02 PROBLEM (editorial, one big sentence, no card)
+--------------------------------------------------------------------------+
| 02                                                                       |
| Your trips live in notebooks, WhatsApp photos and a spreadsheet.         |
| Every month someone retypes them.                                        |
+--------------------------------------------------------------------------+

03 HOW IT WORKS (3 steps as one horizontal ruled strip, not 3 cards)
+--------------------------------------------------------------------------+
| 01 Capture        | 02 Review            | 03 Invoice                    |
| photo of logbook  | fields pulled out,   | quote -> invoice -> payment   |
| (screenshot)      | you correct          | (screenshot)                  |
+--------------------------------------------------------------------------+

04 BORDERS (route line draws on scroll)
+--------------------------------------------------------------------------+
|  Harare o--------o Beitbridge o--------o Musina o------- Johannesburg    |
|  Trips across borders, trailers, and documents that expire.              |
|  [screenshot: trips + expiry list]                                       |
+--------------------------------------------------------------------------+

05 FEATURE ROWS (alternate sides; each has a different visual)
+--------------------------------------------------------------------------+
| Maintenance & tyres (text)            |  [screenshot in DeviceFrame]     |
| [screenshot]  |  Fuel & costs per trip (text)                            |
+--------------------------------------------------------------------------+

06 PROOF (only real)
+--------------------------------------------------------------------------+
| "quote in the owner's words"    Name, fleet, town    [real photo]        |
| 2 real figures with source line, e.g. "<n> trips logged since <date>"    |
+--------------------------------------------------------------------------+

07 PRICING (visible)
+--------------------------------------------------------------------------+
| 1-2 trucks $9/mo | 3-10 trucks $29/mo | 11-25 trucks $59/mo            |
| Launch prices; we may adjust them after early operator feedback.         |
| module toggles listed in plain words                                     |
+--------------------------------------------------------------------------+

08 FAQ  (<details>: data safety, offline, who owns the data, WhatsApp, export)

09 CLOSING CTA
+--------------------------------------------------------------------------+
| Send us one logbook page.  We'll show you the invoice.                   |
| [Chat on WhatsApp]   Start free                                          |
+--------------------------------------------------------------------------+
FOOTER (links, contact, privacy, small route-line motif)

MOBILE sticky bar (appears after hero):
+--------------------------------------+
| [ WhatsApp us ]   [ Start free ]     |
+--------------------------------------+
```

The "Send us one logbook page" closer is a low-friction offer and matches the product demo; confirm you can fulfil it operationally.

---

## 7. Embedding video cheaply

Decision order: (1) a static screenshot, (2) a short looping silent clip, (3) a Remotion-rendered clip, (4) a full video. Most sections should only need 1 or 2.

- **Format:** short looping screen recordings or Remotion renders, 3-8 s, no audio, 720p max (480 px wide for small insets), 12-15 fps for UI recordings, exported as **WebM (VP9 or AV1)** and **MP4 (H.264)** fallback. Target 100-300 KB per clip; reject anything above 500 KB. Remotion renders can be encoded with ffmpeg at CRF 32-36 **[tune per clip]**.
- **Markup:**
  ```html
  <video muted loop playsinline preload="none" poster="/img/flow.avif" width="960" height="540">
    <source src="/video/flow.webm" type="video/webm">
    <source src="/video/flow.mp4"  type="video/mp4">
  </video>
  ```
  Order WebM first only if smaller; Safari prefers MP4.
- **Lazy start:** `preload="none"`, poster as AVIF/WebP at 20-30 KB; a 10-line IntersectionObserver sets `src`/calls `play()` when 30 percent visible and pauses when off-screen. Skip autoplay when `prefers-reduced-motion: reduce`, `navigator.connection.saveData` is true, or `effectiveType` is `2g`/`slow-2g`/`3g` (then show poster with a "Play" button).
- **No iframes:** avoid YouTube or Vimeo embeds on the main page (hundreds of KB plus tracking); if a long walkthrough is needed, use a poster plus link that opens YouTube, or a facade that loads the iframe on click.
- **Remotion use:** best for the hero logbook-to-invoice story and the route-line maps because they are deterministic and re-renderable when the design changes. But the hero should be coded in HTML/CSS (cheaper, crisper, accessible text) and Remotion saved for social posts and WhatsApp status clips (which also drive conversions). Share the same design tokens.
- **Alternatives to video:** animated SVG, CSS sprite steps, or an animated WebP/AVIF sequence. Avoid GIF.
- **Accessibility:** loop should be decorative with an adjacent text equivalent; offer a pause control if over 5 s; transcripts for narrated clips.
- **Hosting:** put clips in the same CDN as the site (Vercel static). Keep repo size in check: store masters elsewhere; commit only the compressed outputs or use Git LFS **[decide]**.

---

## Open items to resolve before building
1. Real photos: a logbook page (with permission), 2-3 client or truck photos.
2. WhatsApp business number, reply-time promise, and who answers.
3. Prices are decided ($9/$29/$59, launch test); add a small "launch pricing" note and revisit after 10-15 operator conversations. Seed and maintain the demo company used for screenshots.
4. Domain plan and Clerk redirect changes.
5. Verify unverified items: font licences, scroll-driven animation support, analytics script sizes, regional CDN latency.
6. Competitor gaps: fetch Rigbooks, Zoho Books, Notion, Arc, and one more Africa logistics page (Lori, Flutterwave) in a real browser.

## Sources (fetched 2026-11-03)
- https://linear.app
- https://stripe.com
- https://vercel.com
- https://www.apple.com/macbook-air/
- https://www.fleetio.com
- https://www.samsara.com
- https://www.truckingoffice.com
- https://www.wave.com

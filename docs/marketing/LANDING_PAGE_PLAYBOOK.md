# myfleet landing page playbook

Status: working draft, 2026-11-03. Product name is written lowercase, **myfleet**. The wordmark in the logo and headers is **MYFLEET**.

How to use this file: Parts 1 to 4 are the strategy and the final copy. Parts 5 to 10 are tools (QA, prompts, screenshots, video, speed, tests). Anything in `[PLACEHOLDER - needs real data]` must be replaced with a real number, quote or photo before launch. If it cannot be replaced, delete the sentence. Never fill a placeholder with a guess.

---

## 0. Ground rules

### 0.1 What is actually built (the only things the page may promise)

Checked against `backend/config/modules.js`, `backend/services/aiImport/`, `backend/services/jobImport/` and `frontend/src/pages/deliverer/`.

| Capability | Built? | Where it lives (route) | Notes for copy |
|---|---|---|---|
| Local job logging (one row per leg, odometer in/out, driver, contractor) | Yes, core | `/add-job`, `/del-all-orders` | Always on |
| Excel import of vehicle logs, with preview and a decisions panel | Yes | `/add-job` (ExcelImportPanel) | Say "import your Excel logs" |
| Photo-of-logbook import for LOCAL vehicle logs, reviewed before saving | Yes (module `aiImport`) | `/add-job` (PhotoImportPanel) | Only the local leg log (driver, date, mileage out/in, from, to). Nothing saves until a person approves |
| Photo import of the cross-border ledger into trips | NOT built. Designed in `docs/AI_IMPORT_AND_CROSS_BORDER_SPEC.md` | none | Mark **coming soon** everywhere |
| Flags for doubtful numbers (hard to read, does not add up) | Yes, as designed in the review step | `/add-job` | No accuracy claims. The spec says handwriting accuracy is untested |
| Cross-border trips: route, cargo, price, border crossings, trip costs, margin | Yes (`crossBorder`) | `/del-trips` | Margin shows only when costs are in one currency |
| Horses and trailers as separate assets | Yes (`tractorUnits`) | `/del-vehicles`, `/del-trailers` | |
| Expiry reminders: Yellow Card, licences, permits | Yes | `/del-documents` | Reminders, not legal advice |
| Quotations to invoices to payments, partial payments | Yes | `/del-quotations`, `/del-invoices`, `/del-payments` | |
| "Who owes me" ageing (Not yet due, 1-30, 31-60, 61-90, 90+) | Yes | `/del-invoices` tab "Who owes me" | |
| "Not yet invoiced" report (local jobs and trips) | Yes | `/del-invoices` tab "Not yet invoiced" | |
| PDFs (pdfkit) | Yes | invoices, statements | Do not claim tax-authority compliance |
| Expenses, extra income (cash hires) | Yes | `/del-expenses` | |
| Fuel log with fuel-use check (OK / Check / Review) and "Copy WhatsApp summary" | Yes | `/del-fuel-log` | The check compares km per litre to what is normal for that truck. It does not prove theft |
| Profitability per truck and by month | Yes | `/del-profitability` | |
| Maintenance reminders, workshop records, tyre life and cost per km | Yes | `/del-maintenance` | |
| Revenue charts (daily, monthly, breakdown) | Yes | `/del-dash-revenue`, `/revenue-analytics/*` | |
| Per-company module toggles | Yes | `/del-modules` | New companies start lean |
| Sign-in with Clerk | Yes | `/login`, `/sign-up`, `/create-organization` | |
| Currency | USD only | | "Other currencies coming soon" |
| Payment of the subscription | Manual (EcoCash / bank) | | Say so plainly |
| GPS tracker integration | Not built | | Do not mention. Fuel procedure mentions trackers as separate hardware |
| Mobile app | Not built (web app) | | Say "works in your phone browser". Do not say "app" in the download sense |
| WhatsApp bot, automatic WhatsApp reminders | Not built | | Only "Copy WhatsApp summary" exists, and WhatsApp is how we talk to you |
| Tax / VAT compliance features | Not confirmed | | Say nothing. Accountant check is still open in SAAS_PLAN |

### 0.2 Hard rules for this page
1. No invented numbers, customer counts, testimonials or "results". Use the placeholder tag.
2. Anything not in the table above as "Yes" is either absent or labelled "coming soon".
3. No AI accuracy claims until measured on real pages (spec section 4.6). Promise the review step instead: "nothing is saved until you approve it".
4. Allea Worldwide Logistics is named only with written permission and a real quote. The logo file exists at `frontend/public/logos-clients/alleaworldwide-logo-removebg-preview.png`.
5. All screenshots use anonymised demo data (Part 7).
6. Pricing on the page must match what is actually billed. The prices below are suggested and unconfirmed.

### 0.3 Open decisions the owner must make before launch
- Final prices and band edges (suggested $9 / $29 / $59).
- Exact free period for each band (Part 4 proposes 1 month for 1-2 trucks, 2 months for 3-10, 3 months for 11-25).
- Whether the "first invoice in 24 hours" promise can be staffed (it is a manual concierge job at first).
- Whether the founding-member price lock for the first 30 fleets will really be honoured. If not, delete it.
- WhatsApp number, domain, support hours.
- Permission and quote from Allea.
- Whether data held outside Zimbabwe, and the AI provider's data terms, are acceptable to say anything about (SAAS_PLAN: check retention terms before promising anything).

### 0.4 Owner and research inputs applied to this playbook (added after review)

Sources: `docs/research/landing-page-design-direction.md` (design direction "The paper trail") and `docs/research/legal-and-compliance-notes.md`. The legal notes are research, not legal advice. Several items in them are marked UNVERIFIED, and a Zimbabwean lawyer must review the final wording (their section 9).

| Input | What it changes in the copy and briefs |
|---|---|
| Prices $9 / $29 / $59 for 1-2 / 3-10 / 11-25 trucks are the launch prices, shown as a launch test, to be revisited after the first 10-15 operator conversations | Pricing section now says so on the page. They are no longer called "suggested". Price changes need 30 days' notice (legal notes section 4) |
| Separate static marketing site, its own domain | "Start free" is a plain link to the app's sign-up (`/sign-up`, Clerk). WhatsApp is the other primary CTA. No app bundle on the marketing site. Framework choice is out of scope here (see the design direction doc, section 4) |
| Design direction "The paper trail": warm paper, ink, one signal colour; hero where a logbook photo turns into an invoice; left-aligned, asymmetric layout; ledger rules, route-line motif, section numbers; Fraunces + a grotesk + a mono for figures | Section briefs below follow it. Hero is the logbook-to-invoice sequence. No centred H1, no card grids, no gradients |
| Colour: coordinator's note said "ink and ivory with a deep green accent"; the design doc suggests amber or stamp-red as the signal colour | One accent only. Use deep green if that is the owner's choice (it matches the note), and check it passes contrast for buttons and links. Amber or red remain fallbacks. Decide once and update `docs/brand` |
| Screenshots come from a demo company with invented data, shown in simple device frames | Part 8 rules updated: caption "Demo company", minimal frame (2 px ink border, about 10 px radius), invented plausible data |
| Guarantee, free trial, AI-accuracy and testimonial wording follow the legal notes | See changes in Part 3 (FAQ 2, 4, 9, 10, 12, proof section), Part 4.4, and the upload notice in Part 5 |

Legal wording rules now applied (check every edit against these):
1. Free trial: state the length, that no card or payment details are needed, and what happens at the end. Do not charge automatically. Say "we will send an invoice".
2. At the end of the free period without a plan: the account becomes read-only for [30] days so data can be exported, then data is deleted per the Privacy Policy. The 30 days is a suggested default for a lawyer to approve.
3. Guarantee: say only what we will honour, with the exact period. No "100% accurate", "guaranteed", "unlimited".
4. AI: say the photo is sent to our AI provider, Anthropic (USA), to read the handwriting; the result is a suggestion; you review before anything is saved; it can be wrong. Show a one-line notice at the upload point. Quote retention as "up to 30 days at the provider" only after rechecking the model and terms in use.
5. No accuracy figure unless measured on real logbooks with the test log kept.
6. Invoices made in myfleet are business documents, not ZIMRA fiscalised tax invoices. Say so near the invoice screens, in the Terms, and in the FAQ.
7. Testimonials need written permission stating exactly what is published. Allea is the founder's own fleet: disclose that relationship every time it appears.
8. Prices state whether they include VAT. [PLACEHOLDER - needs real data: owner's accountant to confirm]
9. Privacy Policy, Terms and the sub-processor list are live before any public sign-up or ad.
10. Do not bulk-message numbers or add people to groups. WhatsApp outreach is opt-in and disclosed.

---

## 1. Research basis: Hormozi frameworks, summarised and applied

Sources are third-party summaries (not the books). Several summaries disagree on details, so treat the frameworks as thinking tools, not scripture. Summaries used: [ecomcrew on $100M Offers](https://www.ecomcrew.com/100m-offers-book-summary/), [Alex Hyett's notes](https://www.alexhyett.com/book-notes/100-m-offers/), [SuperSummary on $100M Offers](https://www.supersummary.com/100m-offers/index-of-terms/), [Blinkist](https://www.blinkist.com/books/100m-offers-en), [SuperSummary on $100M Money Models](https://www.supersummary.com/100m-money-models/summary/), [Shortform on $100M Leads](https://www.shortform.com/blog/?p=146297), [Glasp page for $100M Leads](https://glasp.ai/discover/book/B0CFDR3TYV). One search result claimed "30x conversion" for the framework. No source backs it. Do not repeat it.

| Idea (as summarised) | What it means for myfleet | Where it appears |
|---|---|---|
| Value equation: value rises with the dream outcome and the belief it will happen, and falls with waiting time and effort/sacrifice | Outcome: every trip billed and paid. Belief: show the real review step, a real case study, a guarantee. Time: first invoice fast. Effort: photo instead of typing, we help import | Part 4.2 |
| Grand Slam Offer: an offer so clear and strong that saying no feels silly, not a price fight | A named offer ("Every Trip Billed") with setup, bonuses, guarantee, free period | Part 4 |
| Starving crowd: pick a market with real pain, money, easy to reach, growing | Cross-border owner-operators on Beitbridge/Beira. Check table below | 1.1 |
| Naming: a name that says the result | "Every Trip Billed" | Part 4 |
| Guarantee: remove the buyer's risk, ideally with a specific condition | First-invoice promise + data export promise + no card | Part 4.4 |
| Bonuses: stack small, cheap-to-give, high-value extras that attack specific objections | Setup help, import of last month's photos, WhatsApp support, trip profit calculator | Part 4.3 |
| Scarcity that is real | Founding price locked for the first 30 fleets, only if true; limited onboarding slots per week, only if true | Part 4.5 |
| Lead magnets: a complete solution to a narrow problem, free, or a taste of the core offer | "Send one logbook photo, get an invoice back"; trip profit calculator | Part 2 section 9; Part 6 |
| Free trial / free-first-period as acquisition | Free first month(s), disclosed up front, no card | Part 4.4 |
| Core Four channels (summaries list warm outreach, cold outreach, free content, paid ads) | Warm: owner's own contacts. Content: demo clips, WhatsApp groups. Cold: only with disclosure. Paid: later, after the page converts | Part 10 |

### 1.1 Starving crowd check (fill honestly)

| Test | Evidence we have | Status |
|---|---|---|
| Massive pain | Owner's own problem: losing track of which trips were paid (spec section 2). Pain list from research: paper logbooks, unbilled trips, late payment, fuel leakage, border costs, USD/ZWG/ZAR confusion | Pain is sourced. Sizes are not: no numbers on the page |
| Purchasing power | Unknown. Pricing is untested ($9 to $59/month) | UNVERIFIED. Run the 10-15 interviews in SAAS_PLAN |
| Easy to target | WhatsApp load groups, TOAZ contacts, Beitbridge/Beira corridors | Plausible. No named group verified |
| Growing | No sourced figure | Do not claim. [PLACEHOLDER - needs real data] |

Kill rule: if after 15 interviews fewer than a handful say they would pay $9-$29 to fix unpaid-trip tracking, change the niche before spending on ads.

### 1.2 Classic direct-response rules applied
One goal (a free start or a WhatsApp chat). One CTA, repeated. Headline says who it is for and what they get. Specific beats clever. Proof near every claim. Handle objections in the order a sceptic raises them. Plain words at Grade 6 to 8 reading level. Mobile first (most visitors on a phone on mobile data). WhatsApp first because the audience already lives there.

---

## 2. The promise and the headline

### 2.1 The single promise
**Every trip you drive ends up on an invoice, and you can see who still owes you.**

Everything on the page supports that sentence. Features that do not (revenue charts, module toggles) go in the "and also" strip, not the hero.

### 2.2 Five headline options

Each one is plain English. None use revolutionise, seamless, unlock or "AI-powered".

| # | Headline | Subhead idea | Why it works | Risk |
|---|---|---|---|---|
| 1 | **Every trip billed. Nobody forgotten.** | For cross-border truck owners with 2 to 20 trucks. | Short, states the outcome, matches the offer name. Speaks to unbilled trips | "Nobody" is vague until the subhead names who |
| 2 | **Photograph the logbook. Get the invoice.** | Take a photo of your driver's logbook page. Check it. Bill the customer. | Concrete, visual, shows the mechanism in 6 words. Best for the demo-led version of the page | Only true for local leg logs today. Cross-border ledger photo is coming soon, so the subhead must say "local logbook" |
| 3 | **Stop losing money between the truck and the invoice.** | Trips done but not billed, billed but not paid. See both on one screen. | Names the real gap in the owner's words | Slightly abstract; "money" is generic |
| 4 | **Which trips are still unpaid? Know in 10 seconds.** | The "who owes me" list, by customer, by how late. | Starts with the question the owner asks every week. Specific | "10 seconds" is a claim; test it on real data before using, else say "on one screen" |
| 5 | **Your trucks do the work. Make sure you get paid for it.** | Trip records, invoices and payments for cross-border operators. | Warm, emotional, honest | Least specific; weakest on a skimming mobile screen |

Recommendation: ship **#1 as the headline** with the **#2 mechanism as the subhead's second sentence**, and A/B test #1 vs #2 vs #4 (Part 10). The final hero copy in Part 3 uses #1.

---

## 3. Section-by-section page spec with final draft copy

Page order follows SAAS_PLAN: hero, proof, problem, demo, how it works, offer, FAQ, repeated CTA. The order below is the build order top to bottom.

Global design brief (all sections):
- Follow the always-on skills: `ui-ux-pro-max` for palette/type/layout, `emil-design-eng` and `apple-design` for motion and polish, `impeccable` to reject generic AI-template looks. Run an `impeccable` audit before launch.
- Look and feel ("The paper trail", from the design direction doc): a well-kept ledger. Warm paper background, ink text, ruled hairlines, small mono section numbers ("01 Capture", "02 Check", "03 Invoice"), a route-line motif that draws once. Left-aligned text on a 12-column grid with visuals bleeding off the right edge; never a centred H1. Squarish corners (2 to 6 px). Opaque surfaces, no glass, no gradients, no blobs, no emoji icons, no three identical cards, no stock people.
- Type: display serif (Fraunces or Newsreader) for headlines, a plain grotesk for body (Instrument Sans or Geist), a mono (JetBrains Mono or IBM Plex Mono) with tabular figures for numbers and labels. Self-hosted WOFF2, Latin subset, two families at most, about 60 KB total (Part 10).
- Colour: ink and warm paper (about `#14181F` on `#F6F2EA`) plus ONE accent. Owner direction: a deep green accent. Use it for the primary button, the route line and one highlight per screen. Fallback accents: amber or stamp red. The accent must pass 4.5:1 wherever it carries text. Readable in bright sun on a cheap phone. Brand drafts: `docs/brand/myfleet-logo-drafts.html`.
- Real imagery only: a photographed dummy logbook page, screenshots from the demo company (labelled "Demo company") in a minimal device frame, route maps as plain SVG lines, and trucks on the Beitbridge/Beira roads from the owner's own camera with permission. No AI-generated trucks, no stock.
- Sticky bottom bar on mobile with the two CTAs (WhatsApp, Start free). Visible after the hero scrolls away.
- Motion: small and purposeful (reveal on scroll under 200 ms ease-out, the review-grid animation in section 5). Respect `prefers-reduced-motion`.

### Section 0: Top bar
**Purpose:** orient and give the CTA at once.
**Copy:**
- Wordmark: MYFLEET
- Links (desktop only): How it works · Price · Questions
- Right: `Chat on WhatsApp` (secondary) · `Start free` (primary)
**Design:** 56 px high, no mega menu. On mobile show wordmark and `Start free` only.

### Section 1: Hero
**Purpose:** in five seconds the right visitor knows: this is for me, this is what I get, this is what to do next.
**Copy:**
- Eyebrow: `For cross-border truck owners with 2 to 20 trucks`
- H1: `Every trip billed. Nobody forgotten.`
- Subhead: `myfleet keeps your trips, costs and invoices in one place. Photograph a driver's logbook page, check what it read, and bill the customer. See who still owes you, down to the day.`
- Primary button: `Start free - no card`
- Secondary button: `Send us one logbook photo on WhatsApp`
- Under the buttons (small): `Free for your first month if you run 1 to 2 trucks. 2 to 3 months for bigger fleets. We tell you the price now, and we never take a card.`
- Trust strip, only with real data: `Built by a working trucking family. In daily use at Allea Worldwide Logistics.` (needs Allea permission) `[PLACEHOLDER - needs real data: number of trips recorded, only if real]`
**Design/imagery brief:** text hangs off a strong left edge (columns 1 to 6). Right side (below the text on mobile): the signature sequence from the design direction. A real photo of the dummy logbook page sits at a slight angle. After the page loads (not scroll-jacked), the date, route, km and amount get a thin accent underline one by one, then the photo slides about 24 px and cross-fades into the invoice built in HTML/SVG with the same values. About 3.5 s, plays once, ends on the invoice, with a small "Demo company" caption. Reduced motion or Save-Data: show the invoice with the photo beside it, static. Do not use a mock dashboard with fake charts. The first image under 60 KB (AVIF/WebP), explicit width and height, `fetchpriority="high"`. A secondary small device-framed crop of the "Who owes me" table can sit lower in the hero on desktop only.

### Section 2: Proof bar (short, directly under hero)
**Purpose:** early credibility before the problem section.
**Copy (use only the lines that are true):**
- `Used every week to run our own family fleet, Allea Worldwide Logistics.` (disclose that it is the founder's own business; needs Allea written permission and must be true)
- `Made for Beitbridge and Beira routes: border crossings, trip costs and margin on every load.`
- `Nothing is saved from a photo until you approve it.`
**Design:** one line of three short facts with a small Allea logo (permission). No fake "as seen in" logos, no star ratings.

### Section 3: The problem, in the operator's own words
**Purpose:** make the visitor nod. Use their words, not ours.
**Rule:** these lines are drafted from the researched pain points, written as plausible owner talk. Before launch, replace each with a real line from an interview or WhatsApp group (with permission), or keep it as unattributed "what we hear". Never present them as named quotes.
**Copy:**
- H2: `Sound familiar?`
- `"The driver brought the logbook back. Half of it I cannot read."` (paper logbooks)
- `"I did the load three weeks ago. Did I invoice it? I honestly do not know."` (unbilled trips)
- `"He says he will pay Friday. It is now the next month."` (late payment)
- `"The fuel went in. The kilometres do not match. Nobody can say why."` (fuel leakage)
- `"Border fees, escort, parking. By the time I add it up, I do not know what I made on that trip."` (border costs)
- `"This one paid in USD, that one wants to pay in ZWG, the quote was in rand."` (currency confusion)
- Close: `None of this is about being bad at business. It is what happens when the paper lives in a cab, a notebook and three WhatsApp groups. The money you earned is just hard to see.`
**Design:** six short quote lines in a quiet two-column list, large type, no card boxes. Each line has a tiny tag in grey (`logbooks`, `unbilled`, `late pay`, `fuel`, `border costs`, `currency`). Behind or beside: a real photo of a messy logbook page, anonymised. Mobile: single column, no carousel.

### Section 4: How it works in 3 steps
**Purpose:** show it is simple and low effort (value equation: effort down).
**Copy:**
- H2: `Three steps. No training week.`
- Step 1: **Send what you already have.** `Photograph your logbook pages, or upload your Excel logs. We help you with the first batch.`
- Step 2: **Check it, then approve it.** `myfleet reads the page and marks anything it is not sure of in yellow or orange: hard to read, or the numbers do not add up. You fix it and approve. Nothing is saved before you do.`
- Step 3: **Bill it and see who owes you.** `Tick the trips, raise the invoice, send the PDF. Record payments, even part payments. The "Who owes me" list updates itself.`
- Footnote: `Cross-border ledger pages: reading them from a photo is coming soon. Today you add cross-border trips in a simple form, and it takes about a minute per trip.` (check the "minute" claim against real use before keeping it; otherwise delete it)
**Design:** three numbered steps, horizontal on desktop, vertical on mobile. Each step has one small real screenshot crop (Part 7: shots S2, S3, S5). Numbers in the display type.

### Section 5: The photo-to-invoice demo
**Purpose:** the "aha". Let them watch the main promise happen.
**Copy:**
- H2: `From a photo of the logbook to an invoice`
- Caption row under the animation: `1 Photo of the page` → `2 myfleet reads it` → `3 You check the yellow and orange cells` → `4 Approve` → `5 Tick the trips and invoice`
- Small print: `Demo uses made-up names and numbers. Reading handwriting is not perfect, which is why you check before anything is saved.`
- Button: `Try it with your own page`
**Design/imagery brief:** the single most important visual on the page. Either an autoplaying muted 12 to 20 second loop (under 600 KB, poster image, no autoplay on Save-Data) or a scroll-driven step animation using the real screenshots (S3, S4, S5, S6). Left: logbook photo with the same row highlighted. Right: the review grid showing one yellow cell and one orange cell with the reason on hover/tap ("mileage in is lower than mileage out"). Then a cut to Invoices, "Not yet invoiced", ticked rows, and the invoice PDF. Tapping a cell on mobile shows the reason in a small sheet. Make a still-image fallback for slow connections. This section uses the Part 8 video (60-90 s cut elsewhere, the short loop here).

### Section 6: Features grouped by outcome
**Purpose:** answer "what do I get" in the buyer's terms, not module names.
**Copy:**
- H2: `What you get`

**Get every trip billed**
- `Not yet invoiced`: `A list of jobs and trips that nobody has invoiced. Tick them and make one invoice.`
- `Quotations that become invoices` `Send a price first. When the customer says yes, turn it into an invoice in one step.`
- `PDF invoices` `Send a clean PDF from your phone.`

**Get paid, and chase the right people**
- `Who owes me` `Every customer, grouped: not yet due, 1-30 days late, 31-60, 61-90, 90+.`
- `Part payments` `Record what came in. The money goes to the oldest unpaid invoice first. Anything extra stays as credit.`

**Know what each trip really made**
- `Cross-border trips` `Route, cargo, price, border crossings and every trip cost, with the margin worked out.` (margin shows when costs share the trip's currency)
- `Profit per truck` `Income minus fuel, salaries and other costs, by month and by truck.`

**Keep the paper off the dashboard**
- `Photo and Excel import` `Bring in your logs without retyping them.`
- `Horses and trailers separately` `Pair any trailer with any horse on a trip.`

**Stay legal and on the road**
- `Expiry reminders` `Yellow Card, licences and permits, for trucks, trailers and drivers.`
- `Maintenance and tyres` `Service reminders, workshop records, and how much each tyre costs per kilometre.`

**Watch the fuel**
- `Fuel log with a weekly check` `Each truck is marked OK, Check or Review by comparing its kilometres per litre to what is normal for that truck. Then copy the summary into your WhatsApp group.`
- Note under it: `It points you to where to look. It does not accuse anyone.`

**Only what you need**
- `Switch parts on and off.` `New companies start with a short menu. Turn on fuel, trips or invoices when you are ready.`

**Coming soon** (grey, small): `Photo reading for cross-border ledgers` · `More currencies than USD` · `Online card/mobile-money payment for your subscription`
(only keep roadmap items that the owner has actually decided on; "More currencies" is in the brief, the other two are not decided, delete if unsure)

**Design/imagery brief:** group headings are the outcome in plain words, each with 2 to 3 rows, not 12 equal cards. One small real screenshot crop beside each group (rotate left/right, vary sizes) using shots S7 to S14. Icons only where they carry meaning; draw a consistent line-icon set, no emoji.

### Section 7: The offer stack (Every Trip Billed)
**Purpose:** show everything they get, in stack form, and make it feel like an easy yes. Full reasoning in Part 4.
**Copy:**
- H2: `The "Every Trip Billed" start`
- Intro: `You are not buying a login. You get this:`
- Stack (each line: what, then why it matters):
  1. `The myfleet app for your fleet size` - `Trips, invoices, payments, expenses, fuel, documents, maintenance. Switch on what you need.`
  2. `Free setup` - `We create your company, add your trucks and drivers, and set up your customers with you.`
  3. `Bonus: we import last month's logbook photos` - `Send them on WhatsApp. We bring them in, you check and approve. You start with real history, not an empty screen.`
  4. `Bonus: your first invoice, fast` - `Send a clear logbook photo on a working day and a draft invoice is ready for you to check within 24 hours.` (see guarantee; only if staffed)
  5. `Bonus: trip profit calculator` - `A simple sheet to work out what a cross-border load really earns after border fees and fuel.` ([PLACEHOLDER - needs real data]: build the calculator before listing it)
  6. `Bonus: WhatsApp support` - `Ask a question on WhatsApp, get a person.` (state hours: [PLACEHOLDER - needs real data])
  7. `Bonus: founding price locked` - `The first 30 fleets keep their starting price for as long as they stay.` (real scarcity only. Delete if not honoured. Show the real count left, updated by hand)
- Guarantee box, see Part 4.4.
- Button: `Start free - no card`
**Design:** a clean receipt-style list on a plain surface, not a "value $X,XXX" fake price tower. Do not show inflated "worth" figures. If showing value, use only real costs: for example the time saved can be stated only after measuring. Guarantee gets its own bordered block with a short title.

### Section 8: Pricing
**Purpose:** remove price fear; show it is by trucks, cheap, and clear about the free period.
**Copy:**
- H2: `Priced by how many trucks you run`
- Subhead: `Prices are in US dollars per month. The free period comes first. You pick after.`
- Launch-test note (show it, small but readable): `These are our launch prices. We are talking to operators now and may change them. If we do, you get 30 days' notice, and founding members keep theirs.` ("founding members keep theirs" only if the owner commits)
- VAT line: `[PLACEHOLDER - needs real data: prices include / do not include VAT]`
- Three plan blocks (launch prices, owner-decided, to be revisited after the first 10-15 operator conversations):

| Plan | Trucks | Price per month | Free period |
|---|---|---|---|
| Starter | 1 to 2 | $9 | First month free |
| Fleet | 3 to 10 | $29 | First 2 months free |
| Pro | 11 to 25 | $59 | First 3 months free |

- Line under the table: `Every plan includes all the features above. Photo import has a monthly limit of pages: [PLACEHOLDER - needs real data: pages per month per plan]. More than 25 trucks? Message us.`
- Disclosure (exact wording, repeated near every button, see Part 4.4):
  `Free for your first month (1-2 trucks) or first 2 to 3 months (3 trucks or more). We do not ask for a card. Before the free period ends we tell you. Then you choose: pay by EcoCash or bank transfer, or stop. We never charge you on our own; we send an invoice. If you stop, your account becomes read-only for 30 days so you can download your data. You can download it at any time.`
- Payment line: `Payment is by EcoCash or bank transfer for now. We send you the details by WhatsApp.`
- Currency line: `Prices and invoices are in US dollars. Other currencies are coming soon.`
**Design:** three plain columns (stacked on mobile), the middle plan lightly emphasised only if data later says it is the common choice. Truck-count selector ("How many trucks do you run?") that highlights the right plan is a nice-to-have, built without a framework. Show the free period as the first row, not as a footnote.

### Section 9: Proof / the Allea case study
**Purpose:** show it works in a real fleet. All content must be real. Structure only, until Allea gives numbers and permission.
**Structure and copy slots:**
- H2: `Built inside a working fleet`
- Disclosure line, always shown with this section: `Allea Worldwide Logistics is our founder's own family fleet. This is not an independent customer review.` Get Allea's written permission stating exactly what is published (name, quote, numbers, logo) and where. Any number must be true and reproducible from the app.
- Who: `Allea Worldwide Logistics, [PLACEHOLDER - needs real data: number of trucks, routes, years operating]`
- Before (their words): `[PLACEHOLDER - needs real data: how trips and payments were tracked before: paper ledger, Excel, WhatsApp]`
- What changed: `[PLACEHOLDER - needs real data: what they use now, for example photo import, trips, invoices, fuel log, which weeks they started]`
- Result: `[PLACEHOLDER - needs real data: one or two measured numbers, for example unbilled trips found in the first month, days to bill after delivery, with the date range and how it was measured]`
- Quote: `"[PLACEHOLDER - needs real data: a real sentence from the owner, with name, role, and written permission]"`
- Honest line that can be used now: `We built myfleet because we run trucks ourselves. The first version was for our own logbooks and our own unpaid invoices.` (true per the project facts; confirm wording with the owner)
- Button: `See what we see on a normal Monday` (opens the screenshot gallery or the video)
**Design:** a two-column "before / after" with a real anonymised screenshot, the Allea logo (with permission), the owner's photo if they agree. If numbers are not ready at launch, publish only the honest line and the photos, and hide the "Result" row. Do not publish an empty case study.

### Section 10: FAQ (12 real objections)
**Purpose:** answer the hesitations in the order a sceptical owner raises them. Short answers. Keep each under 60 words.
**Copy:**
1. **Is it really free? What is the catch?** `Yes. The first month is free if you run 1 to 2 trucks, and 2 to 3 months for bigger fleets. No card. After that you choose to pay or stop. Nothing is charged automatically.`
2. **What happens to my data if I stop?** `You can download your data as a file at any time. If you stop, your account becomes read-only for 30 days so you can take everything out, then it is deleted as set out in our Privacy Policy. You can also ask us to delete it sooner. [PLACEHOLDER - needs real data: export format; 30 days subject to lawyer approval]`
3. **I am not good with computers. Will my drivers and staff cope?** `If you can use WhatsApp, you can use the screens that matter. The driver does not need to log in. We do the first import with you, and you can ask on WhatsApp.` (check: confirm driver login is not required by design before keeping this line)
4. **Can it read my driver's handwriting?** `It reads many handwritten logbooks and shows its work. It marks what it is unsure of in yellow, and anything that does not add up in orange. Handwriting varies, so it can be wrong. You check and fix everything before it is saved.` (Never "most", "99%" or any figure until measured on real pages with a kept test log. Re-word to "many".)
5. **What if it gets a number wrong and I do not notice?** `It marks doubtful numbers, and nothing saves without your approval. You are still the last pair of eyes. The odometer check (mileage in lower than out, a break in the chain) catches many slips.`
6. **I use Excel. Do I have to start again?** `No. Upload your Excel vehicle logs and check the preview before saving. Anything it cannot match, such as a new driver or place, you decide.`
7. **Does it handle cross-border trips, trailers and Yellow Cards?** `Yes. A trip has a route, cargo, price, border crossings and trip costs, and shows your margin. Horses and trailers are separate. Yellow Card, licence and permit expiry dates give reminders. Photo reading of cross-border ledger pages is coming soon.`
8. **Which currencies?** `US dollars today. Other currencies are coming soon. If a trip's costs are in mixed currencies, the margin is not worked out for you, it is marked as mixed.`
9. **Are the invoices tax invoices? Will they work with ZIMRA?** `Invoices and quotations made in myfleet are business documents. They are not ZIMRA fiscalised tax invoices. If you must issue fiscal invoices, keep using your fiscal device or approved system for those. We are looking at a link to that system; it is not built.` (Wording from the legal notes. Do not say "compliant". Customers also only see the PDF you send them, with your company details; check PDF branding first.)
10. **Is my information safe? Who sees my photos?** `Each company sees only its own data, and you sign in through Clerk. Logbook photos you upload to photo import are sent to our AI provider, Anthropic (USA), to read the handwriting. Their terms say it is not used to train their models by default, and it is deleted within [up to 30 days - recheck terms and model before publishing]. You review everything before it is saved, and you can skip photo import and type or use Excel instead. [PLACEHOLDER - needs real data: backups and where data is stored, only what is verified]` Do not claim certifications. Link the Privacy Policy and the sub-processor list.
11. **How do I pay, and what if I cannot pay on time?** `By EcoCash or bank transfer, sent by WhatsApp. If a month is hard, message us before the due date and we will talk. [PLACEHOLDER - decision needed: grace policy]`
12. **Who are you, and will you still be here next year?** `We are a trucking family in Zimbabwe who built this for our own trucks first. [PLACEHOLDER - needs real data: founder name, photo, how long operating]. You can export your data any time, so you are never stuck.`
**Design:** native `<details>` elements, no JavaScript. First two open. Each answer ends with nothing salesy. A "Still not sure? Ask on WhatsApp" button beneath.

### Section 11: Final CTA
**Purpose:** catch the visitor who read everything.
**Copy:**
- H2: `Start with one logbook page.`
- Body: `Send us one photo on WhatsApp. We will show you what myfleet reads from it and what an invoice looks like. No card, no pressure.`
- Primary: `Send a logbook photo on WhatsApp`
- Secondary: `Start free`
- Small: `Free first month, no card. We tell you the price up front.`
**Design:** full-width band in the strongest brand colour with large type; the WhatsApp button uses the WhatsApp green only if contrast passes, otherwise brand colour with the WhatsApp glyph. Nothing else on screen competes.

### Section 12: Footer
**Copy:**
- MYFLEET wordmark. `myfleet is made in Zimbabwe for trucking operators in Southern Africa.`
- Links: WhatsApp · Email [PLACEHOLDER - needs real data] · Sign in · Terms [PLACEHOLDER - needs real data] · Privacy [PLACEHOLDER - needs real data]
- Small: `Prices are in US dollars. Product details can change. Last updated [date].`
**Design:** quiet, one row on desktop, stacked on mobile. Include the legal pages before running ads.

---

## 4. The Grand Slam offer: "Every Trip Billed"

### 4.1 One-line offer
`Start free. We help you bring in your logbooks, raise your first invoice within a day, and nothing costs you until you decide.`

### 4.2 Value-equation reasoning
Value is perceived as: (dream outcome x likelihood it will work) divided by (time until it works x effort and sacrifice).

| Lever | The buyer's worry | What we do about it | Proof we can show |
|---|---|---|---|
| Dream outcome (up) | "I want to know every trip is billed and who owes me" | Say exactly that: "Every trip billed. Nobody forgotten." Show Who owes me and Not yet invoiced screens | Real screenshots |
| Likelihood (up) | "Software never works for people like me" | Review-before-save; Allea case study; first-invoice promise; human on WhatsApp; export guarantee | Allea numbers [PLACEHOLDER - needs real data] |
| Time delay (down) | "It will take weeks to set up" | We import last month's photos; first invoice draft inside a day | Timed run on real pages, documented before launch |
| Effort and sacrifice (down) | "I have no time, my drivers will hate it" | Photo instead of typing; Excel import; setup done with you; no card; no contract | Shot of the import steps |

Weakest lever today: likelihood, because there are no outside customers yet. Fix it first with the Allea case study and the first 5 pilot fleets (Part 10).

### 4.3 Bonuses (each attacks one objection; all must be cheap for us to give)
| Bonus | Objection it kills | Cost to us | Can we deliver today? |
|---|---|---|---|
| We import last month's logbook photos | "I will have to retype everything" | Owner time, per fleet | Yes for local logs (manual help). Cross-border ledger pages: manual entry help, photo reading coming soon |
| First-invoice-in-24-hours | "It will take too long to see it work" | Owner time | Only if staffed. Cap the number per week |
| Trip profit calculator (simple sheet) | "I do not know my real margin" | One-off build | Not built yet. Build before listing |
| WhatsApp support | "Who do I call?" | Time | Yes |
| Founding price locked (first 30 fleets) | "Prices will go up" | Lower later income | Only if the owner commits |

Do not add a bonus we cannot deliver. Do not label bonuses with made-up dollar values.

### 4.4 Guarantee, free period and disclosure (exact wording)

**Free period (final wording, use unchanged on the page, in sign-up, and in WhatsApp):**

> Free for your first month if you run 1 to 2 trucks. Free for your first 2 months if you run 3 to 10 trucks, and your first 3 months if you run 11 to 25. We do not ask for a card or any payment details. We will tell you before your free time ends. Then you decide: pay by EcoCash or bank transfer, or stop. We never charge you on our own; we send you an invoice. If you stop, your account becomes read-only for 30 days so you can download your data, then it is deleted as set out in our Privacy Policy. You can download all your data at any time.

(Template follows the free-trial wording in the legal notes. The 30-day read-only period is a suggested default for the lawyer to approve. Photo import during the free period has a page limit; state it in the pricing section.)

(The 1 / 2 / 3 months split is a proposal in line with SAAS_PLAN "free first month for solo operators, 2-3 months for fleets". Owner to confirm.)

**Guarantee (three promises, keep them small enough to honour):**
1. `First-invoice promise.` `Send us a clear logbook photo on a working day. If you do not have a draft invoice to check within 24 hours, we add one extra free month.` (limit: one clear page per fleet, local log only, working days; staffing risk flagged)
2. `Your data is yours.` `Download everything as a file at any time. Ask us to delete it and we will.`
3. `No lock-in, no surprise bill.` `No card, no contract. The price on this page is the price you pay. If it changes, we tell you 30 days before, and founding members keep theirs.`

Do not promise "money back" for the free period because nothing is charged. Once someone pays, the legal notes suggest: `If you pay for a month and are not happy, tell us within 7 days of paying and we will refund that month in full.` Add that line only if the owner will honour it and a lawyer approves it. Do not promise accuracy percentages, "save X%", or "recover unpaid invoices". Do not use the words "guaranteed", "unlimited" or "100% accurate". Keep the word "promise" only for the first-invoice and data lines, which have exact limits.

### 4.5 Scarcity that is real
- Founding-member price locked for the first 30 fleets: show "Founding spots left: N of 30" only if N is updated truthfully. [PLACEHOLDER - needs real data]
- Weekly onboarding slots (for the manual concierge help): "We onboard 5 fleets a week so each gets proper help." Only if that is the real limit.
- Never use fake countdown timers, "only 3 left" that resets, or fake activity popups.

### 4.6 Naming check
"Every Trip Billed" says the result, in plain words, and matches the headline. Alternatives to test: "The Unpaid-Trips Fix", "Bill Every Load". Avoid names with "pro", "smart", "360".

### 4.7 Money-model notes ($100M Money Models, as summarised)
- Attraction offer: the free period and "send one photo, get an invoice back".
- Core offer: the band subscription.
- Later upsell candidates (not promised, not built): more AI pages, done-for-you data entry, extra currencies. Keep off the page until real.
- Watch the cash cost: each AI page has a cost (SAAS_PLAN estimates roughly $0.002 to $0.033 a page, an estimate). Cap free pages so the free period cannot cost more than the first month's price.

---

## 5. Microcopy

Rules: say what happens, in the user's words; the button names the action; errors say what to do next; no blame; no exclamation marks except real success.

### 5.1 Buttons and links
| Where | Copy |
|---|---|
| Primary CTA | `Start free - no card` |
| WhatsApp CTA | `Send a logbook photo on WhatsApp` |
| Short WhatsApp | `Chat on WhatsApp` |
| Sticky mobile bar | `Start free` and WhatsApp icon + `Chat` |
| Demo | `Try it with your own page` |
| Pricing | `Start free on Starter`, `Start free on Fleet`, `Start free on Pro` |
| Questions | `Still not sure? Ask us on WhatsApp` |
| Sign-in | `Sign in` |
| Loading state | `Starting...` (not "Please wait") |

### 5.2 WhatsApp prefilled messages (the `wa.me` link text)
- Hero: `Hi, I run [number] trucks and I want to try myfleet. I will send a logbook photo.`
- Question: `Hi, I have a question about myfleet before I start.`
- Pricing: `Hi, I have more than 25 trucks. What can you do for us?`
Keep each under 120 characters, plain, no emoji.

### 5.3 Sign-up form (Clerk page plus our first screens)
- Heading: `Start your free time`
- Fields: `Your name` · `Company name` · `Phone (WhatsApp)` · `Email` · `How many trucks do you run?` (1-2 / 3-10 / 11-25 / More)
- Helper under phone: `We use it only to help you set up and answer questions.`
- Helper under trucks: `This only decides your free period and price.`
- Under the button: `No card needed. Free for your first month (1-2 trucks) or 2 to 3 months (bigger fleets).`
- Consent line: `By continuing you agree to the Terms and Privacy notice.` [PLACEHOLDER - needs real data: legal pages must be live first]
- Hand-over: "Start free" opens the app's Clerk sign-up page (`/sign-up`) on the app domain, then `/create-organization`. Keep the same words on the button and the first app screen so it feels like one flow. After sign-up the first app screen offers "Send your first logbook on WhatsApp" and "Add a trip".
- Upload-point AI notice (shown at photo import, from the legal notes): `Photos you upload here are sent to our AI provider, Anthropic (USA), to read the handwriting. You review everything before it is saved. Learn more.`
- Near the invoice screens and on invoice PDFs' help text: `This is a business document, not a ZIMRA fiscalised tax invoice.`
- Button: `Start free`
- Success: `Welcome. Your free time has started. Want us to help bring in your first logbook? Message us on WhatsApp.`

### 5.4 Errors
| Case | Copy |
|---|---|
| Required field | `Please add your company name.` |
| Bad phone | `That phone number looks short. Please check it.` |
| Bad email | `That email does not look right. Please check it.` |
| Network drop | `No connection right now. Your work is not lost on this screen. We will try again when you are back online.` (only if true for that screen; else `We could not save. Check your connection and try again.`) |
| Upload too big | `That photo is too big. Try a smaller one or take it again closer to the page.` |
| Photo unreadable | `We could not read this page. Take the photo flat, in good light, with the whole table in view.` |
| Wrong file type | `We can use photos (JPG, PNG), PDFs, or Excel files.` (confirm accepted types against the importer) |
| Server problem | `Something went wrong on our side. Nothing was saved. Try again, or message us on WhatsApp.` |
| Over page limit | `You have used this month's photo pages. Excel import still works. Message us to add more.` |
| Doubtful cell (review grid) | `Hard to read - please check` / `Does not add up - mileage in is lower than mileage out` |

### 5.5 Empty states (in the app, and as landing-page screenshots)
| Screen | Copy |
|---|---|
| Invoices | `No invoices yet. Tick some finished trips under "Not yet invoiced" to make your first one.` |
| Who owes me | `Nobody owes you anything right now. Late invoices will show here.` |
| Not yet invoiced | `Every trip and job has been invoiced. Nicely done.` |
| Trips | `No trips yet. Add your first cross-border trip: route, cargo and price.` |
| Documents | `No expiry dates yet. Add a Yellow Card, licence or permit and we will remind you before it runs out.` |
| Fuel log | `No fill-ups yet. Fill a truck to full and record it here to start the weekly check.` |
| Maintenance | `No services recorded. Add a truck's last service so the next reminder is right.` |
| Photo import | `Drop a logbook photo here. You will check it before anything is saved.` |
| Profitability | `Profit shows once you have income and costs for a month.` |

### 5.6 Reminders and system messages (examples)
- Document expiry: `AAV 1234: Yellow Card runs out on 14 Dec. Renew it before then.` (demo data only)
- Review done: `Imported 18 legs. 2 were skipped as private. Nothing else was changed.`
- Fuel check line: `AFO 0724: Check - 22% worse than normal. Ask the driver. This can be a heavy load.`

---

## 6. Copy QA checklist and the "sounds AI-written" list

### 6.1 Copy QA checklist (run on every section before it ships)
Truth
- [ ] Every feature mentioned is "Yes" in section 0.1, or labelled coming soon.
- [ ] No number, name, quote, count or result without a real source. Placeholders are marked.
- [ ] No claim about handwriting accuracy, fraud prevention, tax compliance, or legal outcomes.
- [ ] The free-period wording matches Part 4.4 word for word where it appears.
- [ ] Prices match what is billed today.
- [ ] Allea is named only with permission.

Clarity
- [ ] A stranger on a phone can say who it is for and what to do after 5 seconds on the hero.
- [ ] One goal per section. One primary button per screen.
- [ ] Headlines say the result, not the category.
- [ ] Grade 6 to 8 reading level (check with a free readability tool). Sentences mostly under 18 words.
- [ ] No jargon: no "platform", "solution", "end-to-end", "workflow", "streamline", "leverage". Use "tool" or "the app", "steps", "save time" only when measured.
- [ ] Every claim sits next to its proof (screenshot, caption, case study).
- [ ] Specific nouns: "Yellow Card", "Beitbridge", "EcoCash", "logbook", not "documents", "borders", "payments".

Persuasion
- [ ] The value equation: outcome, belief, speed, effort are each addressed on the page.
- [ ] Each objection in the FAQ has a real answer, including the awkward ones.
- [ ] Scarcity is real and shown with a true number, or removed.
- [ ] Risk reversal is visible near every button (no card, free period, data export).

Voice and polish
- [ ] Sounds like the owner talking to another owner. Read it out loud.
- [ ] Variation in sentence length. No three-item lists in every paragraph.
- [ ] No exclamation marks, no emoji, no all-caps except the MYFLEET wordmark.
- [ ] Product name written `myfleet` in body text, MYFLEET only as the wordmark.
- [ ] Spelling consistent (British/Zimbabwean English: "colour", "organise", but keep "licence" as a noun and "license" as a verb).
- [ ] Dates and amounts: `14 Dec`, `$29`, `USD` (not `US$29.00`).
- [ ] Alt text on every image; button labels make sense out of context.

Mobile
- [ ] Every line reads well at 360 px wide. Buttons at least 44 px high. No text in images.

### 6.2 Words and phrases that make copy sound AI-written, and what to write instead
| Avoid | Write instead |
|---|---|
| revolutionise, transform, reimagine | (just say what changes) "bill every trip" |
| seamless, effortless, frictionless | "easy", or show the 3 steps |
| unlock, unleash, empower | "get", "let you", "so you can" |
| AI-powered, cutting-edge, state-of-the-art | "reads a photo of the page" |
| game-changer, next-level, best-in-class | delete; give the fact |
| leverage, utilise | use |
| streamline, optimise your workflow | "save steps", "stop retyping" |
| all-in-one platform, comprehensive solution | "one place for your trips, invoices and fuel" |
| in today's fast-paced world, in the ever-evolving landscape | delete the sentence |
| whether you are a ... or a ... | pick the one reader |
| take your business to the next level | "know which trips are paid" |
| robust, powerful, intuitive | show the screen |
| Not just X, but Y (repeated) | say Y once |
| em dash after every second clause, triple lists ("fast, simple, secure") | one clear sentence |
| "It's not about X. It's about Y." | state Y |
| delve, tapestry, testament, navigate the complexities | delete |
| ready to get started? Look no further | "Start free" |
| trusted by thousands | only with a real count, else cut |
| we're passionate about | say what you did, such as "we run trucks ourselves" |
| 100% accurate / zero errors | never; say "you check it before it saves" |
| peace of mind | the concrete: "you will know who owes you" |

Rule of thumb: if a sentence could appear on any software site, delete it or add a trucking detail (Beitbridge, logbook, Yellow Card, EcoCash).

---

## 7. Reusable LLM prompts (paste as is)

Fill each `[ ]` before sending. Always paste the "Context block" first, or include it in the system prompt.

### 7.0 Context block (paste at the top of every prompt)
```
You are writing for myfleet (lowercase; wordmark MYFLEET), a back-office web tool for small and mid-size trucking operators in Zimbabwe and Southern Africa. First niche: cross-border owner-operators and small fleets (2 to 20 trucks) on the Beitbridge and Beira corridors.

What is built and may be mentioned: local job logging; Excel import; photo-of-logbook import for local vehicle logs with human review before saving (flags hard-to-read and numbers that do not add up); cross-border trips (route, cargo, price, border crossings, trip costs, margin); horses and trailers as separate assets; Yellow Card, licence and permit expiry reminders; quotations to invoices to payments with part payments; "Who owes me" ageing; "Not yet invoiced" report; PDFs; expenses; fuel log with a fuel-use check (OK / Check / Review); profit per truck; maintenance reminders and tyre cost per km; per-company module switches; sign-in with Clerk. Currency is USD only today.
Coming soon (say "coming soon", never promise a date): photo reading of cross-border ledger pages; currencies other than USD.
Not built, never mention as available: mobile app in app stores, GPS tracker links, automatic WhatsApp messages, tax or VAT compliance features.

Offer: "Every Trip Billed". Free first month for 1-2 trucks, 2-3 months for bigger fleets, no card, disclosed up front. Launch-test prices $9, $29, $59 per month by truck band (1-2, 3-10, 11-25 trucks), to be revisited after 10-15 operator conversations; 30 days notice of changes. Payment by EcoCash or bank at first. Calls to action: WhatsApp and sign-up.

Hard rules: never invent statistics, customer counts, testimonials, results or accuracy figures. Where a real number or quote is needed, write [PLACEHOLDER - needs real data]. Plain English, Grade 6 to 8, short sentences, specific trucking nouns. Banned words: revolutionise, seamless, unlock, empower, AI-powered, leverage, streamline, game-changer, robust, cutting-edge, platform, solution, delve. No emoji. No exclamation marks. No claims of 100% accuracy.
```

### 7.1 Alternate headlines
```
[Context block]

Task: write 15 landing page headlines for myfleet, in 3 groups of 5: (a) outcome-first, (b) question-first, (c) mechanism-first (photo of logbook becomes invoice). Each headline max 9 words. Then a subhead (max 25 words) for each. Mark which of the 15 you would test first and why in one sentence each, for the top 3 only.
Reader: [owner of 3 trucks, Harare to Johannesburg, keeps a paper ledger].
Goal of page: get a WhatsApp message or a free sign-up.
Do not repeat the same opening word more than twice. Do not reuse these existing headlines: "Every trip billed. Nobody forgotten.", "Photograph the logbook. Get the invoice."
Output as a table: group, headline, subhead.
```

### 7.2 Section copy in the owner's voice
```
[Context block]

Voice sample (the owner, a trucking operator talking to another operator): [PASTE 150 to 300 words the owner actually wrote or said, such as a WhatsApp voice note transcript].

Task: write the "[SECTION NAME, such as problem section / how it works / pricing]" section for the landing page.
Facts you may use: [PASTE the relevant bullets from LANDING_PAGE_PLAYBOOK Part 3].
Match the voice sample: sentence length, how direct it is, any local phrases. Do not add features or numbers that are not in the facts. Use [PLACEHOLDER - needs real data] where a real figure is needed.
Return: the final copy, then a list of every claim in it with the fact it came from.
```

### 7.3 FAQ answers
```
[Context block]

Task: answer this objection from a trucking operator in 40 to 60 words, in plain English, honestly. Start with the direct answer (yes, no, or not yet), then the reason, then one next step. If the true answer is "not built yet" or "we do not know", say so and say what we can do.
Objection: "[PASTE OBJECTION, such as 'Will my drivers have to learn another app?']"
Facts you may use: [PASTE any specific facts].
Also return: (1) one shorter version for a WhatsApp reply (max 280 characters); (2) a note listing anything in the answer that must be verified before publishing.
```

### 7.4 WhatsApp replies
```
[Context block]

Task: write a WhatsApp reply to this message from a prospect. Tone: friendly, direct, one person to another, no marketing words. Max 5 short lines. End with one clear next step (usually: send one logbook photo, or reply with your truck count). If they asked about price, state the band price and the free period exactly as: "Free for your first month if you run 1 to 2 trucks, 2 months for 3 to 10, 3 months for 11 to 25. No card. You decide when it ends."
Disclose that I built the tool if the prospect has not met me before.
Prospect message: "[PASTE MESSAGE]"
What I know about them: [name, trucks, route, anything else, or "nothing"].
Give 2 versions: one shorter, one warmer. Do not invent claims or results.
```

### 7.5 Ad variants
```
[Context block]

Task: write 8 Facebook or Instagram ad variants for myfleet aimed at cross-border truck owners in Zimbabwe. Four angles, 2 variants each: (1) unbilled trips, (2) who owes me, (3) photo of the logbook, (4) the free first month with no card.
Each: primary text max 300 characters, headline max 40 characters, button text from this list: "Send message", "Sign up", "Learn more". Link goal: WhatsApp for angles 1 and 3, sign-up for 2 and 4.
Rules: Facebook policy: do not assume personal traits ("Are you in debt?"), no before/after claims, no unproven results. No emoji. Plain words. Each ad names a real detail (Beitbridge, logbook, Yellow Card, EcoCash) only where it fits.
Disclosure: no testimonials unless I supply a real one.
Return a table: angle, primary text, headline, button, link goal, the one thing to check before running.
```

### 7.6 Rewrite any text to be plainer
```
Rewrite the text below for a trucking owner who reads English as a second language and reads on a phone. Rules: Grade 6 reading level; sentences under 15 words; one idea per sentence; active voice; concrete nouns; replace every abstract word with what it means. Remove these words: revolutionise, seamless, unlock, empower, AI-powered, leverage, streamline, platform, solution, robust, intuitive, comprehensive, ecosystem, workflow. Keep every fact. Do not add facts, numbers or promises. If a sentence makes a claim I cannot verify, keep it and tag it [VERIFY].
Then list: words you replaced and why (max 6 lines), and a Grade-level estimate.
Text: """[PASTE]"""
```

### 7.7 Bonus prompt: AI-smell check
```
Read the text below as a sceptical truck owner. Mark every phrase that sounds like generic software marketing or like AI wrote it. For each give a replacement that includes a concrete trucking detail or removes the phrase. Then list any claim that is not backed by a fact in this list: [PASTE facts]. Do not rewrite the whole text.
Text: """[PASTE]"""
```

---

## 8. Screenshot shot list

### 8.1 Rules
1. **Anonymised demo data only. Never real customer data.** Create a separate demo company ("Demo Haulage") in a separate database or tenant. Do not blur real data; replace it. Real names, phone numbers, registration plates, company names, invoice numbers, driver names, GPS positions and amounts must not appear, even blurred (blur can be reversed or leaks through resizing).
2. Demo names: invented customers ("Northgate Mining", "Kudzai Building Supplies"), invented drivers ("Driver A"), invented plates in an unissued format (check they do not match real plates), invented amounts that look plausible, round-ish and not Allea's.
3. If showing the Allea case study, use Allea's own data only with written permission, and still hide customers' names.
4. Logbook photos: use a hand-written dummy page produced for the demo, not a real driver's page. Handwriting is personal data.
5. No browser chrome with personal bookmarks, no tab titles, no email addresses, no Clerk user menu with a real email.
5a. Show every app screenshot in a simple device frame (2 px ink border, about 10 px radius, no glossy mock-up) with a small "Demo company" caption. Invented data may use real corridors and units (Harare to Beitbridge, litres, km) but no real client, driver, plate or company names.
6. Export at 2x, then resize to the width needed. Save as WebP (quality ~75), plus an AVIF if size is smaller. Strip metadata. Keep the originals in a private folder, not in the repo.
7. Keep a manifest: file name, date taken, which demo dataset, which page version.
8. Every screenshot is a true picture of the shipped app. No mock-ups of features that do not exist. A "coming soon" feature may only appear as text.

### 8.2 Demo data set (seed once, reuse for every shot)
- Company: Demo Haulage, USD.
- 6 trucks (4 horses, 2 rigids), 5 trailers, 6 drivers (Driver A to F).
- 8 customers, 4 contractors.
- 25 local legs across 3 trucks, with two deliberate odometer mismatches (for the orange flags) and one smudged value (for the yellow flag).
- 14 cross-border trips on Harare-Beitbridge-Johannesburg and Harare-Beira (not real loads), with border crossings and 4 to 6 cost lines each. One with mixed currencies is not needed; keep to USD.
- 12 invoices: 5 paid, 3 part paid, 2 current, 2 late (one 1-30, one 31-60), so that every ageing column has a value.
- 6 trips and 8 local jobs left uninvoiced.
- Fuel log: 4 weeks, three trucks, one Check and one Review.
- Documents: 3 expiring within 30 days, 1 expired, the rest fine.
- Maintenance: 2 services due, tyre fitments with cost per km.
- Expenses: salaries, insurance, services, one cash hire.

### 8.3 The shot list

| ID | Page (real route) | Demo data to show | Annotate | Crop | Feeds |
|---|---|---|---|---|---|
| S1 | `/del-invoices`, tab **Who owes me** | All ageing columns filled; two late customers; one large total | Arrow to "31-60" cell: "This customer is a month late." Circle Total owed | Table only, plus the tab row; 4:3 | Hero image (phone frame); Section 6 "Get paid"; social post "The one screen I check every Monday" |
| S2 | `/add-job` Photo import panel, before upload | Drop zone empty, with the dummy logbook photo beside it | Number 1 on the photo, label "Photo of the page" | Panel and photo; 16:9 | How it works step 1; demo section frame 1 |
| S3 | `/add-job` Photo import **review grid** | Rows read from the dummy page, one yellow cell, one orange cell, reasons visible | Callouts on yellow ("Hard to read") and orange ("Mileage in is lower than out"); a note "Nothing is saved until you approve" | Grid with 6 to 8 rows and the legend; keep image-beside-table if shipped | Demo section; How it works step 2; FAQ 4 and 5; ad angle 3; Social: "What yellow and orange mean" |
| S4 | `/add-job` Excel import preview with the decisions panel | A batch with 2 unmatched names resolved | Highlight the unmatched-name prompt | Panel only | FAQ 6; section 6 "Keep the paper off" |
| S5 | `/del-invoices`, tab **Not yet invoiced** | 6 trips and 8 local jobs listed, three ticked | "Tick the trips to bill"; count of trips selected | List and the action bar | Hero secondary image; Section 4 step 3; social post "Trips nobody billed" |
| S6 | Invoice detail and PDF (from `/del-invoices`) | Invoice with 3 trip lines, due date, one part payment | Label PDF button; show "Part paid" status | Invoice side and PDF preview side by side | Demo end frame; Section 6 "Get every trip billed" |
| S7 | `/del-quotations` | 3 quotes: sent, accepted, converted | Arrow "accepted - make invoice" | List with status chips | Section 6; social post on quotes first |
| S8 | `/del-trips` list and trip dialog | A Harare-Beitbridge-Johannesburg trip with cargo, price, border crossings, cost lines, margin | Circle the margin; label "border fees" | Trip dialog with costs section; 4:3 | Section 6 "Know what each trip made"; ad angle on border costs; social "What did that load really earn" |
| S9 | `/del-vehicles` and `/del-trailers` | Horse list and trailer list, assigned pair on a trip | Label "trailer is separate" | Two panes cropped together | Section 6 |
| S10 | `/del-documents` | 3 expiring soon (amber), 1 expired (red), list of Yellow Card / licence / permit | Circle the red row; label "reminder before it runs out" | Table with filters; make sure colour is not the only signal (text label) | Section 6 "Stay legal"; social "Yellow Card checklist" |
| S11 | `/del-fuel-log` | Weekly table with OK, Check, Review; the Copy WhatsApp summary button | Arrow to Review row: "Look here first"; button label | Weekly table + button; no private fill-ups | Section 6 "Watch the fuel"; social "Sunday fuel routine" (echoes FUEL_PROCEDURE) |
| S12 | `/del-profitability` | Revenue minus costs by month and by truck | Circle one truck with low profit | Chart + table | Section 6; social "Which truck pays?" |
| S13 | `/del-maintenance` | Two services due, tyre cost per km | Arrow: "Cost per km of this tyre" | List | Section 6; social "Tyre cost per km" |
| S14 | `/del-expenses` | Expense list with a cash hire row | Label "extra income too" | List only | Section 6 |
| S15 | `/del-modules` | A mix of switched-on and off modules; "coming soon" ones greyed | Label "Only what you need" | Modules list | Section 6 "Only what you need"; FAQ 3 |
| S16 | `/del-dashboard` or `/del-dash-revenue` | Revenue chart for 6 months of demo data | Light, no claims | Chart | "And also" strip only; low priority |
| S17 | Phone screenshots (real device) of S1, S5, S8 at 390 px wide | Same demo data | Minimal; device frame optional | Portrait | Hero, social, WhatsApp status posts |
| S18 | `/login` Clerk sign-in and sign-up | Demo email only | None | Form | Reassurance next to FAQ 10, never highlight the email |
| S19 | The dummy logbook page photo, flat, and one taken at an angle | Hand-written dummy page, ditto marks, "TOTAL" row, one overwritten digit | Number the columns | Full page | Section 3 problem image; demo section; social "Ever tried reading this?" |

Notes: the one real-app capture that needs special care is the logbook handwriting patterns listed in the spec (ditto marks, date written once, TOTAL rows, overwritten digits). Reproduce those on the dummy page so the demo is honest.

### 8.4 Social post feeds (quick map)
| Post idea | Uses |
|---|---|
| "The one screen I check every Monday" | S1 |
| "Trips nobody billed" | S5 |
| "What yellow and orange mean" (carousel, 3 slides) | S19, S3, S6 |
| "What did that load really earn?" | S8 |
| "Sunday fuel routine" (link to the free fuel checklist if published) | S11 |
| "Yellow Card runs out in 9 days" (reminder story) | S10 |
| "Which truck pays?" | S12 |
| "Send me one logbook photo" (lead magnet post) | S19 + S3 |

Every post has: one idea, one image, one CTA (WhatsApp). Disclose in the WhatsApp groups that you built the tool. Post twice a week at most; follow up at most 2 to 3 times (SAAS_PLAN).

---

## 9. Demo video storyboard (Remotion-friendly)

### 9.1 Technical frame
- Composition: 1920x1080 at 30 fps for the 60 to 90 s cut; 1080x1920 at 30 fps for the 15 s vertical.
- Build in Remotion as one `<Composition>` per cut, shared components for the logbook photo, the review grid and the invoice. Drive animations with `interpolate` and `spring`, no timers.
- Sources: S-series screenshots at 2x, plus the dummy logbook photo. Everything is from the real app. Do not animate fake UI that the app does not have; if the UI is recreated in React for smoothness, copy the real layout, labels and colours exactly.
- Captions burned in (many watch muted). Sans font, 40 px on 1080p, high contrast, max 2 lines.
- Voice-over optional. If used: the owner's own voice, calm, with plain-spoken lines below. Music: none or very quiet.
- Export: H.264 MP4, target under 6 MB for 60 s (around 800 kbps) and under 2 MB for the 15 s. Also export a WebM and a poster frame. Provide an animated WebP or a still for Save-Data users. Never autoplay with sound.
- Safe margins: 80 px (1080p), 120 px top and 220 px bottom on vertical (platform UI).
- Timing: ease-out 250 to 400 ms for entrances; cut hard between scenes; no slow zooms on text.

### 9.2 Long cut: 75 seconds (adjust within 60 to 90)

| Time | Scene | Visual | Caption / voice-over (draft) |
|---|---|---|---|
| 0-5 | Hook | Photo of a hand-written logbook page (dummy), a thumb flicks across it | "Half this page is hard to read. And somewhere in here is money nobody billed." |
| 5-12 | Problem | Quick montage: a notebook, a WhatsApp chat, a pile of papers; text overlay `Which trips are billed? Who has paid?` | "Most owners keep this in three places. So trips get forgotten." |
| 12-18 | Solution | MYFLEET wordmark; headline `Every trip billed. Nobody forgotten.` | "myfleet keeps your trips, costs and invoices in one place." |
| 18-30 | Photo to grid | Photo slides left; review grid builds row by row on the right; one cell goes yellow, one orange; hover reason appears | "Take a photo. myfleet reads it, and marks what it is not sure of." |
| 30-38 | Review | Cursor fixes the yellow cell; changes the orange value; presses `Approve`; text overlay `Nothing saves until you approve` | "You check it. You fix it. Then you approve." |
| 38-48 | Not yet invoiced | Tab `Not yet invoiced`; three rows tick; button `Invoice these trips` | "Every job and trip nobody has billed is on this list." |
| 48-56 | Invoice | PDF of the invoice slides in; `Send` | "Tick them. Make the invoice. Send the PDF." |
| 56-66 | Who owes me | Ageing table; a payment of part of an invoice is recorded; the number drops | "Record payments, even part payments. See who is late, and by how long." |
| 66-72 | Also | Quick 1.5 s inserts: trip margin, Yellow Card reminder, fuel check OK/Check/Review | "Border costs, expiry reminders and the fuel check are in there too." |
| 72-75 | CTA | WhatsApp icon and `Send us one logbook photo`; below `Free first month. No card.` | "Send us one page. We will show you." |

Rules: nothing on screen that is not in the real app. No claims like "saves hours" unless measured: if measured, add the real number with a caption `Measured at [PLACEHOLDER - needs real data]`.

### 9.3 Vertical cut: 15 seconds (1080x1920)

| Time | Visual | On-screen text (big, 2 lines max) |
|---|---|---|
| 0-2 | Close-up of dummy logbook page | `Can you read this?` |
| 2-5 | Page becomes a table; one cell flashes yellow | `myfleet reads it.` `You check it.` |
| 5-8 | Tap Approve; list `Not yet invoiced` appears, rows tick | `Then bill the trips.` |
| 8-11 | Invoice PDF flies in; ageing table fades in behind | `See who still owes you.` |
| 11-15 | Wordmark MYFLEET, button `Send a logbook photo on WhatsApp`, small `Free first month. No card.` | `Every trip billed.` |

Variants for testing: change the first 2 seconds (hook) only: (a) `Can you read this?` (b) `Did you bill that load?` (c) `Who still owes you?`.

### 9.4 Remotion project notes
- Folder suggestion (outside the app source): `marketing/video/` with `src/Root.tsx`, `src/scenes/*.tsx`, `src/components/{LogbookPhoto,ReviewGrid,InvoicePdf,Caption}.tsx`, `public/shots/*.webp`.
- Shared constants for brand colours, font, safe margins, and caption style so both cuts match.
- A `scenes.json` with durations in frames so edits to length are a data change.
- Render commands are the standard Remotion CLI (`npx remotion render`); check the current docs for flags before scripting.
- Review each render at 360 px wide on a real phone before publishing.

---

## 10. Page weight and speed rules (slow mobile data)

Targets (set, then measure on a real mid-range phone on throttled 3G/4G, with the Lighthouse mobile preset):
- First load (HTML, CSS, JS, fonts, hero image) under 150 KB transferred, compressed. Whole page under 500 KB before the video. JS under 30 KB gzipped, CSS under 20 KB, fonts about 60 KB total. Video loads only on tap. (Matches the design direction doc; both are proposals to test on a throttled Slow 4G profile and a real mid-range Android.)
- Lighthouse mobile targets: Performance 95+, Accessibility 100. Largest Contentful Paint under 2.0 s on throttled Slow 4G; Interaction to Next Paint under 150 ms; layout shift under 0.05.
- The hero sequence is CSS only (no animation library), skipped under Save-Data and reduced motion.
- Works with JavaScript off for the content (the FAQ, pricing and WhatsApp links need none).

Rules
1. **Static page.** Build the landing page as plain HTML and CSS (or a static generator). Do not ship the React dashboard bundle to visitors. The marketing site lives on its own path or domain, separate from the app.
2. **No framework runtime for content.** Only a few small vanilla scripts: truck selector, sticky bar, analytics.
3. **Images:** AVIF or WebP only. Hero image under 60 KB; other screenshots under 40 KB each; widths with `srcset` (360, 720, 1080). Always set `width` and `height`. `loading="lazy"` for everything below the fold, `fetchpriority="high"` on the hero image only. No background images used for content.
4. **Screenshots:** crop tight, quantise colour, and export at the displayed size x 2 at most. Text-heavy screenshots stay readable at 360 px, otherwise crop further instead of shrinking.
5. **Fonts:** system font stack first. If a brand font is used, one family, at most 2 weights, subset to Latin, WOFF2, `font-display: swap`, preloaded, self-hosted. Target under 40 KB total.
6. **CSS:** inline the critical CSS (about 10 KB), load the rest async. No CSS framework dumped in whole; purge unused rules.
7. **JS:** total under 30 KB compressed, deferred. No tag manager stack. One light analytics script (privacy-friendly, small) loaded after the page is interactive.
8. **Video:** muted, no autoplay on `Save-Data` or slow connection (`navigator.connection.saveData`, `effectiveType`), `preload="none"`, poster image under 30 KB, MP4 H.264 under 600 KB for the 15 to 20 s loop and under 6 MB for the 75 s cut. Also provide a captioned still sequence as the fallback. Host the long cut on a platform with adaptive streaming, linked from the page, not embedded at load.
9. **Third parties:** no chat widgets, social embeds, or web-font CDNs at load. WhatsApp is a plain `https://wa.me/` link.
10. **Network:** HTTPS, HTTP/2 or 3, Brotli/Gzip, long cache headers for hashed assets, a CDN with a point of presence near Southern Africa (verify before choosing; some providers are far from Zimbabwe), `<link rel="preconnect">` only for hosts really used.
11. **Data cost honesty:** show nothing that auto-downloads big files. Add a visible line near the video: `Video: about 5 MB. Watch on Wi-Fi if you can.` (state the real size).
12. **Offline and flaky networks:** keep the WhatsApp CTA a link to `wa.me` so it works through the WhatsApp app even when the browser tab stalls.
13. **Accessibility is performance too:** large tap targets, contrast AA+, no hover-only information, `prefers-reduced-motion` respected.
14. **Budget gate:** a build check that fails when the page goes over budget (a simple script that sums transferred bytes). Re-test after every new image.

---

## 11. A/B test list and what to measure

### 11.1 Before testing: instrumentation
Events to record (privacy-friendly, no personal data in the event): `page_view`, `scroll_50`, `cta_whatsapp_click` (with the section ID), `cta_signup_click` (with the section ID), `signup_complete`, `video_play`, `video_50pct`, `faq_open` (with question number), `pricing_view`, `truck_selector_used`. Track the first-touch source (UTM or the WhatsApp group/ad name).

### 11.2 Funnel metrics (in order)
1. Visitors (by source and device).
2. Reached pricing (scroll).
3. CTA click rate (WhatsApp and sign-up, separate).
4. WhatsApp conversations that got a real reply from the prospect (the real conversion; count by hand at first).
5. Sign-ups completed.
6. Activated: company set up AND first logbook or Excel import AND first invoice raised within 7 days.
7. Still active at the end of the free period.
8. Paid after the free period.
Report 1-8 weekly with the raw counts, not only rates. With small traffic, one visitor can change a percentage a lot.

Targets: set after the first 200 visitors. Do not copy benchmark numbers from other industries. [PLACEHOLDER - needs real data: baseline rates]

### 11.3 Sample size and honesty
- With low traffic (hundreds of visitors per week), only test big changes. Small wording tests need thousands of visitors. Check with a free sample-size calculator before declaring a winner.
- Run each test for at least two full weeks (weekday patterns) or until the sample size is reached. One change at a time. Do not stop a test early because it looks good.
- Primary metric for every test: WhatsApp conversations started plus sign-ups (combined as "leads"). Secondary: activation (step 6). A change that gets clicks but fewer activations loses.

### 11.4 Test list (priority order)

| # | Test | Variant A (control) | Variant B | Metric | Why |
|---|---|---|---|---|---|
| 1 | Headline | `Every trip billed. Nobody forgotten.` | `Photograph the logbook. Get the invoice.` (then #4 `Which trips are still unpaid? ...`) | Lead rate | Biggest lever; 3 different angles: outcome, mechanism, question |
| 2 | Primary CTA | `Start free - no card` + WhatsApp secondary | `Send a logbook photo on WhatsApp` as primary | Leads and WhatsApp-reply rate | WhatsApp-first hypothesis |
| 3 | Hero image | Ageing table screenshot (S1) | Real logbook photo turning into a table (S3) | Lead rate | Outcome vs mechanism picture |
| 4 | Free-period message | In the sub-subhead only | A large line right under the button | CTA click rate | Risk reversal prominence |
| 5 | Offer name | "Every Trip Billed" shown in the offer section | Not named; plain heading | Scroll to pricing, leads | Does naming help or add noise |
| 6 | Price display | Three bands, free period in first row | A truck selector that shows one price | Pricing view to CTA click | Reduce choice |
| 7 | Price level (careful, long test) | $9 / $29 / $59 | e.g. $12 / $35 / $69 (only with owner approval, and only for new visitors) | Sign-ups and paid-after-free rate | Price is untested (SAAS_PLAN). Measure paid conversion, not clicks |
| 8 | Free-period length | 1 / 2 / 3 months by band | Flat 1 month for all | Activation and paid-after-free | Long free periods may lower urgency |
| 9 | Problem section | Six quotes | Three quotes + one real photo | Scroll depth, leads | Shorter vs richer |
| 10 | Demo format | Autoplay muted loop | Static image sequence, tap to play | Lead rate and page weight/LCP | Speed vs interest |
| 11 | Proof | Allea case study high (under hero) | Case study lower (after offer) | Leads | Placement of proof |
| 12 | Guarantee wording | `First-invoice promise` as a box | In the FAQ only | Leads, support load | Whether the box earns its place |
| 13 | Scarcity | Founding spots left: N of 30 (if real) | No scarcity line | Leads, sign-up speed | Real scarcity effect |
| 14 | FAQ order | Objections 1-12 as listed | Handwriting and data safety first | FAQ opens, leads | Which fear matters most |
| 15 | Sticky mobile bar | On | Off | Mobile leads | Check it is not annoying |
| 16 | Form length | Name, company, phone, email, trucks | Phone and trucks only | Sign-up completion, activation | Fewer fields vs lower-quality leads |
| 17 | Ad creative (off-page) | Video hook `Can you read this?` | `Did you bill that load?` | Cost per WhatsApp conversation | Cheapest early lever, by hook |

### 11.5 Qualitative checks (do these every week alongside the numbers)
- Read every WhatsApp first message. Note the words prospects use. Put them back into the copy.
- Ask each new sign-up: "What nearly stopped you?" Add the answers to the FAQ.
- Watch five real people use the page on their own phones (screen share or in person) before launch and after each big change.
- Log every question that appears 3 times and turn it into an FAQ item.

### 11.6 Pilot plan before ads
1. Recruit 5 pilot fleets from warm contacts. Free, with permission to quote them if they agree and the results are real.
2. Import their last month, bill their first unbilled trips, record what changed with real numbers (trips found unbilled, days to bill). Get written permission to publish.
3. Publish these only as real case studies. Fill the Allea placeholders with the owner's real figures first.
4. Only then run paid ads.

---

## 12. Launch checklist (one page)
- [ ] Section 0.3 decisions made and written down.
- [ ] All `[PLACEHOLDER - needs real data]` replaced or deleted.
- [ ] Demo company seeded; all S-series screenshots captured and checked for any real data.
- [ ] Dummy logbook page made; photo import run on it for the demo.
- [ ] Allea permission, quote and numbers in writing (or the case study is hidden).
- [ ] Free-period wording identical on the page, sign-up and WhatsApp replies.
- [ ] Terms and Privacy pages published.
- [ ] Copy QA checklist passed; AI-smell list run (prompt 7.7).
- [ ] `impeccable` audit and a real-phone test at 360 px on slow data.
- [ ] Page weight budget passes.
- [ ] Analytics events firing; WhatsApp number tested from a phone that is not yours.
- [ ] A person is ready to answer WhatsApp within a stated time.

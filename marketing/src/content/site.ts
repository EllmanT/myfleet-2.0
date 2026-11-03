// ALL PAGE COPY LIVES HERE. Edit words in this file; layout is in src/pages and src/components.
// Source of truth for wording: docs/marketing/LANDING_PAGE_PLAYBOOK.md. Do not promise anything
// that is not "Yes" in its section 0.1 table.

// ---------------------------------------------------------------------------
// Switches the owner can flip without touching layout
// ---------------------------------------------------------------------------
export const flags = {
  // Playbook 0.3 / 4.5: only turn on if you will really honour it for the first 30 fleets.
  foundingPriceLock: false,
  // Playbook 0.4: show the Allea case-study structure rows (Who / Before / What changed).
  // The "Result" row stays hidden until there is a measured number and written permission.
  showCaseStudyStructure: true,
};

export const brand = {
  name: 'myfleet', // body text. The wordmark MYFLEET is the SVG in components/Wordmark.astro
  description:
    'Trip records, invoices and payments for cross-border truck owners. Photograph a driver logbook page, check it, bill the customer, and see who still owes you.',
  title: 'myfleet: every trip billed, nobody forgotten',
};

export const nav = {
  links: [
    { label: 'How it works', href: '#how' },
    { label: 'Price', href: '#price' },
    { label: 'Questions', href: '#questions' },
  ],
  whatsapp: 'Chat on WhatsApp',
  start: 'Start free',
  signIn: 'Sign in',
};

// ---------------------------------------------------------------------------
// WhatsApp prefilled messages (playbook 5.2). Plain text, no emoji, under 120 characters.
// ---------------------------------------------------------------------------
export const wa = {
  hero: 'Hi, I run [number] trucks and I want to try myfleet. I will send a logbook photo.',
  question: 'Hi, I have a question about myfleet before I start.',
  pricing: 'Hi, I have more than 25 trucks. What can you do for us?',
  // Shorter text for the QR code so the code stays small and easy to scan.
  qr: 'Hi, I want to try myfleet. I will send a logbook photo.',
};

export const cta = {
  primary: 'Start free - no card',
  whatsappLong: 'Send a logbook photo on WhatsApp',
  whatsappShort: 'Chat on WhatsApp',
  demo: 'Try it with your own page',
  stillNotSure: 'Still not sure? Ask us on WhatsApp',
  stickyStart: 'Start free',
  stickyChat: 'Chat',
};

// ---------------------------------------------------------------------------
// 1. Hero
// ---------------------------------------------------------------------------
export const hero = {
  eyebrow: 'For cross-border truck owners with 2 to 20 trucks',
  h1: 'Every trip billed. Nobody forgotten.',
  sub: "myfleet keeps your trips, costs and invoices in one place. Photograph a driver's logbook page, check what it read, and bill the customer. See who still owes you, down to the day.",
  // Playbook hero small print.
  small:
    'Free for your first month if you run 1 to 2 trucks. 2 to 3 months for bigger fleets. We tell you the price now, and we never take a card.',
  qrCaption: 'Scan to chat on your phone',
  figLabel: 'Fig 0.1  Logbook to invoice',
  demoCaption: 'Demo company. Made-up names and numbers.',
  logbookAlt:
    'A handwritten logbook page: driver, date, mileage out and in, from and to. Four fields are underlined, then the page turns into an invoice with the same values.',
};

// The values shown in the hero logbook and the invoice it turns into (invented, demo only).
export const demoTrip = {
  company: 'Demo Haulage (Pvt) Ltd',
  customer: 'Sample Foods Ltd',
  vehicle: 'AAV 1234',
  driver: 'T. Moyo',
  date: '04 Nov',
  from: 'Harare',
  to: 'Bulawayo',
  out: '184 210',
  in: '184 649',
  km: '439',
  invoiceNo: 'INV-0412',
  amount: '$620.00',
  rate: '$1.41 per km',
};

// ---------------------------------------------------------------------------
// 2. Proof bar. Only true lines. No ratings, no counts.
// ---------------------------------------------------------------------------
export const proof = [
  'Made by the family that runs Allea Worldwide Logistics, our own fleet.',
  'Made for Beitbridge and Beira routes: border crossings, trip costs and margin on every load.',
  'Nothing is saved from a photo until you approve it.',
];

// ---------------------------------------------------------------------------
// 3. Problem. Plausible owner talk, unattributed. Replace with real interview lines when you have them.
// ---------------------------------------------------------------------------
export const problem = {
  h2: 'Sound familiar?',
  quotes: [
    { tag: 'logbooks', text: 'The driver brought the logbook back. Half of it I cannot read.' },
    { tag: 'unbilled', text: 'I did the load three weeks ago. Did I invoice it? I honestly do not know.' },
    { tag: 'late pay', text: 'He says he will pay Friday. It is now the next month.' },
    { tag: 'fuel', text: 'The fuel went in. The kilometres do not match. Nobody can say why.' },
    { tag: 'border costs', text: 'Border fees, escort, parking. By the time I add it up, I do not know what I made on that trip.' },
    { tag: 'currency', text: 'This one paid in USD, that one wants to pay in ZWG, the quote was in rand.' },
  ],
  note: 'Everyday situations in small haulage businesses. Written as examples, not quotes from named people.',
  close:
    'None of this is about being bad at business. It is what happens when the paper lives in a cab, a notebook and three WhatsApp groups. The money you earned is just hard to see.',
};

// ---------------------------------------------------------------------------
// 4. Three steps
// ---------------------------------------------------------------------------
export const steps = {
  h2: 'Three steps. No training week.',
  items: [
    {
      n: '01',
      label: 'Capture',
      title: 'Send what you already have.',
      body: 'Photograph your logbook pages, or upload your Excel logs. We help you with the first batch.',
      shot: 'import',
    },
    {
      n: '02',
      label: 'Check',
      title: 'Check it, then approve it.',
      body: 'myfleet reads the page and marks anything it is not sure of in yellow or orange: hard to read, or the numbers do not add up. You fix it and approve. Nothing is saved before you do.',
      shot: 'review',
    },
    {
      n: '03',
      label: 'Invoice',
      title: 'Bill it and see who owes you.',
      body: 'Tick the trips, raise the invoice, send the PDF. Record payments, even part payments. The "Who owes me" list updates itself.',
      shot: 'who-owes',
    },
  ],
  // Playbook: the "about a minute" claim must be checked on real use. Left out until measured.
  footnote:
    'Cross-border ledger pages: reading them from a photo is coming soon. Today you add cross-border trips in a simple form.',
};

// Notice shown wherever photo upload is mentioned (legal notes 3.4 / 10.3).
export const aiNotice = {
  text: 'Photos you upload to photo import are sent to our AI provider, Anthropic (USA), to read the handwriting. The result is a suggestion and it can be wrong. You review everything before it is saved. Photo import is optional: you can type or use Excel instead.',
  link: 'How we handle this',
  href: '/privacy#ai',
};

// ---------------------------------------------------------------------------
// 5. Photo-to-invoice demo
// ---------------------------------------------------------------------------
export const demo = {
  h2: 'From a photo of the logbook to an invoice',
  captions: [
    'Photo of the page',
    'myfleet reads it',
    'You check the yellow and orange cells',
    'Approve',
    'Tick the trips and invoice',
  ],
  small:
    'Demo uses made-up names and numbers. Reading handwriting is not perfect, which is why you check before anything is saved.',
  yellowLabel: 'Yellow: hard to read, please check',
  orangeLabel: 'Orange: does not add up. Mileage in is lower than mileage out',
  // The review grid shown beside the logbook (invented demo rows).
  columns: ['Date', 'Driver', 'Out', 'In', 'From', 'To'],
  rows: [
    { cells: ['01 Nov', 'T. Moyo', '183 540', '183 972', 'Harare', 'Mutare'], flag: null as null | 'yellow' | 'orange', flagCol: -1 },
    { cells: ['02 Nov', 'T. Moyo', '183 972', '184 05?', 'Mutare', 'Harare'], flag: 'yellow' as const, flagCol: 3 },
    { cells: ['03 Nov', 'B. Dube', '184 410', '184 140', 'Harare', 'Gweru'], flag: 'orange' as const, flagCol: 3 },
    { cells: ['04 Nov', 'T. Moyo', '184 210', '184 649', 'Harare', 'Bulawayo'], flag: null, flagCol: -1 },
  ],
};

// ---------------------------------------------------------------------------
// Screenshots. Real demo-company captures where `src` is set; the rest are placeholders.
// To use a real image: set `src` to a path under /public (for example '/img/shots/who-owes.webp')
// and give `width` and `height` of the file. Nothing else changes.
// ---------------------------------------------------------------------------
export type Shot = {
  id: string;
  screen: string; // label in the frame's title bar
  alt: string;
  src: string | null; // <-- the one path to change
  sources?: { avif?: string; webp?: string }; // optional smaller formats
  width: number;
  height: number;
  columns: string[];
  rows: string[][];
  mark?: number; // row index to emphasise in the placeholder
  summary?: boolean; // render as an ageing summary instead of a table
};

export const shots: Record<string, Shot> = {
  import: {
    id: 'import',
    screen: 'Add job: bring in your logs',
    alt: 'Demo company: the import screen where a logbook photo or an Excel log is dropped in.',
    src: null,
    width: 960,
    height: 600,
    columns: ['Source', 'Status'],
    rows: [
      ['Logbook photo', 'Ready to read'],
      ['Excel vehicle log', 'Preview ready'],
    ],
    mark: 0,
  },
  review: {
    id: 'review',
    screen: 'Photo import: check before saving',
    alt: 'Demo company: the review step of photo import, with one yellow cell and one orange cell.',
    src: null,
    width: 960,
    height: 600,
    columns: ['Date', 'Driver', 'Out', 'In', 'To'],
    rows: [
      ['01 Nov', 'T. Moyo', '183 540', '183 972', 'Mutare'],
      ['02 Nov', 'T. Moyo', '183 972', '184 05?', 'Harare'],
      ['03 Nov', 'B. Dube', '184 410', '184 140', 'Gweru'],
    ],
    mark: 1,
  },
  'not-invoiced': {
    id: 'not-invoiced',
    screen: 'Invoices: Not yet invoiced',
    alt: 'Demo company: a list of finished trips nobody has invoiced yet, with tick boxes.',
    src: '/img/shots/not-invoiced.webp',
    width: 1280,
    height: 546,
    columns: ['Date', 'Route', 'Customer', 'Amount'],
    rows: [
      ['04 Nov', 'Harare to Bulawayo', 'Sample Foods', '$620.00'],
      ['05 Nov', 'Bulawayo to Harare', 'Sample Foods', '$540.00'],
      ['06 Nov', 'Harare to Mutare', 'Mock Timber', '$310.00'],
    ],
    mark: 0,
  },
  'who-owes': {
    id: 'who-owes',
    screen: 'Invoices: Who owes me',
    alt: 'Demo company: money owed, grouped by how late it is.',
    src: '/img/shots/who-owes.webp',
    width: 1280,
    height: 437,
    columns: ['How late', 'Invoices', 'Owed'],
    rows: [
      ['Not yet due', '4', '$1,240'],
      ['1 to 30 days', '2', '$860'],
      ['31 to 60 days', '1', '$420'],
      ['61 to 90 days', '0', '$0'],
      ['90+ days', '0', '$0'],
    ],
    mark: 2,
    summary: true,
  },
  documents: {
    id: 'documents',
    screen: 'Documents: expiry dates',
    alt: 'Demo company: Yellow Card, licence and permit expiry dates with reminders.',
    src: '/img/shots/documents.webp',
    width: 1280,
    height: 593,
    columns: ['Item', 'Belongs to', 'Runs out'],
    rows: [
      ['Yellow Card', 'AAV 1234', '14 Dec'],
      ['Operator licence', 'AAV 1234', '02 Mar'],
      ['Driver licence', 'T. Moyo', '19 Jan'],
    ],
    mark: 0,
  },
  fuel: {
    id: 'fuel',
    screen: 'Fuel log: weekly check',
    alt: 'Demo company: each truck marked OK, Check or Review by fuel use.',
    src: '/img/shots/fuel.webp',
    width: 1280,
    height: 624,
    columns: ['Truck', 'km per litre', 'Check'],
    rows: [
      ['AAV 1234', '2.9', 'OK'],
      ['AFO 0724', '2.2', 'Check'],
      ['ABC 5521', '2.8', 'OK'],
    ],
    mark: 1,
  },
};

// ---------------------------------------------------------------------------
// 6. Features grouped by outcome
// ---------------------------------------------------------------------------
export const features = {
  h2: 'What you get',
  groups: [
    {
      title: 'Get every trip billed',
      items: [
        { name: 'Not yet invoiced', text: 'A list of jobs and trips that nobody has invoiced. Tick them and make one invoice.' },
        { name: 'Quotations that become invoices', text: 'Send a price first. When the customer says yes, turn it into an invoice in one step.' },
        { name: 'PDF invoices', text: 'Send a clean PDF from your phone.' },
      ],
      note: 'Invoices and quotations made in myfleet are business documents, not ZIMRA fiscalised tax invoices.',
      visual: { kind: 'shot', id: 'not-invoiced' },
    },
    {
      title: 'Get paid, and chase the right people',
      items: [
        { name: 'Who owes me', text: 'Every customer, grouped: not yet due, 1-30 days late, 31-60, 61-90, 90+.' },
        { name: 'Part payments', text: 'Record what came in. The money goes to the oldest unpaid invoice first. Anything extra stays as credit.' },
      ],
      visual: { kind: 'shot', id: 'who-owes' },
    },
    {
      title: 'Know what each trip really made',
      items: [
        { name: 'Cross-border trips', text: 'Route, cargo, price, border crossings and every trip cost, with the margin worked out when the costs share the trip\'s currency.' },
        { name: 'Profit per truck', text: 'Income minus fuel, salaries and other costs, by month and by truck.' },
      ],
      visual: { kind: 'route' },
    },
    {
      title: 'Keep the paper off the dashboard',
      items: [
        { name: 'Photo and Excel import', text: 'Bring in your logs without retyping them.' },
        { name: 'Horses and trailers separately', text: 'Pair any trailer with any horse on a trip.' },
      ],
      visual: { kind: 'shot', id: 'review' },
    },
    {
      title: 'Stay legal and on the road',
      items: [
        { name: 'Expiry reminders', text: 'Yellow Card, licences and permits, for trucks, trailers and drivers.' },
        { name: 'Maintenance and tyres', text: 'Service reminders, workshop records, and how much each tyre costs per kilometre.' },
      ],
      visual: { kind: 'shot', id: 'documents' },
    },
    {
      title: 'Watch the fuel',
      items: [
        {
          name: 'Fuel log with a weekly check',
          text: 'Each truck is marked OK, Check or Review by comparing its kilometres per litre to what is normal for that truck. Then copy the summary into your WhatsApp group.',
        },
      ],
      note: 'It points you to where to look. It does not accuse anyone.',
      visual: { kind: 'shot', id: 'fuel' },
    },
    {
      title: 'Only what you need',
      items: [
        { name: 'Switch parts on and off', text: 'New companies start with a short menu. Turn on fuel, trips or invoices when you are ready.' },
      ],
      visual: { kind: 'none' },
    },
  ],
  comingSoonLabel: 'Coming soon',
  // Only roadmap items the owner has decided on (playbook section 6).
  comingSoon: ['Photo reading for cross-border ledgers', 'More currencies than USD'],
};

// ---------------------------------------------------------------------------
// 7. Offer stack
// ---------------------------------------------------------------------------
export const offer = {
  h2: 'The “Every Trip Billed” start',
  intro: 'You are not buying a login. You get this:',
  stack: [
    { what: 'The myfleet app for your fleet size', why: 'Trips, invoices, payments, expenses, fuel, documents, maintenance. Switch on what you need.' },
    { what: 'Free setup', why: 'We create your company, add your trucks and drivers, and set up your customers with you.' },
    { what: "Bonus: we import last month's logbook photos", why: 'Send them on WhatsApp. We bring them in, you check and approve. You start with real history, not an empty screen.' },
    // TODO(owner): the 24-hour promise is a manual concierge job. Confirm it can be staffed (playbook 0.3) or delete this line.
    { what: 'Bonus: your first invoice, fast', why: 'Send a clear logbook photo on a working day and a draft invoice is ready for you to check within 24 hours.' },
    // TODO(owner): hours not decided. Add support hours here once they are.
    { what: 'Bonus: WhatsApp support', why: 'Ask a question on WhatsApp, get a person.' },
    // Playbook 4.3 / 4.5: only if the owner commits. Controlled by flags.foundingPriceLock.
    ...(flags.foundingPriceLock
      ? [{ what: 'Bonus: founding price locked', why: 'The first 30 fleets keep their starting price for as long as they stay.' }]
      : []),
  ],
  // The trip profit calculator is NOT listed: it is not built yet (playbook 4.3).
  guaranteeTitle: 'Our promises',
  guarantee: [
    {
      title: 'First-invoice promise.',
      text: 'Send us a clear logbook photo on a working day. If you do not have a draft invoice to check within 24 hours, we add one extra free month. One clear page per fleet, local logbook only, working days.',
    },
    { title: 'Your data is yours.', text: 'Download everything as a file at any time. Ask us to delete it and we will.' },
    {
      title: 'No lock-in, no surprise bill.',
      text: `No card, no contract. The price on this page is the price you pay. If it changes, we tell you 30 days before${flags.foundingPriceLock ? ', and founding members keep theirs' : ''}.`,
    },
  ],
  button: 'Start free - no card',
};

// ---------------------------------------------------------------------------
// 8. Pricing
// ---------------------------------------------------------------------------
// TODO(owner): the 1 / 2 / 3 month split is a PROPOSAL (playbook 0.3 / 4.4). Confirm before launch.
// TODO(owner): VAT line (playbook: "prices include / do not include VAT") needs the accountant. Not shown until known.
// TODO(owner): monthly photo-page limit per plan is undecided. Not shown until known.
export const pricing = {
  h2: 'Priced by how many trucks you run',
  sub: 'Prices are in US dollars per month. The free period comes first. You pick after.',
  launchNote: `These are our launch prices. We are talking to operators now and may change them. If we do, you get 30 days' notice${flags.foundingPriceLock ? ', and founding members keep theirs' : ''}.`,
  plans: [
    { name: 'Starter', trucks: '1 to 2 trucks', price: '$9', free: 'First month free', cta: 'Start free on Starter' },
    { name: 'Fleet', trucks: '3 to 10 trucks', price: '$29', free: 'First 2 months free', cta: 'Start free on Fleet' },
    { name: 'Pro', trucks: '11 to 25 trucks', price: '$59', free: 'First 3 months free', cta: 'Start free on Pro' },
  ],
  perMonth: 'per month',
  includes: 'Every plan includes all the features above.',
  moreThan: 'More than 25 trucks? Message us.',
  moreCta: 'Message us',
  // Exact wording from playbook 4.4. Use unchanged.
  disclosure:
    'Free for your first month if you run 1 to 2 trucks. Free for your first 2 months if you run 3 to 10 trucks, and your first 3 months if you run 11 to 25. We do not ask for a card or any payment details. We will tell you before your free time ends. Then you decide: pay by EcoCash or bank transfer, or stop. We never charge you on our own; we send you an invoice. If you stop, your account becomes read-only for 30 days so you can download your data, then it is deleted as set out in our Privacy Policy. You can download all your data at any time.',
  payment: 'Payment is by EcoCash or bank transfer for now. We send you the details by WhatsApp.',
  currency: 'Prices and invoices are in US dollars. Other currencies are coming soon.',
};

// ---------------------------------------------------------------------------
// 9. Allea case study (structure only until Allea gives numbers and written permission)
// ---------------------------------------------------------------------------
export const caseStudy = {
  h2: 'Built inside a working fleet',
  disclosure: "Allea Worldwide Logistics is our founder's own family fleet. This is not an independent customer review.",
  honest:
    'We built myfleet because we run trucks ourselves. The first version was for our own logbooks and our own unpaid invoices.',
  logoAlt: 'Allea Worldwide Logistics logo',
  rows: [
    { label: 'Who', text: 'Allea Worldwide Logistics' },
    { label: 'Before', text: 'To be added with Allea\'s permission.' },
    { label: 'What changed', text: 'To be added with Allea\'s permission.' },
    // "Result" row intentionally absent until there is a measured number (playbook section 9).
  ],
  quotePlaceholder:
    'Placeholder. A real sentence from the owner goes here, with name and role, once Allea Worldwide Logistics gives written permission. Not a real quote.',
  button: 'See what we see on a normal Monday',
  // TODO(owner): point this at the screenshot gallery or video once it exists.
  buttonHref: '#how',
};

// ---------------------------------------------------------------------------
// 10. FAQ (playbook section 10, placeholders removed, claims softened where unverified)
// ---------------------------------------------------------------------------
export const faq = {
  h2: 'Questions we get asked',
  items: [
    {
      q: 'Is it really free? What is the catch?',
      a: 'Yes. The first month is free if you run 1 to 2 trucks, and 2 to 3 months for bigger fleets. No card. After that you choose to pay or stop. Nothing is charged automatically.',
    },
    {
      q: 'What happens to my data if I stop?',
      // TODO(lawyer): the 30 days is a suggested default pending approval.
      a: 'You can download your data as a file at any time. If you stop, your account becomes read-only for 30 days so you can take everything out, then it is deleted as set out in our Privacy Policy. You can also ask us to delete it sooner.',
    },
    {
      q: 'I am not good with computers. Will my drivers and staff cope?',
      // TODO(owner): confirm drivers do not need to log in before keeping the second sentence.
      a: 'If you can use WhatsApp, you can use the screens that matter. The driver does not need to log in. We do the first import with you, and you can ask on WhatsApp.',
    },
    {
      q: "Can it read my driver's handwriting?",
      a: 'It reads many handwritten logbooks and shows its work. It marks what it is unsure of in yellow, and anything that does not add up in orange. Handwriting varies, so it can be wrong. You check and fix everything before it is saved.',
    },
    {
      q: 'What if it gets a number wrong and I do not notice?',
      a: 'It marks doubtful numbers, and nothing saves without your approval. You are still the last pair of eyes. The odometer check (mileage in lower than out, a break in the chain) catches many slips.',
    },
    {
      q: 'I use Excel. Do I have to start again?',
      a: 'No. Upload your Excel vehicle logs and check the preview before saving. Anything it cannot match, such as a new driver or place, you decide.',
    },
    {
      q: 'Does it handle cross-border trips, trailers and Yellow Cards?',
      a: 'Yes. A trip has a route, cargo, price, border crossings and trip costs, and shows your margin. Horses and trailers are separate. Yellow Card, licence and permit expiry dates give reminders. Photo reading of cross-border ledger pages is coming soon.',
    },
    {
      q: 'Which currencies?',
      a: "US dollars today. Other currencies are coming soon. If a trip's costs are in mixed currencies, the margin is not worked out for you, it is marked as mixed.",
    },
    {
      q: 'Are the invoices tax invoices? Will they work with ZIMRA?',
      a: 'Invoices and quotations made in myfleet are business documents. They are not ZIMRA fiscalised tax invoices. If you must issue fiscal invoices, keep using your fiscal device or approved system for those. We are looking at a link to that system; it is not built.',
    },
    {
      q: 'Is my information safe? Who sees my photos?',
      // TODO(owner): recheck Anthropic retention terms and the model in use before publishing "up to 30 days".
      a: 'Each company sees only its own data, and you sign in through Clerk. Logbook photos you upload to photo import are sent to our AI provider, Anthropic (USA), to read the handwriting. Their terms say it is not used to train their models by default, and it is deleted within up to 30 days. You review everything before it is saved, and you can skip photo import and type or use Excel instead. We do not claim any security certifications.',
      links: [
        { label: 'Privacy Policy', href: '/privacy' },
      ],
    },
    {
      q: 'How do I pay, and what if I cannot pay on time?',
      // TODO(owner): grace policy undecided. Add a sentence once it is.
      a: 'By EcoCash or bank transfer, sent by WhatsApp. If a month is hard, message us before the due date and we will talk.',
    },
    {
      q: 'Who are you, and will you still be here next year?',
      // TODO(owner): add founder name and photo if you want them here.
      a: 'We are a trucking family in Zimbabwe who built this for our own trucks first. You can export your data any time, so you are never stuck.',
    },
  ],
  openFirst: 2,
};

// ---------------------------------------------------------------------------
// 11. Final CTA and 12. Footer
// ---------------------------------------------------------------------------
export const finalCta = {
  h2: 'Start with one logbook page.',
  body: 'Send us one photo on WhatsApp. We will show you what myfleet reads from it and what an invoice looks like. No card, no pressure.',
  primary: 'Send a logbook photo on WhatsApp',
  secondary: 'Start free',
  small: 'Free first month, no card. We tell you the price up front.',
};

export const footer = {
  tagline: 'myfleet is made in Zimbabwe for trucking operators in Southern Africa.',
  small: 'Prices are in US dollars. Product details can change.',
  lastUpdated: 'Last updated 3 November 2026', // TODO(owner): bump when you edit prices or promises.
  links: [
    { label: 'WhatsApp', kind: 'wa' },
    { label: 'Sign in', kind: 'signin' },
    { label: 'Terms', href: '/terms' },
    { label: 'Privacy', href: '/privacy' },
  ],
  // TODO(owner): add a contact email link here when the address exists.
};

// ---------------------------------------------------------------------------
// Legal pages. DRAFT outlines from docs/research/legal-and-compliance-notes.md section 10.
// Not legal advice. Must be reviewed by a Zimbabwean lawyer before public sign-ups or ads.
// ---------------------------------------------------------------------------
export const legal = {
  draftBanner: 'Draft, pending legal review',
  draftNote:
    'This is an outline written for review by a Zimbabwean lawyer. It is not final legal text and may change. Items in [square brackets] are undecided.',
  privacy: {
    title: 'Privacy Policy',
    sections: [
      { id: 'who', h: 'Who we are', p: 'myfleet is run by [legal name], [address], Zimbabwe. Contact: [privacy email].' },
      {
        id: 'roles',
        h: 'Two roles',
        p: 'For your account and billing details we decide how data is used (we are the controller). For the jobs, customers, drivers and invoices you put in myfleet, you decide what is collected and why; we only store and process it for you (we are the processor).',
      },
      {
        id: 'collect',
        h: 'What we collect',
        p: 'Account details; business records; driver details you add (names, licence details, phone numbers, and ID numbers if you choose to add them); logbook photos you upload; basic usage and device logs.',
      },
      { id: 'why', h: 'Why', p: 'To run the service, sign you in, bill you, support you, keep it secure, and meet legal duties.' },
      {
        id: 'ai',
        h: 'AI reading of logbooks',
        p: 'If you use the logbook import, your photo is sent securely to Anthropic (USA), which reads the handwriting for us. You check and confirm the result before it is saved. The result is a suggestion and it can be wrong. Anthropic\'s commercial terms say it does not use this data to train its models by default, and it deletes it from its systems within about 30 days [to be rechecked against the model and terms in use]. Photos may show names, vehicle numbers and signatures: upload only what you have the right to share, and avoid photographing unrelated ID documents. Photo import is optional; typing and Excel import stay available.',
      },
      {
        id: 'others',
        h: 'Who else sees your data',
        p: 'Our service providers (sub-processors): Clerk (sign-in), Vercel (hosting), MongoDB Atlas (database), Anthropic (logbook reading), [email provider], [file storage if separate]. A full list with locations will be published and kept up to date. We do not sell your data.',
      },
      { id: 'abroad', h: 'Sending data abroad', p: 'Our providers store data outside Zimbabwe, including in [countries]. We use written terms with them to protect it.' },
      {
        id: 'long',
        h: 'How long we keep it',
        p: 'We keep data while your account is active and for [90] days after it closes, unless the law requires longer. Logbook images are deleted [60] days after import. You can ask us to delete earlier.',
      },
      {
        id: 'rights',
        h: 'Your rights',
        p: 'Access, correct, delete, object. Contact us; we respond within [30] days. Drivers: contact your employer first; we will help them.',
      },
      { id: 'security', h: 'Security and breaches', p: 'If a breach affects your data we will tell you and the regulator within the legal time limits.' },
      { id: 'complaints', h: 'Complaints', p: 'Contact us first. You can also complain to POTRAZ.' },
      { id: 'changes', h: 'Changes', p: 'We will email you about important changes.' },
    ],
  },
  terms: {
    title: 'Terms of Service',
    sections: [
      { id: 'service', h: 'The service', p: 'myfleet is a back-office tool for transport businesses.' },
      { id: 'who', h: 'Who can use it', p: 'Businesses and their staff, aged 18 or over.' },
      {
        id: 'data',
        h: 'Your data and your responsibility',
        p: 'You own your data. You promise you have the right to upload it, including drivers\' details and photos, and that you have told drivers how it is used.',
      },
      { id: 'permission', h: 'Our right to run it', p: 'You give us permission to store and process your data only to provide the service.' },
      {
        id: 'trial',
        h: 'Free time and payment',
        p: 'Your free period depends on the number of trucks (1 to 2: first month; 3 to 10: first 2 months; 11 to 25: first 3 months) [split to be confirmed]. No card and no payment details are needed. We will tell you before your free time ends. You choose whether to keep going. We never charge you on our own: we send an invoice, payable by EcoCash or bank transfer. If you stop, your account becomes read-only for [30] days so you can export your data, then it is deleted as described in the Privacy Policy. Prices are in US dollars [VAT position to be confirmed]. We give 30 days\' notice of a price change. [Refund wording to be decided and approved.]',
      },
      { id: 'ai', h: 'AI features', p: 'AI suggestions may contain mistakes. You are responsible for checking them before relying on them.' },
      {
        id: 'tax',
        h: 'Invoices and tax',
        p: 'Documents made in myfleet are business documents. They are not ZIMRA fiscalised tax invoices. You are responsible for meeting your own tax and fiscalisation duties.',
      },
      {
        id: 'use',
        h: 'Acceptable use',
        p: 'No illegal activity or uploading data you have no right to; no scraping or reverse engineering; no sharing accounts; no uploading highly sensitive content unrelated to fleet operations; no abusive or spam use; no attempts to break security. We may suspend accounts that break these rules.',
      },
      {
        id: 'availability',
        h: 'Availability',
        p: 'We aim for high availability but do not guarantee uninterrupted service. Back up what you need by exporting.',
      },
      {
        id: 'liability',
        h: 'Liability',
        p: 'Except where the law does not allow it, our total liability is limited to the fees you paid in the last [3/12] months, and we are not liable for indirect losses. [Lawyer to review.]',
      },
      {
        id: 'ending',
        h: 'Ending',
        p: 'You can cancel any time. We may suspend for serious breaches. After closing you can export your data for [30] days.',
      },
      { id: 'processing', h: 'Data processing', p: 'Our Privacy Policy forms part of these Terms and sets out how we process personal data on your behalf.' },
      { id: 'law', h: 'Law', p: 'Zimbabwean law applies; disputes go to [courts or arbitration].' },
      { id: 'changes', h: 'Changes', p: 'We will give [30] days\' notice of material changes.' },
    ],
  },
};

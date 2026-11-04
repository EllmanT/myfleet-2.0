// ALL PAGE COPY LIVES HERE. Edit words in this file; layout is in src/pages and src/components.
//
// How this page is written (Hormozi, "use their words"): every scene opens with the pain the owner
// wants to stop, in plain owner language, then shows the screen that ends it. The pain lines below
// are written from the research in docs/marketing/LANDING_PAGE_PLAYBOOK.md. When real phrases come
// in from customers, replace the `pain` lines here. Nothing else has to change.
//
// Do not promise anything that is not "Yes" in playbook section 0.1.

export const brand = {
  name: 'myfleet',
  description:
    'Trip records, invoices and payments for truck owners. Photograph a driver logbook page, check it, bill the customer, and see who still owes you.',
  title: 'myfleet: stop wondering which trips you never billed',
};

export const nav = {
  links: [
    { label: 'Price', href: '#price' },
    { label: 'Questions', href: '#questions' },
  ],
  whatsapp: 'Chat on WhatsApp',
  start: 'Start free',
  signIn: 'Sign in',
};

// WhatsApp prefilled messages. Plain text, no emoji, under 120 characters.
export const wa = {
  hero: 'Hi, I run a fleet and I want to try myfleet. I will send a logbook photo.',
  question: 'Hi, I have a question about myfleet before I start.',
  pricing: 'Hi, I have more than 25 trucks. What can you do for us?',
  qr: 'Hi, I want to try myfleet. I will send a logbook photo.',
};

export const cta = {
  primary: 'Start free, no card',
  whatsappLong: 'Send a logbook photo on WhatsApp',
  whatsappShort: 'Chat on WhatsApp',
  stillNotSure: 'Still not sure? Ask us on WhatsApp',
  stickyStart: 'Start free',
  stickyChat: 'Chat',
};

// ---------------------------------------------------------------------------
// Hero: the pain first, then what ends it.
// ---------------------------------------------------------------------------
export const hero = {
  h1: 'Stop wondering which trips you never billed.',
  sub: "Your drivers' logbooks, your invoices and the money customers still owe you, in one place. Photograph a logbook page and myfleet turns it into a trip you can check and bill.",
  small: 'Free for your first month with 1 to 2 trucks, up to 3 months for bigger fleets. We never ask for a card.',
  qrCaption: 'Scan to chat on your phone',
  heroAlt:
    'The myfleet invoices screen: a list of invoices with customer, date, total, balance and a status for each one, including one marked overdue.',
};

// The values in the logbook-to-invoice animation. They match the fleet in the screenshots.
export const demoTrip = {
  company: 'Kudu Haulage',
  customer: 'Eastern Agri Supplies',
  vehicle: 'ADF 1093',
  driver: 'F. Chuma',
  date: '20 Oct',
  from: 'Harare',
  to: 'Beira',
  out: '288 450',
  in: '289 050',
  km: '600',
  invoiceNo: 'INV-0007',
  amount: '$1,600.00',
};

export const logbookFigure = {
  alt: 'A handwritten logbook page with four fields underlined, then the page turns into an invoice carrying the same values.',
  head: 'Daily vehicle log',
  columns: ['Date', 'Driver', 'Out', 'In', 'From', 'To'],
  rows: [
    ['17 Oct', 'F. Chuma', '287 210', '287 640', 'Harare', 'Mutare'],
    ['18 Oct', 'F. Chuma', '287 640', '288 050', 'Mutare', 'Harare'],
    ['19 Oct', 'B. Dube', '412 300', '412 392', 'Harare', 'Norton'],
  ],
  invoiceNote: 'Business document, not a ZIMRA fiscal tax invoice.',
};

// ---------------------------------------------------------------------------
// The story. Each scene: a pain line the owner would say, then the way out.
// `lead` is the sentence that hands over to the next scene.
// ---------------------------------------------------------------------------
export const story = {
  logbook: {
    pain: 'The driver brought the logbook back, and half of it I cannot read.',
    body: 'Photograph the page. myfleet reads it and marks every number it is not sure of, yellow if it is hard to read and orange if it does not add up. You check it and approve. Nothing is saved before you do.',
    excel: 'Keep your logs in Excel? Drop the file in and check the preview before anything is saved.',
    lead: 'Once the trips are in, the next question is the one that costs real money.',
  },
  unbilled: {
    pain: 'I did that load three weeks ago. Did I ever invoice it?',
    body: 'Every finished job and trip that nobody has invoiced sits in one list. Tick them, raise one invoice, send the PDF from your phone. When a customer says yes to a quotation, turn it into an invoice in one step.',
    note: 'Invoices and quotations made in myfleet are business documents. They are not ZIMRA fiscalised tax invoices.',
    lead: 'Billing it is half the job. Getting paid is the other half.',
  },
  owed: {
    pain: 'He said he would pay on Friday. It is now next month.',
    body: 'Who owes me lists every customer by how late they are: not yet due, 1 to 30 days, 31 to 60, 61 to 90, and over 90. Record part payments as they arrive. The money goes to the oldest unpaid invoice first, and anything extra stays as credit.',
    lead: 'Even when everyone pays, a trip can still lose you money.',
  },
  profit: {
    pain: 'By the time I add up the border fees, escort and parking, I do not know what I made on that trip.',
    body: 'Every trip keeps its route, cargo, price, border crossings and every cost, with the margin worked out for you. Then see profit per truck, month by month: income minus fuel, salaries and everything else.',
    lead: 'And then there are the small leaks that never show up on an invoice.',
  },
  leaks: {
    pain: 'The fuel went in. The kilometres do not match. Nobody can say why.',
    intro: 'Four places money quietly walks out, each one watched for you.',
    items: [
      {
        id: 'fuel',
        title: 'Fuel',
        body: 'Each truck is marked OK, Check or Review by comparing its kilometres per litre with what is normal for that truck. Copy the weekly summary straight into your WhatsApp group. It points you to where to look. It does not accuse anyone.',
        alt: 'The fuel log with a weekly check: each truck shows kilometres driven, kilometres per litre, what is normal for it, and a result.',
      },
      {
        id: 'documents',
        title: 'Permits and papers',
        body: 'Yellow Cards, licences, permits and roadworthy certificates for trucks, trailers and drivers, with a warning before each one runs out.',
        alt: 'The documents screen: each document with the truck or driver it belongs to, its expiry date and days left.',
      },
      {
        id: 'maintenance',
        title: 'Services and tyres',
        body: 'Service reminders by kilometres or days, workshop records, and what each tyre costs you per kilometre.',
        alt: 'The maintenance screen: service plans with the last service, kilometres since, and an overdue flag.',
      },
      {
        id: 'expenses',
        title: 'Every other cost',
        body: 'Insurance, salaries, repairs and cash hires, recorded against the truck they belong to.',
        alt: 'The expenses screen: a list of costs by category, description, vehicle and amount.',
      },
    ],
    lead: 'None of this needs a training week, and none of it has to be switched on all at once.',
  },
  modules: {
    pain: 'I do not want a system with forty screens I will never open.',
    body: 'New companies start with a short menu. Turn on fuel, trips, quotations or invoices when you are ready, and turn them off again whenever you like. Your data is kept.',
    alt: 'The modules screen: a list of parts of myfleet, each with a switch.',
  },
};

// ---------------------------------------------------------------------------
// Screenshots. Files live in marketing/public/img/app/ (WebP, 1600 px wide).
// ---------------------------------------------------------------------------
export type Shot = { src: string; width: number; height: number; alt: string };

const shot = (name: string, width: number, height: number, alt: string): Shot => ({
  src: `/img/app/${name}.webp`,
  width,
  height,
  alt,
});

export const shots = {
  hero: shot('hero-invoices', 1600, 867, hero.heroAlt),
  invoices: shot('invoices', 1600, 699, 'The invoices list: number, customer, date, due date, total, paid, balance and status, with the amount outstanding at the top.'),
  notInvoiced: shot('not-invoiced', 1600, 753, 'The not yet invoiced list: local jobs by contractor and month, with the number of legs, the value, and a Create invoice link on each row.'),
  whoOwes: shot('who-owes', 1600, 500, 'Who owes me: each customer with what is not yet due and what is 1 to 30, 31 to 60, 61 to 90 and over 90 days late.'),
  trips: shot('trips', 1600, 1022, 'The trips list: route, cargo, truck and trailer, kilometres, price, costs and margin for each cross-border trip.'),
  profitability: shot('profitability', 1600, 699, 'Profitability by month: job revenue, fuel, salaries, insurance and repairs, with totals and profit.'),
  fuel: shot('fuel', 1600, 444, story.leaks.items[0].alt),
  documents: shot('documents', 1600, 699, story.leaks.items[1].alt),
  maintenance: shot('maintenance', 1600, 699, story.leaks.items[2].alt),
  expenses: shot('expenses', 1600, 645, story.leaks.items[3].alt),
  modules: shot('modules', 1600, 1022, story.modules.alt),
  import: shot('import', 1600, 484, 'The Excel import screen: drop vehicle logs in and check the preview before anything is saved.'),
  dashboard: shot('dashboard', 1600, 1124, 'The dashboard: total jobs, revenue, a yearly chart and the latest jobs.'),
  quotations: shot('quotations', 1600, 592, 'The quotations list with Draft, Sent and Accepted statuses.'),
  vehicles: shot('vehicles', 1600, 592, 'The vehicles screen: each truck with its registration and make.'),
};

// Notice shown wherever photo upload is mentioned.
export const aiNotice = {
  text: 'Photos you upload to photo import are sent to our AI provider, Anthropic (USA), to read the handwriting. The result is a suggestion and it can be wrong. You review everything before it is saved. Photo import is optional: you can type or use Excel instead.',
  link: 'How we handle this',
  href: '/privacy#ai',
};

// ---------------------------------------------------------------------------
// Proof: Allea. Words only, no numbers we cannot show.
// ---------------------------------------------------------------------------
export const proof = {
  h2: 'We built it to run our own fleet.',
  body: [
    'myfleet started as the back office of Allea Worldwide Logistics, our family fleet. Allea now tracks how every vehicle is performing, keeps to its budgets, sees every expense and its actual profit, and sees how profitable the business really is.',
    'Decisions that used to be a feeling are now made on real figures.',
  ],
  disclosure: 'Allea is our own business, not an independent customer.',
  logoAlt: 'Allea Worldwide Logistics logo',
};

// ---------------------------------------------------------------------------
// Price. The offer is folded in: no separate "offer" section, no long disclosure paragraph.
// ---------------------------------------------------------------------------
export const pricing = {
  h2: 'Priced by how many trucks you run.',
  sub: 'Prices are in US dollars per month. The free time comes first. You decide after.',
  plans: [
    { name: 'Starter', trucks: '1 to 2 trucks', price: '$9', free: 'First month free', cta: 'Start free on Starter' },
    { name: 'Fleet', trucks: '3 to 10 trucks', price: '$29', free: 'First 2 months free', cta: 'Start free on Fleet' },
    { name: 'Pro', trucks: '11 to 25 trucks', price: '$59', free: 'First 3 months free', cta: 'Start free on Pro' },
  ],
  perMonth: 'a month',
  included: [
    { title: 'Everything on this page', text: 'Every plan has every feature. Switch on what you need.' },
    { title: 'Set up with you', text: 'We create your company and add your trucks, drivers and customers with you.' },
    { title: 'Your last logbooks, imported', text: 'Send last month’s logbook photos on WhatsApp. We bring them in, you check and approve, so you start with real history.' },
    { title: 'Support on WhatsApp, 24/7', text: 'Ask a question at any hour and get a person.' },
  ],
  promises: [
    { title: 'No card, no contract.', text: 'We never charge you on our own. When your free time ends we send an invoice, and you pay by EcoCash or bank transfer, or you stop.' },
    { title: 'Your data is yours.', text: 'Download everything as a file at any time. Ask us to delete it and we will.' },
    { title: 'No surprise bill.', text: 'The price on this page is the price you pay. If it ever changes, we tell you 30 days before.' },
  ],
  more: 'More than 25 trucks? Message us.',
  currency: 'Prices and invoices are in US dollars. Payment is by EcoCash or bank transfer, and we send you the details on WhatsApp.',
};

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------
export const faq = {
  h2: 'Questions owners ask before they start.',
  items: [
    {
      q: 'Is it really free? What is the catch?',
      a: 'There is no catch. The first month is free if you run 1 to 2 trucks, the first 2 months for 3 to 10 trucks, and the first 3 months for 11 to 25. We do not ask for a card or any payment details, and we tell you before your free time ends. Then you decide: pay by EcoCash or bank transfer, or stop. We never charge you on our own, we send you an invoice. If you stop, your account becomes read-only for 30 days so you can download your data, then it is deleted as set out in our Privacy Policy.',
    },
    {
      q: 'I am not good with computers. Will my drivers and staff cope?',
      a: 'If you can use WhatsApp, you can use the screens that matter. The driver does not need to log in. We do the first import with you, and you can ask us anything on WhatsApp, any hour.',
    },
    {
      q: 'Can it read my driver’s handwriting?',
      a: 'It reads many handwritten logbooks and shows its work. It marks what it is unsure of in yellow and anything that does not add up in orange. Handwriting varies, so it can be wrong. You check and fix everything before it is saved.',
    },
    {
      q: 'What if it gets a number wrong and I do not notice?',
      a: 'It marks doubtful numbers, and nothing is saved without your approval, so you are still the last pair of eyes. The odometer check (mileage in lower than mileage out, or a break in the chain) catches many slips.',
    },
    {
      q: 'I use Excel. Do I have to start again?',
      a: 'No. Upload your Excel vehicle logs and check the preview before saving. Anything it cannot match, such as a new driver or a new place, you decide.',
    },
    {
      q: 'Does it handle cross-border trips, trailers and Yellow Cards?',
      a: 'Yes. A trip has a route, cargo, price, border crossings and trip costs, and shows your margin. Horses and trailers are separate, so any trailer can be paired with any horse. Yellow Card, licence and permit expiry dates give you reminders. Reading cross-border ledger pages from a photo is not available yet, so cross-border trips are added in a simple form.',
    },
    {
      q: 'Which currencies?',
      a: 'US dollars. If a trip’s costs are in more than one currency, the margin is not worked out for you and is marked as mixed.',
    },
    {
      q: 'Are the invoices tax invoices? Will they work with ZIMRA?',
      a: 'Invoices and quotations made in myfleet are business documents. They are not ZIMRA fiscalised tax invoices. If you must issue fiscal invoices, keep using your fiscal device or approved system for those.',
    },
    {
      q: 'Is my information safe? Who sees my photos?',
      a: 'Each company sees only its own data, and you sign in through Clerk. Logbook photos you upload to photo import are sent to our AI provider, Anthropic (USA), to read the handwriting. Their terms say the data is not used to train their models by default, and it is deleted within up to 30 days. You review everything before it is saved, and you can skip photo import and type or use Excel instead. We do not claim any security certifications.',
      links: [{ label: 'Privacy Policy', href: '/privacy' }],
    },
    {
      q: 'Who are you, and will you still be here next year?',
      a: 'We are a trucking family in Zimbabwe. We built this for our own trucks first and we use it every day. You can download your data at any time, so you are never stuck.',
    },
  ],
  openFirst: 1,
};

export const finalCta = {
  h2: 'Start with one logbook page.',
  body: 'Send us one photo on WhatsApp and see what myfleet reads from it and what the invoice looks like. No card, no pressure.',
  primary: 'Send a logbook photo on WhatsApp',
  secondary: 'Start free',
  small: 'Free first month, no card. We tell you the price up front.',
};

export const footer = {
  tagline: 'Made in Zimbabwe for trucking operators in Southern Africa.',
  small: 'Prices are in US dollars.',
  links: [
    { label: 'WhatsApp', kind: 'wa' },
    { label: 'Sign in', kind: 'signin' },
    { label: 'Terms', href: '/terms' },
    { label: 'Privacy', href: '/privacy' },
  ],
};

// ---------------------------------------------------------------------------
// Legal pages. Plain-language terms written to match what the product really does.
// Have a Zimbabwean lawyer read these before ads or public sign-ups.
// ---------------------------------------------------------------------------
export const legal = {
  updated: 'Last updated 4 November 2026',
  privacy: {
    title: 'Privacy Policy',
    sections: [
      { id: 'who', h: 'Who we are', p: 'myfleet is run from Harare, Zimbabwe. You can reach us at any time on WhatsApp, using the link in the footer of every page.' },
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
        p: 'If you use photo import, your photo is sent securely to Anthropic (USA), which reads the handwriting for us. You check and confirm the result before it is saved. The result is a suggestion and it can be wrong. Anthropic’s commercial terms say it does not use this data to train its models by default, and it deletes it from its systems within about 30 days. Photos may show names, vehicle numbers and signatures: upload only what you have the right to share, and avoid photographing unrelated ID documents. Photo import is optional; typing and Excel import stay available.',
      },
      {
        id: 'others',
        h: 'Who else sees your data',
        p: 'Our service providers: Clerk (sign-in), Vercel (hosting), MongoDB Atlas (database) and Anthropic (logbook reading). We do not sell your data.',
      },
      { id: 'abroad', h: 'Sending data abroad', p: 'Our providers store data outside Zimbabwe, including in the United States. We use written terms with them to protect it.' },
      {
        id: 'long',
        h: 'How long we keep it',
        p: 'We keep data while your account is active and for 90 days after it closes, unless the law requires longer. Logbook images are deleted 60 days after import. You can ask us to delete earlier.',
      },
      {
        id: 'rights',
        h: 'Your rights',
        p: 'You can ask to see, correct or delete your data, or object to how it is used. Contact us and we respond within 30 days. Drivers: contact your employer first; we will help them.',
      },
      { id: 'security', h: 'Security and breaches', p: 'If a breach affects your data we will tell you and the regulator within the legal time limits.' },
      { id: 'complaints', h: 'Complaints', p: 'Contact us first. You can also complain to POTRAZ.' },
      { id: 'changes', h: 'Changes', p: 'We will message you about important changes.' },
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
        p: 'You own your data. You promise you have the right to upload it, including drivers’ details and photos, and that you have told drivers how it is used.',
      },
      { id: 'permission', h: 'Our right to run it', p: 'You give us permission to store and process your data only to provide the service.' },
      {
        id: 'trial',
        h: 'Free time and payment',
        p: 'Your free period depends on the number of trucks: 1 to 2 trucks, the first month; 3 to 10 trucks, the first 2 months; 11 to 25 trucks, the first 3 months. No card and no payment details are needed. We will tell you before your free time ends, and you choose whether to keep going. We never charge you on our own: we send an invoice, payable by EcoCash or bank transfer. If you stop, your account becomes read-only for 30 days so you can export your data, then it is deleted as described in the Privacy Policy. Prices are in US dollars. We give 30 days’ notice of a price change. If you think you were charged in error, tell us and we will put it right.',
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
        p: 'Except where the law does not allow it, our total liability is limited to the fees you paid in the last 12 months, and we are not liable for indirect losses.',
      },
      {
        id: 'ending',
        h: 'Ending',
        p: 'You can cancel any time. We may suspend for serious breaches. After closing you can export your data for 30 days.',
      },
      { id: 'processing', h: 'Data processing', p: 'Our Privacy Policy forms part of these Terms and sets out how we process personal data on your behalf.' },
      { id: 'law', h: 'Law', p: 'Zimbabwean law applies, and disputes go to the courts of Zimbabwe.' },
      { id: 'changes', h: 'Changes', p: 'We will give 30 days’ notice of material changes.' },
    ],
  },
};

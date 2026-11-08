# Notifications, validation, browsers, accessibility and performance

Part of the MyFleet manual QA suite. Conventions, priorities and the pass/fail procedure are in [../README.md](../README.md). Fixtures are in [../TEST_DATA.md](../TEST_DATA.md). Fill the **Result** column with PASS, FAIL, BLOCKED or N/A, and put the defect id in **Notes**. The same cases are in [../qa-tracker.csv](../qa-tracker.csv) for tracking.

Env column: **S** = run on staging/local only (it changes data or time-dependent state); **SP** = safe to run on production with a dedicated QA company.

## NOT: Notifications, toasts, emails and real-time behaviour (10 cases)

IMPORTANT: the product has NO websocket or push channel (no socket library exists in the backend or frontend). "Notifications" are: toast messages (react-hot-toast), the billing banner under the top bar, the Getting started checklist, in-page statuses (document expiry, service due, fuel check) and emails sent by the backend (activation and password reset in legacy mode, trial/payment/deletion reminders). Other-user changes appear only after a reload or a new page visit.

| ID | Pri | Env | Title | Preconditions | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| NOT-001 | P1 | S | No real-time channel exists | Two browsers, ALPHA-ADMIN in both. | 1. Open DevTools > Network > WS in both<br>2. In browser 1 add a customer<br>3. Watch browser 2 without reloading<br>4. Reload browser 2 | No WebSocket/EventSource connection is opened. Browser 2 does not change until reload or navigation; after reload it shows the customer. Record any unexpected live update or open socket. | | |
| NOT-002 | P0 | S | Success and error toasts | Any create flow. | 1. Save a valid record<br>2. Trigger a validation error<br>3. Trigger a server error (stop the API or block the request) | Success toast text per module (e.g. "Vehicle added successfully", "Job added successfully!", "Entry added"). Error toast shows the server's message or a clear fallback; toasts disappear on their own, do not stack beyond a few, and are readable on a phone. | | |
| NOT-003 | P1 | S | Server messages shown to users are friendly | Provoke 402, 403, 404, 409 and 500 responses (read-only, manager on finance route, foreign id, duplicate, server fault). | 1. Read the toast/page text | Messages are the plain-language texts documented in the cases above. 500s read "Something went wrong on our side" (production). No raw JSON, stack, Mongo or "undefined" text. | | |
| NOT-004 | P1 | S | Optimistic job creation survives failure | Add Job wizard completed. | 1. Turn the network off (DevTools offline) and click Add Job<br>2. Wait for the background save to fail<br>3. Turn the network on<br>4. Check View All | The success toast and next job number appear immediately (optimistic). When the save fails a failure message appears; the job is NOT in the list. Record whether the displayed job number is rolled back and whether the user can retry without retyping; raise a defect if the user is left believing a failed job was saved. | | |
| NOT-005 | P1 | S | Billing banner placement and wording | Trial ending in 3 days; then a read-only company. | 1. Read the banner on every page | One line under the top bar, role "status", same wording as in BILL cases, visible on all pages and on a phone; absent for healthy companies. | | |
| NOT-006 | P1 | S | Emails: sender, subject and plain text | Any triggered email (reminder, deletion, activation, reset). | 1. Open the raw message | Subject lines exactly as in BILL/DEL cases; plain text body; sender is the configured mailbox; company name correct; no template placeholders (e.g. "{{name}}", "undefined"); no links to localhost. | | |
| NOT-007 | P2 | S | Compliance expiry "reminders" | Tractor units ON, a document expiring in 5 days. | 1. Wait for the daily cron runs<br>2. Check the admin inbox | The module description promises "licence, Yellow Card and permit expiry reminders" but the backend only sends billing emails; expiry is shown in the Documents list status. Confirm no email arrives and report the wording mismatch to the owner. | | |
| NOT-008 | P2 | S | Maintenance due alerts | Plan overdue. | 1. Check dashboard/sidebar | Only shown inside the Maintenance page (no badge or email). Record. | | |
| NOT-009 | P2 | S | Multiple tabs | Same user in two tabs. | 1. Add a vehicle in tab 1<br>2. Open the Add Job page in tab 2 without reloading | Tab 2 does not list the new vehicle until reload. No error, no corruption. | | |
| NOT-010 | P1 | S | Session expiry mid-work | Signed in, form half filled. | 1. Revoke the session, then submit | Clear "Session expired, please login again" (or sign-in redirect); user is not shown a success toast; after logging back in the data is not duplicated. | | |

## NEG: Negative, validation and edge cases (16 cases)

Use any list/create screen listed. The rule for every case: a refused input produces a clear message, nothing is saved, and the server never answers 500 for user input.

| ID | Pri | Env | Title | Preconditions | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| NEG-001 | P0 | S | Whitespace-only and empty required fields | Customer, vehicle, driver, contractor, trip, invoice, expense, fill-up forms. | 1. Fill required fields with spaces only<br>2. Submit | Treated as empty: refused with the field's required message. Nothing saved. | | |
| NEG-002 | P1 | S | Very long text | Add customer and job description. | 1. Paste 5,000 and 100,000 characters into Name, Address, Description, Notes | Either truncated by documented limits (trip fields 80 to 1000, invoice notes 2000) or refused; no crash, no 500, UI stays usable, lists do not break their layout. | | |
| NEG-003 | P1 | S | Unicode, emoji, apostrophes, quotes | Same forms. | 1. Names: "Ñandú Éxpress 🚚", "O'Neil & Sons", "Quote \"Q\" Ltd", Chinese and Arabic text | Saved and displayed identically in lists, dialogs, CSV, PDF (PDF may substitute unsupported glyphs: record) and exports. Search finds them. | | |
| NEG-004 | P1 | S | Double-click on save | Add customer, Add vehicle, Issue invoice, Record payment, Add Job. | 1. Double-click (or click twice fast) the save button | Exactly one record is created. Issue and payment actions never apply twice (second click returns an error or is ignored). Check lists and numbering afterwards. | | |
| NEG-005 | P1 | S | Browser back and refresh in the Add Job wizard | Add Job at the Preview step. | 1. Press Back<br>2. Refresh<br>3. Use Reset | No half-saved job. Reset clears all fields. Refresh returns to an empty wizard without errors. | | |
| NEG-006 | P1 | S | Invalid ids in URLs | Signed in. | 1. Browse /del-dash-vehicle/abc, /vehicle-analytics/123, /driver-analytics/zzz, /job-analytics/xyz<br>2. Call DELETE /vehicle/delete-vehicle/abc and GET /fuel/... with bad ids | Pages show an error/empty state, no white screen. API answers 400/404 ("Invalid id", "Not found"), never 500. | | |
| NEG-007 | P1 | S | Unknown routes | Signed in and out. | 1. Open /nothing-here, /del-unknown, /api/v2/unknown | Frontend: record what shows (the router has no catch-all page; a blank page is a UX defect). API: JSON 404/SPA fallback, no stack. | | |
| NEG-008 | P1 | S | Year and paging parameters | API. | 1. GET /overallStats/get-all-overallStats-company?year=1999<br>2. ?year=abc<br>3. ?year=3000<br>4. /job/get-all-jobs-page?page=-1<br>5. ?limit=100000<br>6. ?sort=notjson | Year outside 2000-2100 or non-integer: 400 "Invalid year query parameter". Negative/huge page and limit are clamped or refused. A bad sort value does not return 500 text containing internals. | | |
| NEG-009 | P1 | S | Numeric extremes | Job cost, distance, expense amount, fuel litres. | 1. Enter 1e12, 99999999999, 0.001, 0, -0, "1e3", "12,50" (comma decimal), "abc" | Invalid values refused; valid ones saved with two-decimal rounding; no NaN or Infinity anywhere (lists, dashboard, CSV). Record how a comma decimal is treated. | | |
| NEG-010 | P1 | S | Date extremes | Trip, job, expense, fill, document dates. | 1. 1900-01-01, 2100-12-31, 2027-02-29, 2026-04-31, year 0099, empty | Invalid calendar dates refused. Extreme but valid dates handled without breaking charts (record any chart that stretches to 1900). Timezone does not shift the saved day. | | |
| NEG-011 | P1 | S | Duplicate-detection edge cases | Customer, vehicle, driver, trailer, tyre, trip reference. | 1. Create duplicates differing only by case and spacing ("qaa 1001" vs "QAA1001"; "ZZA 1234" vs "zza1234"; tyre " t-001 ") | Plates and serials treated as the same (trailer, tyre, vehicle form removes spaces and upper-cases). Customer names: exact trimmed match is a duplicate; record whether different case creates a second record. | | |
| NEG-012 | P1 | S | Delete something that is in use | Contractor with jobs, customer on jobs, vehicle on trips, driver on fills, trailer on trips, tyre fitted. | 1. Delete each | Trailer and fitted tyre refuse with explanations. Others are deleted without a block: record the effect on dependent pages (see VEH-010, DRV-007, CUS-005, CTR-006). Raise defects for crashes. | | |
| NEG-013 | P1 | S | Offline and flaky network | Any list page and a form. | 1. Go offline, click around, submit<br>2. Go online<br>3. Throttle to Slow 3G and repeat the Add Job | Offline: error toast, no endless spinner, no data loss in open forms. Slow 3G: save completes; double submission cannot happen. | | |
| NEG-014 | P1 | S | Large payloads | Job create with 50 legs; import of 300 rows; invoice with 1,000 lines (limit) and 1,001 lines. | 1. Submit each | Within limits: succeeds. 1,001 invoice lines: "Too many lines". Payloads over 2 MB: refused (413). | | |
| NEG-015 | P2 | S | Browser autofill and password managers | Add Driver / Add Admin forms. | 1. Let the browser autofill | Autofill does not put the admin's own email or password into unrelated fields (e.g. customer name); form still validates correctly. | | |
| NEG-016 | P2 | S | Clock skew | Device clock set 2 days ahead. | 1. Create a trip, a fill and a document | Server-side validations (not the device clock) decide statuses; record any UI that uses the device date (e.g. document status is calculated on the server at read time). | | |

## BRW: Browser, device and responsive matrix (14 cases)

Run the SAME core script on each row of the matrix: (1) sign in, (2) dashboard and a chart, (3) open the sidebar and each menu group, (4) Add Customer, (5) Add Job through the three wizard steps, (6) Drivers > Add with a camera/gallery photo, (7) open an invoice PDF, (8) download the company ZIP, (9) sign out. Record the browser version and device in Notes. Mobile breakpoint: below 600 px the sidebar becomes a drawer.

| ID | Pri | Env | Title | Preconditions | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| BRW-001 | P0 | S | Chrome latest on Windows 11 | Chrome stable. | 1. Run the core script | All nine steps pass; no console errors. | | |
| BRW-002 | P0 | S | Chrome latest on Android phone (mid-range, e.g. 360x800) | Android 12+, mobile data. | 1. Run the core script | All steps pass; sidebar opens as a drawer and closes after navigation; forms usable with the on-screen keyboard; camera capture works for driver documents. | | |
| BRW-003 | P0 | S | Safari on iPhone (iOS 16+) | Real iPhone. | 1. Run the core script | All steps pass. Cookie/session persists after backgrounding the app. HEIC photos for drivers are converted or handled (driver upload) and AI photo requires JPG per the message. | | |
| BRW-004 | P1 | S | Safari latest on macOS | Safari 16+. | 1. Run the core script | All steps pass; third-party cookie settings do not break Clerk sign-in; PDF opens in the viewer. | | |
| BRW-005 | P1 | S | Firefox latest on Windows or Linux | Firefox ESR and latest. | 1. Run the core script | All steps pass; downloads (CSV/ZIP/PDF) work. | | |
| BRW-006 | P1 | S | Edge latest | Edge stable. | 1. Run the core script | All steps pass. | | |
| BRW-007 | P1 | S | Chrome on a low-end Android (2 GB RAM) | Throttled CPU 4x in DevTools if no device. | 1. Dashboard and All Orders with 1,000+ jobs | Pages remain usable (no tab crash); first load completes within about 10 s on 4G. | | |
| BRW-008 | P2 | S | Samsung Internet and Opera Mini/Mobile | Real device. | 1. Sign in and view dashboard | Record support level (Opera Mini is not expected to work). Clerk sign-in must at least show a clear message if unsupported. | | |
| BRW-009 | P1 | S | Layout widths | Chrome DevTools or real devices. | 1. Check 360x640, 390x844, 768x1024, 1024x768, 1366x768, 1920x1080 on dashboard, All Orders, Add Job, Drivers dialog, Invoices | No horizontal scroll of the whole page; grids scroll inside their container; dialogs fit the screen and scroll; buttons reachable; charts resize; no overlapping text. | | |
| BRW-010 | P1 | S | Zoom and text size | Desktop. | 1. Zoom to 150% and 200%; set browser minimum font size large | Content reflows; nothing important is cut off; sidebar still usable. | | |
| BRW-011 | P1 | S | Dark and light theme | Theme toggle in the top bar. | 1. Toggle the theme on dashboard, forms, dialogs, grids, charts and the billing banner | Text remains readable in both; the choice persists on reload (record) and is applied to dialogs and tooltips. | | |
| BRW-012 | P2 | S | Orientation change | Phone/tablet. | 1. Rotate during Add Job and in the invoice form | Layout adapts, entered data kept. | | |
| BRW-013 | P2 | S | Print | Desktop. | 1. Print the dashboard and an invoice view | Print layout acceptable (print-content areas). | | |
| BRW-014 | P1 | S | Time zones and locales | Set the OS time zone to UTC+2 (Harare), UTC-5 and UTC+13; locale en-ZW and en-US. | 1. Add a job and a trip dated near midnight; read dates in lists, CSV and PDF | Calendar date is the same everywhere for the same record; numbers keep two decimals; no US/UK day-month swap in displayed dates. | | |

## A11Y: Accessibility basics (10 cases)

Target: WCAG 2.1 AA basics for the main flows. Tools: keyboard only, a screen reader (NVDA on Windows or VoiceOver), browser accessibility inspector, axe DevTools extension.

| ID | Pri | Env | Title | Preconditions | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| A11Y-001 | P1 | S | Keyboard-only navigation | Signed in. | 1. Tab through the top bar, sidebar, a list page, a dialog (Add Customer), a wizard | Every control is reachable in a logical order, has a visible focus ring and can be activated with Enter/Space. Escape closes dialogs. No keyboard trap. | | |
| A11Y-002 | P1 | S | Dialog focus handling | Add Customer / Delete company dialogs. | 1. Open<br>2. Tab repeatedly<br>3. Close with Escape | Focus moves into the dialog, stays inside while open and returns to the button that opened it afterwards. | | |
| A11Y-003 | P1 | S | Form labels and errors | Add vehicle, driver, invoice forms. | 1. Inspect each input with the accessibility inspector<br>2. Submit invalid | Every input has an accessible name (label text or aria-label). Errors are shown as text near the field and announced (toast has status role). Required fields indicated. | | |
| A11Y-004 | P1 | S | Icon buttons are named | Grids and cards. | 1. Inspect Edit, Delete, View icon buttons, the Modules switches and the sidebar toggle | Each has an accessible name (e.g. aria-label "Edit", "Delete", "View", module label on the switch). Report unnamed buttons. | | |
| A11Y-005 | P1 | S | Colour contrast | Light and dark themes. | 1. Check body text, secondary text (reduced opacity), buttons, chips, banner, chart labels | Contrast at least 4.5:1 for normal text and 3:1 for large text and icons. Secondary text with 0.6-0.7 opacity is the likely failure: list every failing element. | | |
| A11Y-006 | P2 | S | Meaning not by colour alone | Fuel check (OK/Check/Review), document status, invoice overdue, quotation status. | 1. Review with a grayscale filter | Each status also has a text label, not only a colour. | | |
| A11Y-007 | P2 | S | Charts have text alternatives | Dashboard charts. | 1. Use a screen reader on the charts | Provide or record whether a table/summary alternative exists (the totals tiles repeat key numbers). Raise as an enhancement if none. | | |
| A11Y-008 | P2 | S | Page title and language | Each route. | 1. Check document title and the html lang attribute | Title identifies the product and ideally the page; lang="en". Record if every page has the same title. | | |
| A11Y-009 | P2 | S | Zoom/reflow and target size | Phone. | 1. 200% zoom and touch the smallest controls | Controls are at least about 24 px (ideally 44 px) and not overlapping. | | |
| A11Y-010 | P3 | S | Reduced motion | OS "reduce motion" on. | 1. Open the app | No essential animation; transitions are not distracting. | | |

## PERF: Performance sanity (9 cases)

Sanity checks, not load testing. Record timings in Notes. Use the live-size data set (about 8,000 jobs) or the seed script on staging. Network: office broadband, then DevTools "Fast 4G".

| ID | Pri | Env | Title | Preconditions | Steps | Expected result | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| PERF-001 | P0 | S | Dashboard makes a sensible number of requests | Dashboard with data. | 1. Open Network, clear, load /del-dashboard and wait 30 seconds | A few dozen requests at most and then silence. No repeating calls (the earlier loop made about 5,900 calls in 6 seconds). Fail if any endpoint repeats every few hundred milliseconds. Repeat on the five analytics pages. | | |
| PERF-002 | P1 | S | Dashboard load time | 8,000 jobs, broadband. | 1. Reload /del-dashboard | Usable within about 3 seconds; charts drawn within 5 seconds. Record the figure; investigate above 8 seconds. | | |
| PERF-003 | P1 | S | Lists with large data are paged | 8,000 jobs, 700+ customers. | 1. Open All Orders and Customers, sort and search | Only one page of rows is fetched at a time; sort and search return within about 2 seconds; the browser stays responsive. | | |
| PERF-004 | P1 | S | First load and bundle | Production URL. | 1. Lighthouse (mobile, Fast 4G) on /login and /del-dashboard | Record Performance score and transfer size; pages are lazy-loaded so the first bundle is smaller than the whole app. Investigate a score below 50. | | |
| PERF-005 | P1 | S | Cold start | Production after at least 15 minutes idle. | 1. Load the dashboard first thing | First API call may be slower (serverless start) but completes well under the 30-second function limit; no timeout page. | | |
| PERF-006 | P1 | S | Heavy endpoints stay under the 30 s function limit | Large company. | 1. Time the company export, Excel commit of 300 rows, jobs PDF for All Years, rebuild-stats | Each completes in under 30 seconds. Record durations; a 504/timeout is a defect. | | |
| PERF-007 | P2 | S | Memory and long sessions | Chrome task manager. | 1. Keep the dashboard open 30 minutes with idle timer, then navigate 20 pages | No steady growth beyond a few hundred MB, no polling requests, no console errors. | | |
| PERF-008 | P2 | S | Image upload speed | Driver documents on 4G. | 1. Upload two 12 MP photos | Client shrinking keeps uploads to a few seconds; progress/disabled button prevents repeated clicks. | | |
| PERF-009 | P2 | S | Search responsiveness | Customers with 700+ rows. | 1. Type quickly into the search box | No request storm (debounced) and no lost keystrokes; final results match the final text. | | |


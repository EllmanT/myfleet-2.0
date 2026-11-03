# myFleet dashboard audit (2026-11-03)

Read-only audit of `frontend/src`. Contrast script: `C:\Users\ROPAFA~1\AppData\Local\Temp\claude\C--Users-Ropafadzo-Muridzi-Documents-tapiwa-projects-myfleet\fd44ae12-8d59-4306-8ee1-b0dd00aad2ae\scratchpad\contrast.js` (67 pairs checked, 32 fail; all light-mode failures are the gold family or MUI default semantic colours).
Paths below are relative to `frontend/src`. The app **defaults to light mode** (`state/index.js:4`), so the light-mode failures are what most users see.

## Headline diagnosis

The orange is "unclear" for one structural reason: the palette is a **dark-mode design mechanically inverted for light mode**. `tokensLight = reverseTokens(tokensDark)` (`theme.js:63`) flips the 10-step gold scale. Components then use `secondary[100/200/300]` as text colours (about 320 usages across ~50 files). In dark mode these are pale cream on navy (13-16:1, excellent). In light mode the same indices become dark brown, mid-bronze (#997d3d) and **mustard (#cca752)**, on white or #f0f0f0. Mustard text on white is 2.28:1. The identical code is crisp in dark mode and washed-out in light mode. There is no separate accent concept: the gold is simultaneously the text colour, icon colour, active-nav fill, logo, and button fill.

Second structural problem: **there is no design system**. Every page hand-builds its own header buttons, margins, hex values and typography. 174 `color="warning|success|info|secondary"` usages mean MUI's stock orange/blue/green appear beside the custom gold, giving a multi-accent look.

## 1. Theme and colour

**Where defined:** `theme.js` only. Tokens: `tokensDark.grey` (0-1000), `primary` navy (100-900, #21295c family), `secondary` "yellow" (#ffd166 family). Light = reversed copies (`theme.js:63`). Non-standard palette keys `neutral` and `background.alt` (`theme.js:82,86,107`); `background.alt` is the card colour everywhere.

**Light-mode quirks (`theme.js:93-110`):**
- `primary.main` = grey[50] #f0f0f0. Any default `<Button variant="contained">` is a pale-grey button on white (1.14:1 against the page, shape effectively invisible). Dialog "Save" buttons on the new pages (e.g. `ExpensesPage.jsx:276`) use this.
- `secondary.main` = #cca752 (mustard), `secondary.light` = #997d3d (bronze).
- `background.default` #ffffff, `alt` #f0f0f0. Cards are barely distinguishable from the page; the Navbar relies on a `3px 3px 5px #ccc` shadow (`Navbar.jsx:49`).
- Dark: bg #141937, cards/sidebar #21295c, `primary.main` #4d547d.

**Where the gold is used (counts across jsx):** `secondary[200]` 115, `[300]` 110, `[100]` 97, `.light` 36, `.main` 15, `[800]` 15, `[400]` 13, `[600]` 11, `[900]` 9, `[700]` 2. Key sites:
- Logo "myFleet": `Sidebar.jsx:269` uses `secondary.main` (#cca752, 2.0:1 on the #f0f0f0 sidebar).
- Sidebar: paper text `secondary[300]` (`Sidebar.jsx:258`), section labels (`:288`, plain Typography, inherits mustard, 2.0:1), items `secondary[100]`, **active item = mustard fill with `primary[600]` text** (`:312-319`).
- Page titles: `Header.jsx:10` `secondary[100]` (OK in light, 7.3:1); subtitles `Header.jsx:16` `secondary[300]` (**2.28:1 fail in light**).
- StatBox: value `secondary[200]` (`Statbox.jsx:52`, 3.4:1 on card, fail); icons `secondary[300]` (Dashboard `:362,373`...).
- Navbar: user name/role/caret `secondary[100/200]` (`Navbar.jsx:113,119,125`); toolbar chips use `secondary[700/900]` backgrounds which are near-white in light mode (`:57,66`).
- New-page Add button: bg `secondary.light`, text `background.alt` (`ExpensesPage.jsx:158`): 3.44:1, fails.
- Hard-coded: ag-grid sort icon/hover `#90caf9` pale blue (`AgDataGrid.jsx:149,160,168`), 1.75:1 on white and a fourth accent hue.

**Contrast failures (light mode unless noted):**

| Pair | Ratio (need 4.5, or 3 for non-text) |
|---|---|
| secondary[300] text on white (Header subtitle, nav labels, captions) | 2.28 |
| secondary.main logo on #f0f0f0 sidebar | 2.00 |
| secondary[200] on white / on #f0f0f0 (StatBox value, navbar role, sidebar role) | 3.92 / 3.44 |
| Sidebar active item: #4d547d on #cca752 | 3.20 |
| Add button: #f0f0f0 on #997d3d | 3.44 |
| MUI warning #ed6c02 outlined ("Sync Stats") on white / #f0f0f0 | 3.11 / 2.73 |
| MUI info #0288d1 outlined (Analytics, Reports) | 3.86 / 3.38 |
| CSS `'red'` negative values (`DashboardPage.jsx:198`, profitColor) | 4.00 / 3.51 |
| Disabled-module rows at opacity .55 (`ModulesPage.jsx:69`) | 3.69 |
| ag-grid sort icon #90caf9 (needs 3) | 1.75 |
| Default contained button #f0f0f0 vs white page (needs 3) | 1.14 |
| Dark: CSS `'green'` / `'red'` on navy cards | 2.66 / 3.42 |
| Dark: primary button #4d547d vs page #141937 (needs 3) | 2.35 |

Passing in light: body text 14-16:1, `secondary[100]` 6.4-7.3:1, MUI success green 5.1:1 (4.50 on #f0f0f0, borderline). In dark every gold token passes (10-16:1).

**Other findings:**
- `DashboardPage.jsx:198` `textColor = percentage > 0` compares a signed string to 0; the output is unused (display commented out, `:354-359`).
- The `.MuiDataGrid-*` style overrides (`DashboardPage.jsx` ~lines 435-475, and similar on other Dash/AllJobs pages) are **dead CSS**: the grid was migrated to ag-grid (`AgDataGrid.jsx`), so none of it applies.
- **ag-grid is always light** (`className="ag-theme-quartz"`, `AgDataGrid.jsx:193`; no dark variant). In dark mode every grid is a white slab on navy. Loading overlay is a flat `rgba(0,0,0,.2)` (`:187`).

## 2. Typography

- **Two font families in conflict.** `index.css:1` imports Inter 400/600/700 plus Lato 400/700/900 from Google Fonts via a blocking CSS `@import` (HTML > CSS > googleapis CSS > woff2 waterfall; no preconnect). `index.css:8` sets `html, body, #root` to Lato; `theme.js:114` sets MUI to Inter. MUI Typography renders in Inter; everything else in Lato. Components also use `fontWeight="light"` (300, `Statbox.jsx:43`) which is not loaded, so the browser falls back or fakes it.
- **Tiny base size.** `theme.js:115` `fontSize: 12` under MUI's formula yields approx body1 13.7px, body2/table cells/buttons 12px, caption 10.3px. Headings are fixed px: h1 40, h2 32, h3 24, h4 20, h5 16, h6 14 (`theme.js:116-139`). 12px table text and buttons is small on a phone outdoors.
- **No scale discipline.** Every `Header` is `h2` 32px bold (`Header.jsx:9`) regardless of screen width (a 32px title on a 360px phone). Pages mix `variant`, raw `fontSize="0.9rem"`, `"14px"`, `"0.8rem"`, `"26px"` (grep: DashboardPage alone has 11 `fontSize` and 24 px literals).
- **Title casing inconsistent:** old pages "Jobs", "Admins", "Customers"; new pages "EXPENSES", "DOCUMENTS", "INVOICES", "MAINTENANCE", "MODULES" in caps (`ExpensesPage.jsx:153`, `ModulesPage.jsx:32`). Sidebar labels "Overview", "View All", "$ Overview", "Daily" are cryptic out of context.
- Money columns have no tabular numerals; matters in profit tables.

## 3. Layout and responsiveness

**DelLayout (`DelLayout.jsx`):**
- One breakpoint, `min-width:600px` (`:8`). The rest use `1000/1200px` via `useMediaQuery` (5 and 10 usages). No `xs/sm/md` responsive `sx` anywhere (grep: zero).
- `isSidebarOpen` initialises `true` (`:9`), including on phones, so a 250px drawer covers the content on first load (layout is `display:block` on mobile, nothing shifts).
- No `<main>` landmark, no max content width.

**Sidebar (`Sidebar.jsx`):**
- Always `variant="persistent"` (`:254`). On mobile it is a fixed overlay with no backdrop, no swipe, no focus trap, and **tapping a nav item does not close it** (`:297-310` only navigates). Every navigation on a phone leaves the menu on top.
- **Active highlight is broken:** `active` = `pathname.substring(1)` e.g. `"del-dash-orders"` is compared with `text.toLowerCase()` e.g. `"overview"` (`:293,313`). Users never see where they are.
- **Hard-coded user name "Tapiwa Muranda"** shown in the footer for every user (`:363`).
- Footer not pinned to bottom (`:342`); `<div component="nav">` (`:248`) is not a nav landmark; group labels are plain Typography.
- Analytics items use special-case string names with trailing slashes and branchy onClick (`:56-58,298-309`).

**Navbar (`Navbar.jsx`):** no responsive handling: company-name outlined button, theme toggle, a **dead settings icon** (`:88`, no onClick), user name/role, caret in one row; crowds at 360px. Icon buttons lack `aria-label` (`:61,81,88`). Non-Clerk "Logout" item calls `handleClick` and just reopens the menu (`:137`).

**Page margins:** all 26 pages use `m="1.5rem 2.5rem"` (40px sides) with no mobile reduction; AddJob uses `0.1rem 5rem` (`AddJobPage.jsx:410`, 80px sides).

**Header toolbars:** `FlexBetween` is `space-between` without wrap. Dashboard puts Header, three outlined buttons (`m:1rem`, `padding:10px 20px`), YearSelect and "+ job" in one row (`DashboardPage.jsx:267-338`); overflows below about 900px. New pages have two items and mostly survive, but long subtitles squeeze the Add button (`ExpensesPage.jsx:153`).

**Tables:**
- Old pages: ag-grid with fixed `rowHeight=32` (`AgDataGrid.jsx:199`, below 44px touch guidance), `suppressCellFocus` (`:203`, kills keyboard cell navigation), `height 70vh`, `flex` columns with no min widths so columns crush on phones; no column hiding or card view.
- New pages: plain MUI `<Table size="small">` inside `overflowX:auto` (`ExpensesPage.jsx:193`); scrolls sideways correctly but no sticky first column. Profitability has about 13 columns (`ProfitabilityPage.jsx:62`), poor on phones. ExpensesPage fetches 500 rows with no pagination (`:69`).
- Dashboard grid uses `gridAutoRows:160px`, reflows only below 1200px (`DashboardPage.jsx:343-348`).

**Dialogs/forms:** 147 `<Dialog` usages, **zero `fullScreen`/responsive**. Fixed-width fields in flex rows (`TripsPage.jsx:346-370`: widths 90-160) wrap awkwardly on 360px. Fields are `size="small"` (40px, fine) but icon buttons are `size="small"` (~34px; `ExpensesPage.jsx:216`).

## 4. Old vs new consistency

| Aspect | Old (Dashboard, AllJobs, Vehicles, Drivers...) | New (Expenses, Trips, Invoices...) |
|---|---|---|
| Table | ag-grid, sortable, server pagination | MUI Table, whole list, no sort |
| Header buttons | outlined, 14px bold, `color=info/warning/success`, margin 1rem | contained; `secondary.light` bg or default (grey) primary |
| Title | "Jobs" + "See all your jobs." | "EXPENSES" + long sentence |
| Dialogs | MUI dialogs/popups with gold styling (`updateJobPopup.jsx` 11 gold usages) | plain default dialogs |
| Delete | custom popups | `window.confirm` (11 uses) |
| Loading | CircularProgress overlay in grid | text "Loading..." (`ExpensesPage.jsx:223`, `ProfitabilityPage.jsx:82`) |
| Empty | blank grid | one line of text, no action |
| Feedback | Snackbar/Alert (Dashboard) | react-hot-toast |

Zero Skeleton usage anywhere. Hard-coded dates will go stale: `ExpensesPage.jsx:60` (`from: "2026-01-01"`), `ProfitabilityPage.jsx:76` (years `[2026, 2025]`). The new pages mostly ignore the gold, which is a good instinct; the direction should be closer to them but backed by real tokens. Both sets share the same 2.5rem margin and `background.alt` card, which is the only real common ground.

## 5. Accessibility

- 76 `aria-label`s across 90 IconButtons. New pages mostly labelled (`ExpensesPage.jsx:216`); Navbar and Sidebar icon buttons are not (`Navbar.jsx:61,81,88`, `Sidebar.jsx:277`).
- No custom `:focus-visible` styling (MUI default only). `suppressCellFocus` removes keyboard grid focus. Sortable headers show hover colour only.
- Landmarks/headings: no `<main>`, invalid nav div, one `h2` per page used for size, `h5/h6` chosen for size not structure.
- Colour-only meaning: profit green/red (`ProfitabilityPage.jsx:42,89`); current nav item indicated by fill only (and broken). Estimates and left-in-business use text suffixes (good). Verify expiry chips in Documents carry text.
- Contrast failures from section 1 (WCAG 1.4.3 and 1.4.11).
- Touch targets: 32px grid rows, small icon buttons, 12px button text.
- `ModulesPage.jsx:41-47` uses a `span role="button"` handling Enter only (no Space); use a real Button.
- Static `<title>` "MyFleet" on every route. `lang` and viewport meta are set.

## 6. Performance

- **Single bundle `build/static/js/main.9b71f874.js`: 4.42 MB raw, 1.16 MB gzip** (measured), plus 45 KB gz CSS and two small chunks (513: 172 KB raw; 703: 22 KB). **Zero `React.lazy`/`Suspense`**; `App.js` imports every page eagerly, along with all nivo charts, html2pdf.js (jsPDF + html2canvas), ag-grid `AllCommunityModule` (`AgDataGrid.jsx:74-78`, registers every module), Clerk, and **two date-picker libraries** (react-datepicker and @mui/x-date-pickers) plus **two toast systems** (react-hot-toast, MUI Snackbar).
- On 3G/EDGE links (about 0.4-1 Mbps effective), 1.16 MB gz is roughly 10-25 s before anything but the empty shell shows; `public/index.html` has an empty `#root` and no loading shell.
- Fonts: two families via CSS `@import`, see section 2. Self-host one Inter (variable or 400/500/600/700) or use a system stack.
- Source maps (several MB) sit in `build/`; set `GENERATE_SOURCEMAP=false` for prod or make sure they are not served.
- API pattern: Dashboard fires 4-5 requests on mount (`DashboardPage.jsx:75-83`); ExpensesPage pulls 500 rows; no caching, every navigation refetches.
- `public/logos-clients` and sample images ship in the build; check they are not referenced on the first route.

## 7. Information architecture

Sidebar today (`Sidebar.jsx:60-226`), all modules on: Dashboard / Order Central (Overview, View All, Customers, Contractors) / Revenue ($ Overview, Daily, Monthly, Breakdown, Profitability, Expenses, Fuel Log) / Billing (Quotations, Invoices) / Trucking (Trips, Trailers, Documents, Maintenance) / Management (Admins, Vehicles, Drivers) / Settings (Modules). About **27 entries in 7 groups**; long scroll on a phone.

Problems:
- Group names don't match the task language. "Revenue" holds Expenses and Fuel Log; "Order Central > Overview" and "Revenue > $ Overview" are near-duplicate dashboards; Daily/Monthly/Breakdown are unlabeled report views; "Management" mixes admin users with fleet assets (Vehicles, Drivers) while Trailers sit under "Trucking".
- Module flags are not intuitive: Trailers and Documents share `tractorUnits` (`:179,185`), so toggling a module reshapes the menu unpredictably.
- First-time user: lands on Dashboard (`App.js:100`) showing zero StatBoxes, empty chart, empty grid. No "add your first vehicle/driver/job" guide, and nothing says Vehicles and Drivers must exist first. Optional modules appear only after settings load (`Sidebar.jsx:228-237`) with no explanation. Imports (Excel, photo) are buried inside pages.
- Dashboard actions mix primary (+ job), secondary (Analytics, Reports) and maintenance ("Sync Stats", a developer term) at equal weight.
- Routing clutter: analytics routes registered twice (`App.js:311-424` and `435-548`); Payments hidden/commented out.
- Empty states are single text lines with no next action.

## 8. Prioritised fixes (effort: S under half a day, M 1-3 days, L a week or more)

### A. Quick wins
1. **Fix gold-on-white in light mode (S).** Remap light `secondary[100..300]` to readable dark tones (for example #3b3220 / #5c4a1e / #7a5f1a, all >= 4.5:1), or better stop using gold for text (B1). One edit in `theme.js` fixes about 320 usages. Biggest "clean orange" win per minute.
2. **Make the default contained button visible (S):** light `primary.main` to the navy (#21295c) with white contrast text (`theme.js:95`); drop the per-button `secondary.light` override (`ExpensesPage.jsx:158` and similar).
3. **Mobile sidebar (S):** initial `isSidebarOpen = isNonMobile`; use `variant="temporary"` below 600px (gives backdrop and focus trap); close on nav click (`Sidebar.jsx:297`).
4. **Fix the active nav highlight (S):** compare against the real route, not the label (`Sidebar.jsx:293,313`).
5. **Remove hard-coded "Tapiwa Muranda" (`Sidebar.jsx:363`), the dead settings icon, fix non-Clerk logout, add `aria-label`s to Navbar/Sidebar icon buttons (S).**
6. **Responsive page margin and header (S):** `m={{xs:"1rem",md:"1.5rem 2.5rem"}}`, title 24px on xs, `FlexBetween` wraps with gap. Extract a `PageContainer` since 26 pages share the string.
7. **Calm the Dashboard action row (S):** one primary (+ Job); Analytics/Reports as quiet buttons; "Sync Stats" into a "More" menu; rename it.
8. **ag-grid dark theme (S):** `ag-theme-quartz-dark` when mode is dark; delete the `#90caf9` overrides in `AgDataGrid.jsx`; remove dead `.MuiDataGrid-*` CSS on the Dash pages.
9. **Fonts (S):** delete Lato (`index.css:1,8`), keep Inter only, preconnect or self-host; make body and MUI the same family.
10. **Stale years (S):** `ExpensesPage.jsx:60`, `ProfitabilityPage.jsx:76` derive from the current date.
11. **Route-level lazy loading (S-M):** `React.lazy` + `Suspense` for pages; dynamic-import html2pdf.js and nivo. Re-measure; target entry chunk well under 400 KB gz.
12. **`GENERATE_SOURCEMAP=false` in the prod build (S).**

### B. Design-system foundation
1. **Semantic tokens instead of index-based (M).** `background.default/paper/subtle`, `text.primary/secondary/disabled`, `primary` (navy, interactive), a single `accent` gold used only for brand mark, active-nav indicator and one or two highlights (never body text), `success/warning/error/info` custom values that pass 4.5:1 in both modes, `divider`. Retire `neutral` and `background.alt`. Keep the gold to roughly 5% of the screen; a darker amber (about #B7791F, 4.6:1 on white) when used on light surfaces.
2. **Type scale (S-M).** Inter only, 14-15px body (not 12), headings h1 28 / h2 24 / h3 20 / h4 18 / h5 16 with responsive steps, tabular numerals for money, weights 400/500/600 only.
3. **Spacing/radius/elevation tokens (S).** 8px grid, one card radius (12px), border plus subtle shadow instead of the offset grey shadow.
4. **MUI theme overrides (M).** Button (44px min height on touch, sentence case), TextField, Dialog (`fullScreen` below `sm`, sticky action bar), Table (cell padding, header style, sticky header), Chip, focus-visible ring (2px).
5. **Shared components (M-L).** `PageHeader` (title, subtitle, actions, wraps), `PageContainer`, `StatCard`, `DataTable` (ag-grid on desktop, card list on mobile; replace the three DataGridCustomToolbar variants), `EmptyState`, `LoadingState` (Skeleton), `ErrorState` (retry), `ConfirmDialog` (replace 11 `window.confirm`), `ResponsiveDialog`, `StatusChip` (icon + text + colour for expiry/paid/overdue).
6. **Navigation shell (M).** Responsive Drawer (permanent from md, temporary below), pinned user/org block, `nav` and `main` landmarks, collapsible groups, working active state, per-route document titles.
7. **Contrast regression test (S).** Reuse the scratchpad script over theme tokens so palette edits cannot reintroduce failures.

### C. Page-by-page revamp (by user impact)
1. **Dashboard (L).** Four KPIs (jobs, revenue, profit, outstanding invoices), one revenue chart, a "needs attention" list (expiring documents, overdue invoices, maintenance due), first-run onboarding checklist (add vehicle, driver, customer, first job).
2. **Shell and IA (M).** Regroup to about 5 groups: Overview; Operations (Jobs, Trips, Customers, Contractors); Fleet (Vehicles, Trailers, Drivers, Documents, Maintenance); Money (Quotations, Invoices, Expenses, Fuel Log, Profitability, Reports); Settings (Users, Modules). Fold Daily/Monthly/Breakdown into one Reports page with tabs. Decouple Trailers/Documents module flags.
3. **List pages: AllJobs, Customers, Vehicles, Drivers, Contractors, Admins (M total once DataTable exists, ~S each).** Shared template: search and filter bar, mobile card view, row-action menu, empty state with CTA.
4. **Add Job (M-L).** Core daily task: single-column, large inputs, draft autosave, fullScreen on mobile.
5. **New pages: Expenses, Fuel Log, Trips, Documents, Trailers, Maintenance, Invoices, Quotations (S-M each).** Adopt PageHeader/DataTable/ConfirmDialog/StatusChip, pagination, skeletons, fullScreen dialogs on mobile. Profitability (M): summary cards first, month table, vehicle table behind a toggle, sticky first column.
6. **Login/Register/Forgot (S).** Inherit the new tokens; first impression for prospects (6-9 gold usages plus hex each).
7. **Analytics and reports (L, last).** Tokenised nivo theme, responsive chart heights, delete duplicate routes.

### D. Leave alone
- Redux store/actions and data model; the module-toggle filtering logic itself (`Sidebar.jsx:228-237` is sound; fix labels and grouping only).
- ag-grid as the desktop grid engine: wrap and theme it, do not re-migrate.
- Clerk auth wiring. Pick react-hot-toast as the single feedback channel and retire Snackbar gradually.
- Photo-import review table's inline-edit approach (`PhotoImportPanel.jsx`); just apply tokens and make it scroll cleanly on mobile.
- Dark mode: it is the stronger mode; use it as the reference when tuning light mode. Keep the brand navy; do not flatten to white-on-white minimalism.
- Chart data logic; restyle only.

## Suggested order
Week 1: A1-A12. Week 2: B1-B6. Weeks 3-5: C1-C5. Later: C6-C7 and polish.

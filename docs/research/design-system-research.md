# myFleet design system research

Date: 2026-11-03. Scope: dashboard (MUI v5) and marketing site. Owner decision applied: **ink and ivory with one deep emerald accent**.

Evidence labels: **[V]** verified from a fetched page, **[S]** from search snippets or third-party summaries only, **[U]** unverified or from general knowledge (check before relying on it).

Contrast figures in section 3 were computed with `C:\Users\ROPAFA~1\AppData\Local\Temp\claude\C--Users-Ropafadzo-Muridzi-Documents-tapiwa-projects-myfleet\fd44ae12-8d59-4306-8ee1-b0dd00aad2ae\scratchpad\contrast.js` (WCAG 2.x relative-luminance formula). Run it with `node contrast.js`. Result: 0 failures on the final token sets.

---

## 1. What makes Apple and Microsoft feel premium and simple

### Apple (HIG)
Apple's HIG typography and colour pages returned only their titles when fetched, so most of this is **[U]/[S]** and not quoted from Apple. The Materials page was confirmed through search **[S]**. Verify against https://developer.apple.com/design/human-interface-guidelines before quoting.

Copyable principles:
1. **Content first (clarity, deference, depth).** The UI recedes and the data is the hero. This is a third-party summary of the HIG **[S]** (https://tessl.io/registry/skills/github/popey/claude-code-skills/hig-foundations). For myFleet: no decorative backgrounds behind tables, and no chrome heavier than the content.
2. **Semantic text styles, few weights.** The HIG names Large Title, Title, Headline, Body, Callout, Subhead, Footnote and Caption, with iOS Body at 17pt and Footnote at 13pt **[U]**. Use a named scale rather than ad hoc sizes, and use only 3 weights (400/500/600).
3. **Optical sizing and tracking.** Large text gets tighter tracking, small text gets looser **[U]**. Apply this as a negative letter-spacing that grows with size.
4. **Accent restraint.** One tint colour is reserved for interactive and key elements **[U]**. Everything else is neutral, which is what makes it look expensive.
5. **Semantic colour names with light and dark variants** (error, not "red") **[U]**. This maps to the token names below.
6. **Materials and blur.** Translucency separates foreground from background layers **[S]** (https://developer-mdn.apple.com/design/human-interface-guidelines/foundations/materials). It costs GPU on mid-range Android, so use it only on one or two surfaces (a sticky mobile header at most), with a solid fallback. Prefer solid warm surfaces plus hairline borders.
7. **Motion** is short, purposeful, interruptible, and has a Reduce Motion alternative (crossfade) **[S]**. See section 5.

### Microsoft (Fluent 2) **[V]** unless marked
- **Type ramp (web, px, size/line-height)** from https://fluent2.microsoft.design/typography: Caption 12/16, Body 14/20, Subtitle 16/22 (semibold), Subtitle 1 20/26, Title 3 24/32, Title 2 28/36, Title 1 32/40, Large Title 40/52, Display 68/92. Headings use semibold, body uses regular. The ramp is small: 14px body, 1.43 line-height.
- **Segoe UI Variable** is the Windows face (display and text optical sizes). Segoe UI is the web default. Every other platform uses its native face (SF Pro on Apple, Roboto on Android). Principle: default to the platform's native system font. Fluent also says: sentence case, avoid all caps, 4.5:1 contrast for normal text and 3:1 for large text.
- **Spacing:** 4px base with 2, 6 and 10 as exceptions: 0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 36, 40, 48, 52, 56 (https://fluent2.microsoft.design/layout). Grid is 12 columns. Breakpoints are 320, 480, 640, 1024, 1366 and 1920.
- **Elevation** (https://fluent2.microsoft.design/elevation): every shadow is a pair of one sharp key shadow and one soft ambient shadow, from a single light direction. Levels are 2, 4, 8, 16, 28 and 64. Windows uses strokes in place of key shadows. Dark mode raises shadow opacity (about 28%). Low levels are cards, high levels are dialogs.
- **Neutral and brand ramps** (Fluent colour page): I did not fetch it **[U]**. The pattern is grey ramp steps with explicit foreground/background/stroke roles per state, which our tokens follow.

Copyable Fluent rules: 4px grid, small ramp with 14px body, shadows as key plus ambient pair, strokes before shadows, native font by platform.

---

## 2. Fonts

### Licensing facts
| Font | Self-host on a website? | Evidence |
|---|---|---|
| **SF Pro** (and SF Mono, SF Compact, etc.) | **No.** The Apple font licence covers use for mock-ups of UI for Apple platforms and prohibits embedding and website use. Apple forum answers say no, and point to `system-ui` | **[S]** https://developer.apple.com/forums/thread/733267, https://developer.apple.com/forums/thread/127350, https://lowendmac.com/2025/site-graphics-our-new-banner-and-one-more-thing/ . Not legal advice. Authoritative text is inside the download at developer.apple.com/fonts |
| **Segoe UI / Segoe UI Variable** | **Not freely.** Microsoft's page says the font can be *licensed* for web developers through its redistribution FAQ and enterprise licensing. A Syncfusion thread quotes "not available for web apps not made by Microsoft" **[S]**. The embedded licence text limits use to the font's embedding permissions | **[S]** https://learn.microsoft.com/fr-be/typography/font-list/segoe-ui , https://www.syncfusion.com/forums/179417/use-segoe-ui-font-in-web-text |

Conclusion: do not host either. Referencing them through the CSS system stack (`system-ui`) is fine, because the user's device supplies the font and we ship no file.

### Open, web-licensable options (all SIL OFL 1.1)
- **Inter** is free and open source under the OFL 1.1, variable (weights 100 to 900, optical size axis), with 2,000+ glyphs, tabular numerals, slashed zero and case alternates **[V]** https://rsms.me/inter/ . Excellent for dense data.
- **Instrument Serif** is OFL 1.1, a single weight (400), upright and italic **[V]** https://fontsource.org/fonts/instrument-serif . One small file, so it suits a low-bandwidth headline face.
- **Instrument Sans** is OFL 1.1, variable, weights 400 to 700 **[V]** https://fontsource.org/fonts/instrument-sans . Warmer than Inter and a decent alternative.
- **Fraunces** is OFL 1.1, variable, weight 100 to 900 with italic **[V]** https://fontsource.org/fonts/fraunces . It is characterful ("soft" serif), so it is more costly in bytes and less restrained.
- **Geist** and **Plus Jakarta Sans**: licence believed OFL **[U]**. I did not verify Geist's licence. Plus Jakarta is rounder and more startup-feeling. Rejected for tone.
- Note: Fontsource says Geist replaces a Fontsource "geist-sans"-slot family that is "no longer actively maintained" **[V]**. Not decisive.

### Recommendation
**Dashboard stack: Inter (variable, wght axis only, Latin subset) with a metric-matched system fallback.**
`font-family: "Inter var", Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;`
Reasons: tabular numerals for odometer, litres and money columns (`font-feature-settings: "tnum" 1, "cv11" 1`), exceptional small-size legibility on low-DPI Android screens, widest tooling support.

**Marketing stack: Instrument Serif 400 for headlines + Inter for everything else.**
Headline: `"Instrument Serif", "Iowan Old Style", Georgia, serif`. The thin-capital geometric wordmark is the signature, and a refined serif at display size gives editorial elegance while sharing Inter with the dashboard (cached after the first visit). Never use the serif below 28px, and never bold it.

### Loading strategy for slow, expensive data
- **Budget:** dashboard = 1 font file. Marketing = 2 files (Inter variable + Instrument Serif 400). Weights used: Inter 400, 500, 600 only (one variable file covers them). Serif: 400 only. No italics shipped. No 700.
- **File size:** Latin-subset WOFF2 of Inter variable (wght only) is roughly 30 to 50 KB **[U]** and Instrument Serif 400 roughly 15 to 25 KB **[U]**. Measure with the real build and enforce a CI budget of 120 KB total font transfer on marketing and 60 KB on the dashboard.
- **Subset to Latin + Latin-Extended-A is unnecessary.** Shona and Ndebele use plain Latin, so use `unicode-range` Latin only (U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+20AC (euro), U+2122, U+2212). Add `$` (already ASCII) and the ZiG symbol if needed.
- Use the `@fontsource-variable/inter` package (wght only), not the full axes file with opsz, unless you accept the extra size **[U]**.
- `font-display: swap` for body, `optional` for the serif headline on marketing (if it is slow, the system serif shows and nothing shifts).
- `<link rel="preload" as="font" type="font/woff2" crossorigin>` for the single Inter file only.
- Fallback with `size-adjust`/`ascent-override` metric matching (use the Fontaine or Next.js `adjustFontFallback` approach) to prevent layout shift **[U]**.
- Self-host with long-lived immutable caching (`Cache-Control: public, max-age=31536000, immutable`). No Google Fonts runtime request (extra DNS and TLS round-trip on a slow link).
- Option for the worst connections: an `@media (prefers-reduced-data: reduce)` block (support is limited **[U]**) or the `Save-Data` header can drop to the system stack, which already looks good.

### Type scale: dashboard (Inter)
Base unit 14px on desktop and 15px under 600px (inputs always 16px on mobile to avoid browser zoom). Pixels, line-height, weight, tracking.

| Token | Size / line | Weight | Tracking | Use |
|---|---|---|---|---|
| caption | 12 / 16 | 400 | +0.01em | meta, helper text |
| label | 13 / 16 | 500 | 0 | form labels, table headers, chips |
| body | 14 / 20 | 400 | 0 | default, table cells |
| body-lg | 16 / 24 | 400 | 0 | mobile body, dialog text |
| subtitle | 16 / 22 | 600 | -0.005em | card titles |
| h3 | 18 / 26 | 600 | -0.01em | section titles |
| h2 | 22 / 28 | 600 | -0.015em | page sections |
| h1 | 28 / 34 | 600 | -0.02em | page title |
| metric | 32 / 36 | 600 | -0.02em, `tnum` | KPI numbers |

Rules: sentence case everywhere (Fluent). Numeric columns right-aligned with `tnum`. Never below 12px.

### Type scale: marketing (Instrument Serif + Inter)
| Token | Size / line | Font, weight | Tracking |
|---|---|---|---|
| hero | clamp(40px, 7vw, 72px) / 1.04 | Instrument Serif 400 | -0.02em |
| h2 | clamp(30px, 4.5vw, 48px) / 1.1 | Instrument Serif 400 | -0.015em |
| h3 | 28 / 34 | Instrument Serif 400 | -0.01em |
| lead | 20 / 30 | Inter 400 | -0.005em |
| body | 17 / 28 | Inter 400 | 0 |
| small | 14 / 22 | Inter 400 | 0 |
| eyebrow | 12 / 16 | Inter 500, uppercase | +0.14em (echoes wordmark capitals; short strings only) |
| button | 15 / 20 | Inter 500 | 0 |

---

## 3. Colour

### Chosen palette: "Ink and Ivory, Emerald" (recommended and owner-approved)
Near-black warm ink, warm off-white surfaces, and one restrained deep emerald. Warm neutrals (slight yellow undertone) are what stop it reading as cold SaaS grey. No gradients, no glow.

All pairs below are **computed**. Text needs 4.5:1, UI boundaries and focus rings need 3:1.

#### Light tokens
| Token | Hex | Checks |
|---|---|---|
| bg (ivory) | `#FAF8F3` | base |
| surface | `#FFFFFF` | cards, dialogs |
| surface-sunken | `#F2EFE7` | table header, hover, inputs fill |
| border (decorative hairline) | `#E3DED2` | 1.26:1 vs bg; decorative only |
| border-strong (inputs, checkbox) | `#8A8579` | 3.46 on bg, 3.68 on surface |
| text-primary (ink) | `#15140F` | 17.37 bg, 18.44 surface, 16.05 sunken |
| text-secondary | `#4F4B43` | 8.18 bg, 7.55 sunken |
| text-tertiary | `#6B665B` | 5.38 bg, 4.97 sunken (lowest allowed text tone) |
| accent | `#0E5A43` | 7.72 on bg, 8.20 on surface, 7.13 on sunken |
| accent-hover | `#0A4634` | ivory text on it 10.21 |
| on-accent | `#FAF8F3` | on accent 7.72 |
| accent-subtle | `#E2EEE7` | accent text on it 6.88 |
| success | `#2F6B1F` (subtle bg `#E6F0DE`) | 6.10 / 5.51 |
| warning | `#8A5200` (subtle `#F7EBD3`) | 6.02 / 5.41 |
| danger | `#B1261B` (subtle `#F8E3DF`) | 6.26 / 5.39, white on it 6.64 |
| info | `#2B5876` (subtle `#E1ECF2`) | 7.17 / 6.33 |
| focus ring | `#0E5A43`, 2px + 2px offset | 7.72 |

#### Dark tokens
| Token | Hex | Checks |
|---|---|---|
| bg (near-black) | `#0E0E0C` | base |
| surface | `#171715` | cards |
| surface-raised | `#1F1F1C` | dialogs, menus |
| border (decorative) | `#2D2C28` | hairline |
| border-strong | `#7A766B` | 4.26 bg, 3.96 surface |
| text-primary | `#F3F0E8` | 16.97 bg, 15.76 surface, 14.51 raised |
| text-secondary | `#B8B3A7` | 9.24 bg, 7.90 raised |
| text-tertiary | `#8F8A7F` | 5.62 bg, 4.81 raised |
| accent | `#4DBF93` (text/link) | 8.46 bg, 7.86 surface, 7.23 raised |
| accent-fill (buttons) | `#3FAF85`, hover `#52C196` | **ink `#0E0E0C` text on it 7.07 / 8.67** |
| accent-subtle | `#10281F` | accent text on it 6.83 |
| success | `#7FC96A` (subtle `#1B2A14`) | 9.63 / 7.54 |
| warning | `#E2A93B` (subtle `#2E2410`) | 9.18 / 7.25 |
| danger | `#F0786C` (subtle `#341613`) | 7.00 / 5.99 |
| info | `#7DB4D6` (subtle `#13242E`) | 8.62 / 7.10 |
| focus ring | `#4DBF93` | 8.46 |

#### Where the green fails, and the fix
- The dark-mode green (`#3FAF85`) on ivory is only **2.58:1**. It fails AA, so the accent is a **separate token per mode**, never reused across modes.
- On the dark accent fill, white text would fail (about 2.6:1), so dark-mode buttons use **ink text**, not white.
- A mid emerald `#2A7D5F` passes at 4.71 on ivory but is too thin a margin on sunken surfaces, so it was rejected. `#1B6B4F` passes at 6.06 and is the lightest acceptable green if `#0E5A43` ever feels too dark.
- Green overlaps with "success". Fix: success is a yellower, olive-leaning green (`#2F6B1F`), the accent is blue-leaning emerald. Status is **never colour alone**: always an icon plus a word (Paid, Overdue). Links are underlined.

### Comparison with the other two candidates (light mode, computed)
| | Strength | Weakness |
|---|---|---|
| **A. Ink/Ivory/Emerald (chosen)** | accent 7.72 on ivory, calm, distinct from the typical blue SaaS look, suits a wordmark in thin black capitals | green vs "success" semantics (solved above) |
| B. Graphite and Brass | brass has to be darkened to `#7A5B12` for 5.69 (`#8A6A1F` is only 4.55), which turns muddy olive. Reads "private bank". Competes with the yellow in the Allea logo | the lowest-contrast and the riskiest |
| C. Midnight Navy and Bone (copper `#9A4F2B` at 5.28) | navy accent 10.18, very safe | navy is the default logistics and SaaS colour, and the existing app is already navy `#21295c`, so it would not feel new |

### The Allea Worldwide logo (viewed: `frontend/public/logos-clients/alleaworldwide-logo-removebg-preview.png`)
It is a transparent PNG with black circular text and four swirl arrows: yellow, blue, magenta and green.
- **On ivory (light):** sits well. The warm ground suits the four saturated colours. Logos are exempt from text contrast, but for reference: blue 3.57, magenta 4.80, green 2.96, yellow 1.72 on ivory. The yellow is visually light but acceptable in a logo.
- **On dark:** the **black text vanishes (1.09:1)**. Do not place this PNG straight onto dark. Put it on an ivory rounded tile (12px radius, 12px padding) or request a reversed (white text) asset from the client.
- **Versus emerald:** the logo's bright green (`#4BA43C`-ish) is lighter and more yellow than our deep emerald, so they do not clash, but keep the logo away from primary CTA buttons. Show client logos only in a "trusted by" strip or a client detail header, on a neutral tile, in full colour. Fall back to a greyscale mode in dense lists.
- Palette colours must never be sampled from the logo: the client's brand and the myFleet brand stay separate.

### myFleet wordmark
Thin geometric MYFLEET capitals: ink `#15140F` on ivory `#FAF8F3`, or ivory `#F3F0E8` on `#0E0E0C`. Both contrast above 16:1. Use weight 200 to 300 only above 20px height, and use the 400 variant at small sizes (favicon, mobile header). Emerald is never used on the wordmark. A small emerald square or dot as a mark is the only place the accent appears in the logo.

### What to do about the current orange
Retire it as a brand colour. The repo's theme currently carries a navy primary and a yellow secondary (`frontend/src/theme.js`), and the logo drafts use orange; I only grepped, I did not audit every usage. Replace as follows:
- CTA and links: emerald.
- "Needs attention" status: ochre warning `#8A5200` text on `#F7EBD3`, always with an icon. It is a muted amber and not a CTA colour.
- Remove the yellow secondary. Charts: use ink, emerald, ochre and slate-info plus pattern or labels, not a rainbow.

---

## 4. MUI v5 mapping

```js
// theme.js (sketch). Build via createTheme(getDesignTokens(mode)).
const T = {
  light: { bg:'#FAF8F3', surface:'#FFFFFF', sunken:'#F2EFE7', border:'#E3DED2', borderStrong:'#8A8579',
    text:'#15140F', text2:'#4F4B43', text3:'#6B665B',
    accent:'#0E5A43', accentHover:'#0A4634', onAccent:'#FAF8F3', accentSubtle:'#E2EEE7',
    success:'#2F6B1F', warning:'#8A5200', danger:'#B1261B', info:'#2B5876' },
  dark:  { bg:'#0E0E0C', surface:'#171715', sunken:'#1F1F1C', border:'#2D2C28', borderStrong:'#7A766B',
    text:'#F3F0E8', text2:'#B8B3A7', text3:'#8F8A7F',
    accent:'#3FAF85', accentHover:'#52C196', onAccent:'#0E0E0C', accentSubtle:'#10281F',
    success:'#7FC96A', warning:'#E2A93B', danger:'#F0786C', info:'#7DB4D6' },
};
const font = '"Inter var", Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const ease = 'cubic-bezier(0.23, 1, 0.32, 1)';

export const getTheme = (mode) => { const c = T[mode]; return createTheme({
  palette: {
    mode,
    primary:   { main: c.accent, dark: c.accentHover, light: c.accentSubtle, contrastText: c.onAccent },
    secondary: { main: c.text2, contrastText: c.bg },          // neutral, no second brand hue
    success: { main: c.success }, warning: { main: c.warning },
    error:   { main: c.danger },  info:    { main: c.info },
    background: { default: c.bg, paper: c.surface },
    text: { primary: c.text, secondary: c.text2, disabled: c.text3 },
    divider: c.border,
    action: { hover: c.sunken, selected: c.accentSubtle, focus: c.accentSubtle },
  },
  typography: {
    fontFamily: font,
    fontWeightRegular: 400, fontWeightMedium: 500, fontWeightBold: 600,   // 600 is our top weight
    h1: { fontSize: '1.75rem',   lineHeight: '34px', fontWeight: 600, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.375rem',  lineHeight: '28px', fontWeight: 600, letterSpacing: '-0.015em' },
    h3: { fontSize: '1.125rem',  lineHeight: '26px', fontWeight: 600, letterSpacing: '-0.01em' },
    subtitle1: { fontSize: '1rem', lineHeight: '22px', fontWeight: 600 },
    body1: { fontSize: '0.875rem', lineHeight: '20px' },                 // 14px
    body2: { fontSize: '0.8125rem', lineHeight: '18px' },
    caption: { fontSize: '0.75rem', lineHeight: '16px', letterSpacing: '0.01em' },
    button: { fontSize: '0.875rem', fontWeight: 500, textTransform: 'none', letterSpacing: 0 },
  },
  shape: { borderRadius: 8 },
  spacing: 4,
  shadows: ['none', ...Array(24).fill('0 1px 2px rgba(21,20,15,.06), 0 8px 24px rgba(21,20,15,.08)')], // popovers only; use borders for cards
  components: {
    MuiCssBaseline: { styleOverrides: { body: { fontFeatureSettings: '"cv11","ss03"', WebkitFontSmoothing: 'antialiased' },
      '@media (prefers-reduced-motion: reduce)': { '*': { animationDuration: '0.01ms !important', transitionDuration: '0.01ms !important' } } } },
    MuiButton: { defaultProps: { disableElevation: true },
      styleOverrides: { root: { minHeight: 40, borderRadius: 8, transition: `background-color 150ms ${ease}, transform 120ms ${ease}`,
        '&:active': { transform: 'scale(0.98)' }, '&.Mui-focusVisible': { outline: `2px solid ${c.accent}`, outlineOffset: 2 } },
        outlined: { borderColor: c.borderStrong, color: c.text } } },
    MuiTableCell: { styleOverrides: { root: { borderBottom: `1px solid ${c.border}`, padding: '10px 16px' },
      head: { backgroundColor: c.sunken, color: c.text2, fontSize: '0.8125rem', fontWeight: 500 } } },
    MuiTableRow: { styleOverrides: { root: { '&:hover': { backgroundColor: c.sunken } } } },  // no zebra stripes
    MuiDialog: { styleOverrides: { paper: { borderRadius: 12, border: `1px solid ${c.border}`, backgroundImage: 'none' } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' }, outlined: { borderColor: c.border } } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 8, backgroundColor: c.surface, fontSize: 16, // 16px stops mobile zoom
      '& fieldset': { borderColor: c.borderStrong }, '&:hover fieldset': { borderColor: c.text2 },
      '&.Mui-focused fieldset': { borderColor: c.accent, borderWidth: 2 } } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 6, fontWeight: 500, fontSize: '0.8125rem', height: 26 } } },
    MuiTabs: { styleOverrides: { indicator: { height: 2, backgroundColor: c.accent } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 500, minHeight: 44, color: c.text2, '&.Mui-selected': { color: c.text } } } },
  },
});};
```

Notes: avoid the `Inter var` filename mismatch by registering one `@font-face` named `"Inter var"`. Do not use `Roboto` imports (MUI's default pulls extra weights). In `MuiTableCell`, add `fontVariantNumeric: 'tabular-nums'` for numeric columns. Touch targets 44px on mobile (Tab minHeight 44). Chips for status should include an icon, not colour alone.

### CSS variables (marketing page)
```css
:root {
  --bg:#FAF8F3; --surface:#FFFFFF; --sunken:#F2EFE7; --border:#E3DED2; --border-strong:#8A8579;
  --text:#15140F; --text-2:#4F4B43; --text-3:#6B665B;
  --accent:#0E5A43; --accent-hover:#0A4634; --on-accent:#FAF8F3; --accent-subtle:#E2EEE7;
  --success:#2F6B1F; --warning:#8A5200; --danger:#B1261B; --info:#2B5876;
  --font-sans:"Inter var",Inter,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
  --font-display:"Instrument Serif","Iowan Old Style",Georgia,serif;
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-6:24px; --space-8:32px; --space-12:48px; --space-16:64px; --space-24:96px;
  --radius-sm:6px; --radius:8px; --radius-lg:12px;
  --ease:cubic-bezier(0.23,1,0.32,1); --dur-fast:120ms; --dur:200ms; --dur-slow:320ms;
  --max:1120px; --measure:62ch;
}
@media (prefers-color-scheme: dark) { :root {
  --bg:#0E0E0C; --surface:#171715; --sunken:#1F1F1C; --border:#2D2C28; --border-strong:#7A766B;
  --text:#F3F0E8; --text-2:#B8B3A7; --text-3:#8F8A7F;
  --accent:#4DBF93; --accent-hover:#52C196; --on-accent:#0E0E0C; --accent-subtle:#10281F; /* fill uses #3FAF85 */
  --success:#7FC96A; --warning:#E2A93B; --danger:#F0786C; --info:#7DB4D6; } }
h1,h2,h3 { font-family:var(--font-display); font-weight:400; letter-spacing:-0.02em; text-wrap:balance; }
body { font:400 17px/1.65 var(--font-sans); color:var(--text); background:var(--bg); }
a { color:var(--accent); text-underline-offset:3px; }
```
Dark-mode note: a filled button on dark uses background `#3FAF85` with `--on-accent` ink text. Text-coloured accent uses `#4DBF93`. Keep these two separate variables (`--accent-fill`, `--accent`) in the real file.

---

## 5. Motion and polish

Source: `emil-design-eng` and `apple-design` skills were not invoked in this run. These rules come from my general knowledge of those philosophies **[U]**, not from the skill text. Check them against the skills before locking.

- **Durations:** press feedback 100 to 140ms. Hover and colour 150ms. Menus, popovers, tooltips 150 to 200ms. Dialogs and sheets 200 to 280ms. Page-level 320ms max. Nothing in the dashboard over 300ms (people repeat these actions all day).
- **Easing:** enter and exit with a strong ease-out `cubic-bezier(0.23, 1, 0.32, 1)`. Movement on screen uses ease-in-out `cubic-bezier(0.77, 0, 0.175, 1)`. Never `ease-in` for UI and never linear except progress bars. Exit is faster than enter (about 70%).
- **Animate only `transform` and `opacity`** (compositor, cheap on mid-range Android). Do not animate height, width, blur or box-shadow on lists.
- **Scale from 0.96 to 1, not from 0.** Popovers originate from their trigger (`transform-origin`). Buttons `:active` at `scale(0.98)`.
- **Interruptible:** use CSS transitions (not keyframes) for interactive state so reversing mid-way works.
- **Stagger:** at most 30 to 50ms per item and cap at 6 items. Skip stagger on tables.
- **Frequency rule:** things used dozens of times a day (table row hover, tab switch, sorting) get no motion beyond a colour change.
- **Reduced motion:** under `prefers-reduced-motion: reduce`, replace movement with an opacity crossfade of at most 100ms, and remove parallax and auto-playing animation. Provided as a CssBaseline rule in section 4.
- **Low-end devices:** no scroll-linked effects, no backdrop-filter on scrolling surfaces, no autoplay video on marketing. Use a still poster image (WebP/AVIF, under 80 KB).
- **Skeletons over spinners** for tables, with static (non-shimmering) blocks if the device is slow.
- **Polish details:** `text-wrap: balance` on headings, `tabular-nums` on figures, concentric radii (inner radius = outer minus padding), 1px hairline borders at `--border`, optical alignment of icons, consistent 4px rhythm, image outlines of 1px at 8% ink to lift white images off ivory.

---

## 6. Anti-generic checklist (what reads as AI-generated, and the fix)
1. **Purple/blue gradient hero and glow orbs.** Use flat ivory with ink type. No gradients at all.
2. **Neon orange or electric accent on a dark navy.** One deep emerald, used on fewer than 5% of pixels.
3. **Inter at one weight everywhere with centred everything.** Use the serif headline on marketing, left-aligned asymmetric layouts, and a real hierarchy of 3 weights.
4. **Three identical icon-in-circle feature cards.** Use one large real screenshot or a table fragment, plus numbered prose rows.
5. **Emoji or generic Lucide icons as decoration.** Use icons only where they carry meaning (status, actions), with a single stroke weight.
6. **Glassmorphism and shadow-heavy cards.** Hairline borders on warm surfaces, shadows only for floating layers.
7. **Pill-shaped everything and 16 to 24px radii.** 6 to 8px controls and 12px containers.
8. **Stock-photo trucks and vague copy ("Supercharge your logistics").** Use real specifics: "Log a trip in 20 seconds, even offline", with real screenshots and Zimbabwean context (USD and ZiG, border posts like Beitbridge, a real client such as Allea).
9. **Centred full-width gradient CTA banner at the end.** A plain ink button on ivory with one sentence.
10. **Lorem-perfect empty states with no data.** Use realistic seed data in screenshots (real routes, real plate formats).
11. **Zebra-striped tables with coloured header bars.** Sunken header, hairlines, hover only.
12. **Colour-only status.** Icon plus label plus colour.
13. **Dark mode as an inverted afterthought.** Separate, tuned tokens (section 3) and separate accent for dark.
14. **Excess bounce and spring on everything.** Short ease-out and nothing on high-frequency actions.

---

## 7. Open items and things not verified
- Apple HIG typography, colour and motion pages returned no body text. Section 1 Apple items are **[U]/[S]**.
- Fluent 2 colour page and corner-radius tokens were not fetched.
- Geist and Plus Jakarta Sans licences were not confirmed. Font file sizes are estimates. Measure after building.
- The `apple-design`, `emil-design-eng`, `ui-ux-pro-max` and `impeccable` skills were not invoked, so their rule sets are not cited here.
- Legal: SF Pro and Segoe UI web-licensing conclusions are from forums and third-party summaries, not the licence text.
- Run the contrast script again after any hex change. A real-device check on a mid-range Android in sunlight is recommended for `text-tertiary`.

## Sources
- https://fluent2.microsoft.design/typography
- https://fluent2.microsoft.design/layout
- https://fluent2.microsoft.design/elevation
- https://developer.apple.com/forums/thread/733267
- https://developer.apple.com/forums/thread/127350
- https://lowendmac.com/2025/site-graphics-our-new-banner-and-one-more-thing/
- https://learn.microsoft.com/fr-be/typography/font-list/segoe-ui
- https://www.syncfusion.com/forums/179417/use-segoe-ui-font-in-web-text
- https://developer-mdn.apple.com/design/human-interface-guidelines/foundations/materials
- https://tessl.io/registry/skills/github/popey/claude-code-skills/hig-foundations
- https://rsms.me/inter/
- https://fontsource.org/fonts/instrument-serif
- https://fontsource.org/fonts/instrument-sans
- https://fontsource.org/fonts/fraunces

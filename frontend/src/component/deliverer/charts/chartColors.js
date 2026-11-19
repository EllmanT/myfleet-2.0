// Shared colour + text rules for every Nivo chart (pies and bars).
//
// Problems this replaces: slices were 3-4 shades of ONE blue (hard to tell apart,
// and `undefined` past the 4th contractor), legend text was hardcoded "#000"
// (invisible on the dark surface), and arc labels were "darker 2" of the slice.
//
// Rules:
//  - Categorical hues are spread around the colour wheel and ordered so
//    neighbouring slices never look alike. Each mode has its own set, tuned
//    for >= 3:1 against that mode's card surface (WCAG non-text contrast).
//  - Slices are separated by a surface-coloured gap, not a darker outline.
//  - Any text drawn on a slice is black or white, whichever has more contrast.
//  - Any text drawn on the card uses theme.palette.text.primary.

const LIGHT = [
  "#0B2F5E", // navy (brand)
  "#C2570C", // burnt orange
  "#0F766E", // teal
  "#B0236F", // magenta
  "#B7791F", // gold
  "#6D3FC0", // violet
  "#2F7D32", // green
  "#B1261B", // red
  "#1F7AB8", // sky
  "#6B5B45", // umber
];

const DARK = [
  "#7AA7E8", // blue (brand accent)
  "#F0A04B", // orange
  "#4FD1C5", // teal
  "#F08CB8", // pink
  "#E8D44D", // yellow
  "#B79CF0", // violet
  "#7FC96A", // green
  "#F0786C", // coral
  "#7DD3FC", // sky
  "#D6C7A1", // sand
];

// n colours for the current mode; past 10 slices the hues repeat with a lightness shift
export const chartColors = (theme, n = 10) => {
  const base = theme.palette.mode === "dark" ? DARK : LIGHT;
  return Array.from({ length: n }, (_, i) => {
    const c = base[i % base.length];
    return i < base.length ? c : shade(c, theme.palette.mode === "dark" ? -0.25 : 0.3);
  });
};

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const lum = (hex) => {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};

// black or white, whichever reads better on `hex`
export const readableOn = (hex) => (lum(hex) > 0.179 ? "#0B1220" : "#FFFFFF");

// Nivo `theme` prop: all chart text uses the card's text colours, never the slice colour
export const nivoTheme = (theme) => {
  const text = theme.palette.text.primary;
  const muted = theme.palette.text.secondary;
  const grid = theme.palette.divider;
  return {
    text: { fill: text, fontSize: 12 },
    axis: {
      domain: { line: { stroke: muted } },
      legend: { text: { fill: text, fontSize: 12 } },
      ticks: { line: { stroke: muted, strokeWidth: 1 }, text: { fill: muted, fontSize: 12 } },
    },
    grid: { line: { stroke: grid } },
    legends: { text: { fill: text, fontSize: 12 } },
    labels: { text: { fill: text, fontSize: 12 } },
    tooltip: {
      container: {
        background: theme.palette.background.paper,
        color: text,
        fontSize: 13,
        border: `1px solid ${theme.palette.divider}`,
        boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
      },
    },
  };
};

// Props shared by every <ResponsivePie>. Spread them, then set data/margin/legends per chart.
// Data items must carry `color` (use chartColors(theme, data.length)[i]).
export const pieProps = (theme) => ({
  theme: nivoTheme(theme),
  colors: { datum: "data.color" },
  sortByValue: true,
  innerRadius: 0.5,
  padAngle: 1.5, // visible gap between slices
  cornerRadius: 3,
  activeOuterRadiusOffset: 8,
  borderWidth: 2,
  borderColor: theme.palette.background.paper, // surface-coloured separator
  arcLabelsSkipAngle: 12,
  arcLabelsTextColor: (d) => readableOn(d.color),
  arcLinkLabelsSkipAngle: 8,
  arcLinkLabelsTextColor: theme.palette.text.primary,
  arcLinkLabelsThickness: 2,
  arcLinkLabelsColor: { from: "color" },
});

export const pieLegendText = (theme) => theme.palette.text.primary;

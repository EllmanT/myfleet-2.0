// myFleet design tokens: ink and ivory with a deep emerald accent.
//
// Light and dark each have their own deliberate values (the old theme built
// light mode by reversing the dark scale, which put mustard text on white at
// 2.3:1). Every text/background pair used here was checked against WCAG AA
// (see docs/research/design-system-research.md).
//
// The scale names (primary / secondary / grey, 100-900) are kept so the existing
// pages keep working, but the meaning is now stable in BOTH modes:
//   secondary[100] = main text      secondary[200] = muted text
//   secondary[300] = accent         secondary[400] = accent hover / strong
//   primary[600]   = text ON an accent fill
//   background.default = page       background.alt = cards and sidebar

export const tokensDark = {
  grey: {
    0: "#FFFDF9",
    10: "#FAF8F3",
    50: "#F1EEE5",
    100: "#E4E0D4",
    200: "#CFCBBF",
    300: "#B0AC9F",
    400: "#8F8B7E",
    500: "#6E6B60",
    600: "#5A574E",
    700: "#3F3D35",
    800: "#2B2A24",
    900: "#1C1B16",
    1000: "#0E0E0C",
  },
  // warm ink neutrals (surfaces and borders)
  primary: {
    100: "#E6E3D9",
    200: "#BDB9AC",
    300: "#8F8B7E",
    400: "#5E5B52",
    500: "#1C1B16",
    600: "#15140F",
    700: "#0E0E0C",
    800: "#0A0A08",
    900: "#050504",
  },
  // emerald accent
  secondary: {
    50: "#F3F0E8",
    100: "#F3F0E8",
    200: "#CFCBBF",
    300: "#4DBF93",
    400: "#3FAF85",
    500: "#2E9A72",
    600: "#258060",
    700: "#1B6048",
    800: "#12402F",
    900: "#0A241B",
  },
};

export const tokensLight = {
  grey: {
    0: "#0E0E0C",
    10: "#1C1B16",
    50: "#2B2A24",
    100: "#3F3D35",
    200: "#5A574E",
    300: "#6E6B60",
    400: "#8F8B7E",
    500: "#B0AC9F",
    600: "#CFCBBF",
    700: "#E4E0D4",
    800: "#F1EEE5",
    900: "#FAF8F3",
    1000: "#FFFDF9",
  },
  primary: {
    100: "#15140F",
    200: "#2B2A24",
    300: "#3F3D35",
    400: "#5C5A50",
    500: "#EFEBE1",
    600: "#E4E0D4",
    700: "#EDEAE0",
    800: "#F4F1E8",
    900: "#FAF8F3",
  },
  secondary: {
    50: "#F3F0E8",
    100: "#15140F",
    200: "#3F3D35",
    300: "#0E5A43",
    400: "#0A4634",
    500: "#3C8A70",
    600: "#6FAA95",
    700: "#A9CBBE",
    800: "#D3E3DC",
    900: "#E9F1ED",
  },
};

// Semantic colours per mode. Status never relies on colour alone: pair with an icon or word.
const semantic = {
  light: {
    bg: "#FAF8F3",
    surface: "#FFFFFF",
    sunken: "#F2EFE7",
    border: "#E3DED2",
    borderStrong: "#8A8579",
    text: "#15140F",
    text2: "#4F4B43",
    text3: "#6B665B",
    accent: "#0E5A43",
    accentHover: "#0A4634",
    onAccent: "#FAF8F3",
    accentSubtle: "#E2EEE7",
    success: "#2F6B1F",
    warning: "#8A5200",
    danger: "#B1261B",
    info: "#2B5876",
  },
  dark: {
    bg: "#0E0E0C",
    surface: "#1C1B16",
    sunken: "#1F1F1C",
    border: "#2D2C28",
    borderStrong: "#7A766B",
    text: "#F3F0E8",
    text2: "#B8B3A7",
    text3: "#8F8A7F",
    accent: "#3FAF85",
    accentHover: "#52C196",
    onAccent: "#0E0E0C",
    accentSubtle: "#10281F",
    success: "#7FC96A",
    warning: "#E2A93B",
    danger: "#F0786C",
    info: "#7DB4D6",
  },
};

const FONT = [
  '"Inter Variable"',
  "Inter",
  "system-ui",
  "-apple-system",
  '"Segoe UI"',
  "Roboto",
  "Arial",
  "sans-serif",
].join(",");
const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

// mui theme settings
export const themeSettings = (mode) => {
  const dark = mode === "dark";
  const c = semantic[dark ? "dark" : "light"];
  const scales = dark ? tokensDark : tokensLight;

  return {
    palette: {
      mode,
      primary: {
        ...scales.primary,
        main: c.accent,
        dark: c.accentHover,
        light: c.accentSubtle,
        contrastText: c.onAccent,
      },
      secondary: {
        ...scales.secondary,
        // main/light are accent fills (buttons); text on them is background.alt
        main: dark ? scales.secondary[300] : scales.secondary[300],
        light: c.accent,
        contrastText: c.onAccent,
      },
      neutral: {
        ...scales.grey,
        main: scales.grey[500],
      },
      success: { main: c.success },
      warning: { main: c.warning },
      error: { main: c.danger },
      info: { main: c.info },
      background: {
        default: c.bg,
        alt: c.surface,
        paper: c.surface,
      },
      text: { primary: c.text, secondary: c.text2, disabled: c.text3 },
      divider: c.border,
      action: { hover: c.sunken, selected: c.accentSubtle, focus: c.accentSubtle },
    },
    typography: {
      fontFamily: FONT,
      fontSize: 14,
      fontWeightRegular: 400,
      fontWeightMedium: 500,
      fontWeightBold: 600,
      // Large text tightens, small text stays near 0: tracking is size-specific.
      // Sizes scale down on phones so titles never crowd a small screen.
      h1: { fontFamily: FONT, fontSize: "clamp(1.5rem, 1.2rem + 1.2vw, 2rem)", lineHeight: 1.2, fontWeight: 600, letterSpacing: "-0.02em" },
      h2: { fontFamily: FONT, fontSize: "clamp(1.25rem, 1.05rem + 0.8vw, 1.625rem)", lineHeight: 1.25, fontWeight: 600, letterSpacing: "-0.015em" },
      h3: { fontFamily: FONT, fontSize: "1.25rem", lineHeight: 1.3, fontWeight: 600, letterSpacing: "-0.01em" },
      h4: { fontFamily: FONT, fontSize: "1.125rem", lineHeight: 1.35, fontWeight: 600, letterSpacing: "-0.005em" },
      h5: { fontFamily: FONT, fontSize: "1rem", lineHeight: 1.4, fontWeight: 600 },
      h6: { fontFamily: FONT, fontSize: "0.875rem", lineHeight: 1.4, fontWeight: 600 },
      subtitle1: { fontSize: "1rem", lineHeight: 1.4, fontWeight: 500 },
      body1: { fontSize: "0.875rem", lineHeight: 1.45 },
      body2: { fontSize: "0.8125rem", lineHeight: 1.45 },
      caption: { fontSize: "0.75rem", lineHeight: 1.35, letterSpacing: "0.01em" },
      button: { fontSize: "0.875rem", fontWeight: 500, textTransform: "none", letterSpacing: 0 },
    },
    shape: { borderRadius: 8 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            WebkitFontSmoothing: "antialiased",
            fontVariantNumeric: "tabular-nums",
          },
          // reduced motion: keep feedback, drop the movement
          "@media (prefers-reduced-motion: reduce)": {
            "*, *::before, *::after": {
              animationDuration: "0.01ms !important",
              transitionDuration: "0.01ms !important",
              scrollBehavior: "auto !important",
            },
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            minHeight: 40,
            borderRadius: 8,
            transition: `background-color 150ms ${EASE}, transform 120ms ${EASE}`,
            "&:active": { transform: "scale(0.98)" },
            "&.Mui-focusVisible": { outline: `2px solid ${c.accent}`, outlineOffset: 2 },
          },
          outlined: { borderColor: c.borderStrong, color: c.text },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { "&.Mui-focusVisible": { outline: `2px solid ${c.accent}`, outlineOffset: 2 } },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: `1px solid ${c.border}`, padding: "10px 16px" },
          head: { backgroundColor: c.sunken, color: c.text2, fontSize: "0.8125rem", fontWeight: 500 },
        },
      },
      MuiTableRow: { styleOverrides: { root: { "&:hover": { backgroundColor: c.sunken } } } },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 12,
            border: `1px solid ${c.border}`,
            backgroundImage: "none",
            // phones: use the screen width instead of a narrow floating box
            "@media (max-width:599.95px)": { margin: 8, width: "calc(100% - 16px)", maxWidth: "none", maxHeight: "calc(100% - 16px)" },
          },
        },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: "none" }, outlined: { borderColor: c.border } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: c.surface,
            // 16px stops iOS and Android from zooming into a field on focus
            fontSize: 16,
            "& fieldset": { borderColor: c.borderStrong },
            "&:hover fieldset": { borderColor: c.text2 },
            "&.Mui-focused fieldset": { borderColor: c.accent, borderWidth: 2 },
          },
        },
      },
      MuiChip: { styleOverrides: { root: { borderRadius: 6, fontWeight: 500, fontSize: "0.8125rem" } } },
      MuiTabs: { styleOverrides: { indicator: { height: 2, backgroundColor: c.accent } } },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: "none",
            fontWeight: 500,
            minHeight: 44,
            color: c.text2,
            "&.Mui-selected": { color: c.text },
          },
        },
      },
      MuiToggleButton: { styleOverrides: { root: { textTransform: "none", minHeight: 40 } } },
      MuiListItemButton: { styleOverrides: { root: { minHeight: 44 } } },
    },
  };
};

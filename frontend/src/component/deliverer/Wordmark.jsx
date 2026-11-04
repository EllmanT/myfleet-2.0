import React from "react";
import Box from "@mui/material/Box";

// The myfleet logo. Two artworks, one identity:
//   text    the MYFLEET wordmark, for places with room (sidebar, wide screens)
//   stacked the M mark over FLEET, for narrow screens where the wide text would not fit
// variant "auto" shows stacked below 600px and text from 600px up.
// `width` is the width of the text logo in px; the stacked one is sized to match.
// The same artwork is used on the marketing site (marketing/public/brand).

const TEXT_SRC = "/brand/myfleet-logo-text.png";
const STACKED_SRC = "/brand/myfleet-logo-stacked.png";

const Logo = ({ width = 150, variant = "auto" }) => {
  const textH = Math.round((width * 51) / 418);
  const stackedH = Math.round(width * 0.38);
  const text = (
    <Box
      component="img"
      src={TEXT_SRC}
      alt="myfleet"
      width={width}
      height={textH}
      sx={{
        display: variant === "stacked" ? "none" : variant === "auto" ? { xs: "none", sm: "block" } : "block",
        height: textH,
        width: "auto",
      }}
    />
  );
  const stacked = (
    <Box
      component="img"
      src={STACKED_SRC}
      alt="myfleet"
      sx={{
        display: variant === "text" ? "none" : variant === "auto" ? { xs: "block", sm: "none" } : "block",
        height: stackedH,
        width: "auto",
      }}
    />
  );
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", lineHeight: 0 }}>
      {stacked}
      {text}
    </Box>
  );
};

export { Logo };
export default Logo;

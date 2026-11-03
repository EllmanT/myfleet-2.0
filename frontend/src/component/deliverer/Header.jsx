import { Typography, Box, useTheme } from "@mui/material";
import React from "react";

// Page titles were a mix of "Jobs" and "EXPENSES"; show them all in sentence case.
const sentenceCase = (t) =>
  typeof t === "string" && t.length > 1 && t === t.toUpperCase()
    ? t.charAt(0) + t.slice(1).toLowerCase()
    : t;

const Header = ({ title, subtitle }) => {
  const theme = useTheme();
  return (
    <Box>
      <Typography
        variant="h2"
        color={theme.palette.secondary[100]}
        sx={{ mb: "4px" }}
      >
        {sentenceCase(title)}
      </Typography>
      <Typography variant="body1" color={theme.palette.secondary[200]}>
        {subtitle}
      </Typography>
    </Box>
  );
};

export default Header;

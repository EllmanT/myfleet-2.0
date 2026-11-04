import React from "react";
import { Box, Typography, useTheme } from "@mui/material";

// What a list says when there is nothing to show: plain words and what to do next. The page's
// own Add button stays the action, so there is only one of it.
const EmptyState = ({ title, text }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        mt: 4,
        py: 6,
        px: 3,
        textAlign: "center",
        border: `1px dashed ${theme.palette.divider}`,
        borderRadius: "8px",
      }}
    >
      <Typography fontWeight="bold">{title}</Typography>
      {text ? (
        <Typography variant="body2" sx={{ opacity: 0.7, mt: 0.5, maxWidth: 420, mx: "auto" }}>
          {text}
        </Typography>
      ) : null}
    </Box>
  );
};

export default EmptyState;

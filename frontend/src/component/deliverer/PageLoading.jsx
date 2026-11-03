import React from "react";
import { Box, Skeleton } from "@mui/material";

// Shown while a page's code loads or its data arrives. Skeleton blocks keep the
// layout from jumping, which feels faster than a "Loading..." line on slow data.
const PageLoading = () => (
  <Box
    role="status"
    aria-busy="true"
    aria-label="Loading"
    m={{ xs: "1rem 0.75rem", sm: "1.25rem 1.5rem", md: "1.5rem 2.5rem" }}
  >
    <Skeleton variant="text" width={220} height={38} />
    <Skeleton variant="text" width={340} height={22} />
    <Skeleton variant="rounded" height={44} sx={{ mt: "1.5rem" }} />
    <Skeleton variant="rounded" height={260} sx={{ mt: "1rem" }} />
  </Box>
);

export default PageLoading;

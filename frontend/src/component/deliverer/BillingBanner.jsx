import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { useSelector } from "react-redux";

const SHOW_TRIAL_WITHIN_DAYS = 7;

// One quiet line under the top bar: how long the free trial has left (only near the end), or
// why the company can look but not change anything. Nothing for a company that is fine.
const BillingBanner = () => {
  const theme = useTheme();
  const billing = useSelector((s) => s.user.billing);
  if (!billing) return null;

  let text = "";
  let tone = "info";
  if (billing.state === "trial" && billing.daysLeft <= SHOW_TRIAL_WITHIN_DAYS) {
    const d = Math.max(0, billing.daysLeft);
    text = `Your free trial ends ${d === 0 ? "today" : `in ${d} ${d === 1 ? "day" : "days"}`}. You will not be charged automatically; we send an invoice and you decide.`;
  } else if (billing.state === "read_only" || billing.state === "cancelled") {
    tone = "warning";
    text =
      billing.readOnlyReason === "payment_overdue"
        ? "Your subscription payment is overdue, so changes are paused. You can still view and download everything."
        : billing.readOnlyReason === "cancelled"
        ? "This account is cancelled. You can still view and download your data."
        : "Your free trial has ended, so changes are paused. Your data is safe and you can still view and download it. Message us to continue.";
  } else if (billing.state === "suspended") {
    tone = "warning";
    text = "This account is suspended. You can still download your data. Message us to restore it.";
  }
  if (!text) return null;

  return (
    <Box
      role="status"
      sx={{
        px: { xs: 2, md: 4 },
        py: 1,
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: tone === "warning" ? theme.palette.warning.light : theme.palette.background.alt,
      }}
    >
      <Typography variant="body2" sx={{ color: tone === "warning" ? theme.palette.warning.contrastText : theme.palette.text.primary }}>
        {text}
      </Typography>
    </Box>
  );
};

export default BillingBanner;

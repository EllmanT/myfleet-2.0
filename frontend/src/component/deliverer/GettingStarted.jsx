import React, { useEffect, useState } from "react";
import axios from "axios";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { CheckCircle, RadioButtonUnchecked } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { server } from "server";

const DISMISS_KEY = "myfleet.gettingStarted.dismissed";

// The steps, in the order a haulage company needs them. `done` reads the counts from the server.
const STEPS = [
  { key: "vehicles", label: "Add your first truck", hint: "Plate number, make and size.", path: "/del-vehicles", done: (c) => c.vehicles > 0 },
  { key: "drivers", label: "Add a driver", hint: "Name, ID number and licence.", path: "/del-drivers", done: (c) => c.drivers > 0 },
  { key: "customers", label: "Add a customer", hint: "Who you haul for.", path: "/del-customers", done: (c) => c.customers > 0 },
  { key: "jobs", label: "Record your first job", hint: "Or import past jobs from Excel on the Jobs page.", path: "/add-job", done: (c) => c.jobs > 0 },
  { key: "invoices", label: "Send your first invoice", hint: "Turn a finished job into an invoice.", path: "/del-invoices", done: (c) => c.invoices > 0 },
];

// A short checklist for a company that has not finished setting up. It goes away by itself once
// every step is done, and can be put away earlier.
const GettingStarted = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [counts, setCounts] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch (error) {
      return false;
    }
  });

  useEffect(() => {
    if (dismissed) return undefined;
    let live = true;
    axios
      .get(`${server}/tenant/setup`, { withCredentials: true })
      .then(({ data }) => live && setCounts(data.counts))
      .catch(() => live && setCounts(null));
    return () => {
      live = false;
    };
  }, [dismissed]);

  if (dismissed || !counts) return null;
  const finished = STEPS.filter((s) => s.done(counts)).length;
  if (finished === STEPS.length) return null;
  const next = STEPS.find((s) => !s.done(counts));

  const putAway = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch (error) {
      /* storage blocked: it just comes back next visit */
    }
    setDismissed(true);
  };

  return (
    <Box
      component="section"
      aria-label="Getting started"
      sx={{
        mb: 2,
        p: { xs: 2, md: 2.5 },
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: "8px",
        backgroundColor: theme.palette.background.alt,
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 2, flexWrap: "wrap" }}>
        <Typography fontWeight="bold">Get started: {finished} of {STEPS.length} done</Typography>
        <Button size="small" onClick={putAway}>
          Hide for now
        </Button>
      </Box>
      <Box component="ol" sx={{ listStyle: "none", m: 0, mt: 1, p: 0 }}>
        {STEPS.map((step) => {
          const done = step.done(counts);
          return (
            <Box
              component="li"
              key={step.key}
              sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.75 }}
            >
              {done ? (
                <CheckCircle fontSize="small" sx={{ color: theme.palette.success.main }} titleAccess="Done" />
              ) : (
                <RadioButtonUnchecked fontSize="small" sx={{ opacity: 0.5 }} titleAccess="Not done" />
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ textDecoration: done ? "line-through" : "none", opacity: done ? 0.6 : 1 }}>
                  {step.label}
                </Typography>
                {!done && (
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>
                    {step.hint}
                  </Typography>
                )}
              </Box>
              {!done && step.key === next.key && (
                <Button size="small" variant="contained" onClick={() => navigate(step.path)}>
                  Start
                </Button>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default GettingStarted;

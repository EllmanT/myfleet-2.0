import React from "react";
import { Box, Button, IconButton, TextField, Typography } from "@mui/material";
import { DeleteOutline } from "@mui/icons-material";
import { money } from "utils/tripApi";

const lineTotal = (l) => Math.round((Number(l.quantity) || 0) * Math.round((Number(l.unitPrice) || 0) * 100)) / 100;

// Invoice / quotation lines: description, quantity, price. Totals update as you type.
const LinesEditor = ({ lines, onChange, taxRatePct = 0, currency = "USD", disabled = false }) => {
  const set = (i, patch) => onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const tax = Math.round(subtotal * (Number(taxRatePct) || 0)) / 100;

  return (
    <Box display="grid" gap="0.6rem">
      {lines.map((l, i) => (
        <Box key={i} display="flex" gap="0.5rem" alignItems="center">
          <TextField size="small" label="Description" value={l.description || ""} disabled={disabled} sx={{ flex: 1 }}
            onChange={(e) => set(i, { description: e.target.value })} />
          <TextField size="small" type="number" label="Qty" value={l.quantity ?? 1} disabled={disabled} sx={{ width: 80 }}
            onChange={(e) => set(i, { quantity: e.target.value })} inputProps={{ min: 0, step: "any" }} />
          <TextField size="small" type="number" label="Price" value={l.unitPrice ?? ""} disabled={disabled} sx={{ width: 120 }}
            onChange={(e) => set(i, { unitPrice: e.target.value })} inputProps={{ min: 0, step: "0.01" }} />
          <Typography sx={{ width: 100, textAlign: "right" }}>{money(lineTotal(l), currency)}</Typography>
          {!disabled && (
            <IconButton size="small" onClick={() => onChange(lines.filter((_, idx) => idx !== i))} aria-label="Remove line">
              <DeleteOutline fontSize="small" />
            </IconButton>
          )}
        </Box>
      ))}
      {!disabled && (
        <Box>
          <Button size="small" onClick={() => onChange([...lines, { description: "", quantity: 1, unitPrice: "" }])}>+ Add a line</Button>
        </Box>
      )}
      <Box textAlign="right">
        <Typography>Subtotal {money(subtotal, currency)}</Typography>
        {Number(taxRatePct) > 0 && <Typography>Tax ({taxRatePct}%) {money(tax, currency)}</Typography>}
        <Typography fontWeight="bold">Total {money(subtotal + tax, currency)}</Typography>
      </Box>
    </Box>
  );
};

export default LinesEditor;

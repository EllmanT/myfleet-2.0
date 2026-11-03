import React, { useCallback, useEffect, useState } from "react";
import {
  Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl,
  InputLabel, MenuItem, Select, Table, TableBody, TableCell, TableHead, TableRow, TextField, useTheme,
} from "@mui/material";
import { Add } from "@mui/icons-material";
import { toast } from "react-hot-toast";
import FlexBetween from "component/deliverer/FlexBetween";
import Header from "component/deliverer/Header";
import LinesEditor from "component/deliverer/LinesEditor";
import {
  apiMessage, convertQuotation, createQuotation, deleteQuotation, fetchInvoiceMeta, fetchQuotation,
  fetchQuotations, money, openPdf, setQuotationStatus, updateQuotation,
} from "utils/invoiceApi";

const today = () => new Date().toISOString().slice(0, 10);
const d = (v) => (v ? String(v).slice(0, 10) : "");
const empty = () => ({
  customerName: "", subject: "", issueDate: today(), validUntil: "", currency: "USD", taxRatePct: 0,
  notes: "", terms: "", status: "draft", lines: [{ description: "", quantity: 1, unitPrice: "" }],
});

const chip = (q) => {
  if (q.status === "accepted") return <Chip size="small" color="success" label={q.invoiceId ? "Accepted - invoiced" : "Accepted"} />;
  if (q.status === "rejected") return <Chip size="small" color="error" label="Rejected" />;
  if (q.status === "sent") return q.expired ? <Chip size="small" color="warning" label="Sent - expired" /> : <Chip size="small" color="info" label="Sent" />;
  return <Chip size="small" label="Draft" />;
};

const QuotationsPage = () => {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ customers: [], currencies: ["USD"] });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await fetchQuotations(status ? { status } : {})).quotations); }
    catch (e) { toast.error(apiMessage(e)); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchInvoiceMeta().then(setMeta).catch(() => {}); }, []);

  return (
    <Box m={{ xs: "1rem 0.75rem", sm: "1.25rem 1.5rem", md: "1.5rem 2.5rem" }}>
      <FlexBetween>
        <Header title="QUOTATIONS" subtitle="Send a price before the work. When it's accepted, turn it into an invoice." />
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpenId("new")}
          sx={{ backgroundColor: theme.palette.secondary.light, color: theme.palette.background.alt, fontWeight: "bold" }}>
          New quotation
        </Button>
      </FlexBetween>
      <Box mt="1.5rem">
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Show</InputLabel>
          <Select label="Show" value={status} onChange={(e) => setStatus(e.target.value)}>
            <MenuItem value="">All</MenuItem><MenuItem value="draft">Draft</MenuItem><MenuItem value="sent">Sent</MenuItem>
            <MenuItem value="accepted">Accepted</MenuItem><MenuItem value="rejected">Rejected</MenuItem>
          </Select>
        </FormControl>
      </Box>
      <Box mt="1rem" sx={{ overflowX: "auto", backgroundColor: theme.palette.background.alt, borderRadius: "0.55rem" }}>
        <Table size="small">
          <TableHead><TableRow>{["Number", "Customer", "For", "Date", "Valid until", "Total", "Status"].map((h) => <TableCell key={h} sx={{ fontWeight: "bold" }}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {rows.map((q) => (
              <TableRow key={q._id} hover sx={{ cursor: "pointer" }} onClick={() => setOpenId(q._id)}>
                <TableCell>{q.number}</TableCell><TableCell>{q.customerName}</TableCell><TableCell>{q.subject}</TableCell>
                <TableCell>{d(q.issueDate)}</TableCell><TableCell>{d(q.validUntil)}</TableCell>
                <TableCell>{money(q.total, q.currency)}</TableCell><TableCell>{chip(q)}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={7} align="center">{loading ? "Loading..." : "No quotations yet."}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Box>
      {openId && <QuotationDialog id={openId} meta={meta} onClose={() => setOpenId(null)} onChanged={load} />}
    </Box>
  );
};

const QuotationDialog = ({ id, meta, onClose, onChanged }) => {
  const isNew = id === "new";
  const [q, setQ] = useState(isNew ? empty() : null);
  const [busy, setBusy] = useState(false);

  const show = (quotation) => setQ({ ...quotation, issueDate: d(quotation.issueDate), validUntil: d(quotation.validUntil) });
  useEffect(() => {
    if (isNew) return;
    fetchQuotation(id).then((r) => show(r.quotation)).catch((e) => { toast.error(apiMessage(e)); onClose(); });
  }, [id, isNew, onClose]);

  if (!q) return null;
  const locked = ["accepted", "rejected"].includes(q.status);
  const set = (k) => (e) => setQ({ ...q, [k]: e.target.value });
  const body = () => ({ customerName: q.customerName, subject: q.subject, issueDate: q.issueDate, validUntil: q.validUntil, currency: q.currency, taxRatePct: q.taxRatePct, notes: q.notes, terms: q.terms, lines: q.lines });

  const run = async (fn, msg, { close = false } = {}) => {
    setBusy(true);
    try {
      const res = await fn();
      if (msg) toast.success(msg);
      onChanged();
      if (close) onClose();
      else if (res.quotation) show(res.quotation);
      return res;
    } catch (e) { toast.error(apiMessage(e)); } finally { setBusy(false); }
  };

  const save = () => run(() => (isNew ? createQuotation(body()) : updateQuotation(id, body())), "Quotation saved", { close: isNew });
  const status = (s) => run(() => setQuotationStatus(id, s), `Marked ${s}`);
  const convert = async () => {
    const res = await run(() => convertQuotation(id), "Invoice draft created - find it under Invoices");
    if (res) onClose();
  };
  const remove = () => { if (window.confirm("Delete this quotation?")) run(() => deleteQuotation(id), "Quotation deleted", { close: true }); };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{isNew ? "New quotation" : q.number} {!isNew && chip(q)}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: "1rem", pt: "1rem !important" }}>
        <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(190px, 1fr))" gap="1rem">
          <Autocomplete freeSolo size="small" disabled={locked} options={meta.customers} value={q.customerName}
            onInputChange={(e, v) => !locked && setQ((x) => ({ ...x, customerName: v }))}
            renderInput={(p) => <TextField {...p} label="Customer" />} />
          <TextField size="small" label="What is it for (e.g. Harare to Johannesburg, 30t)" disabled={locked} value={q.subject || ""} onChange={set("subject")} />
          <TextField size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} disabled={locked} value={q.issueDate} onChange={set("issueDate")} />
          <TextField size="small" type="date" label="Valid until (default 14 days)" InputLabelProps={{ shrink: true }} disabled={locked} value={q.validUntil || ""} onChange={set("validUntil")} />
          <FormControl size="small" disabled={locked}>
            <InputLabel>Currency</InputLabel>
            <Select label="Currency" value={q.currency} onChange={set("currency")}>{meta.currencies.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}</Select>
          </FormControl>
          <TextField size="small" type="number" label="Tax %" disabled={locked} value={q.taxRatePct} onChange={set("taxRatePct")} inputProps={{ min: 0, max: 100, step: "any" }} />
        </Box>
        <LinesEditor lines={q.lines} onChange={(lines) => setQ({ ...q, lines })} taxRatePct={q.taxRatePct} currency={q.currency} disabled={locked} />
        <TextField size="small" label="Notes" disabled={locked} value={q.notes || ""} onChange={set("notes")} multiline minRows={2} />
        <TextField size="small" label="Terms (payment terms, validity, what's not included)" disabled={locked} value={q.terms || ""} onChange={set("terms")} multiline minRows={2} />
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: "0.25rem" }}>
        {!isNew && <Button onClick={() => openPdf(`/quotation/pdf/${id}`).catch((e) => toast.error(apiMessage(e)))}>PDF</Button>}
        {!isNew && q.status === "draft" && <Button onClick={() => status("sent")} disabled={busy}>Mark as sent</Button>}
        {!isNew && q.status === "sent" && (<>
          <Button color="success" onClick={() => status("accepted")} disabled={busy}>Accepted</Button>
          <Button color="error" onClick={() => status("rejected")} disabled={busy}>Rejected</Button>
        </>)}
        {!isNew && q.status === "accepted" && !q.invoiceId && <Button variant="contained" onClick={convert} disabled={busy}>Turn into an invoice</Button>}
        {!isNew && !q.invoiceId && <Button color="error" onClick={remove} disabled={busy}>Delete</Button>}
        <Box flex={1} />
        <Button onClick={onClose}>Close</Button>
        {!locked && <Button variant="contained" onClick={save} disabled={busy || !q.customerName}>Save</Button>}
      </DialogActions>
    </Dialog>
  );
};

export default QuotationsPage;

import React, { useCallback, useEffect, useState } from "react";
import {
  Autocomplete, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputLabel, MenuItem, Select, Tab, Table, TableBody, TableCell,
  TableHead, TableRow, Tabs, TextField, Typography, useTheme,
} from "@mui/material";
import { Add, DeleteOutline } from "@mui/icons-material";
import { toast } from "react-hot-toast";
import FlexBetween from "component/deliverer/FlexBetween";
import Header from "component/deliverer/Header";
import LinesEditor from "component/deliverer/LinesEditor";
import { fetchTrips } from "utils/tripApi";
import {
  addCreditNote, apiMessage, createInvoice, deleteInvoice, deletePayment, draftFromJobs, draftFromTrips,
  fetchInvoice, fetchInvoiceMeta, fetchInvoices, fetchPayments, fetchReceivables, fetchUnbilled,
  issueInvoice, money, openPdf, recordPayment, updateInvoice, voidInvoice,
} from "utils/invoiceApi";

const today = () => new Date().toISOString().slice(0, 10);
const d = (v) => (v ? String(v).slice(0, 10) : "");
const emptyInvoice = () => ({ customerName: "", issueDate: today(), dueDate: "", currency: "USD", taxRatePct: 0, notes: "", terms: "", lines: [{ description: "", quantity: 1, unitPrice: "" }] });

const statusChip = (i) => {
  if (i.status === "draft") return <Chip size="small" label="Draft" />;
  if (i.status === "void") return <Chip size="small" label="Void" />;
  if (i.paymentStatus === "paid") return <Chip size="small" color="success" label="Paid" />;
  if (i.overdue) return <Chip size="small" color="error" label={`Overdue ${i.daysOverdue}d`} />;
  if (i.paymentStatus === "partial") return <Chip size="small" color="warning" label="Part paid" />;
  return <Chip size="small" variant="outlined" label="Unpaid" />;
};

const InvoicesPage = () => {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [meta, setMeta] = useState({ contractors: [], vehicles: [], customers: [], currencies: ["USD"] });
  const reloadKey = useState(0);
  const [bump, setBump] = reloadKey;
  const refresh = () => setBump((n) => n + 1);

  useEffect(() => {
    fetchInvoiceMeta().then(setMeta).catch((e) => toast.error(apiMessage(e)));
  }, []);

  // editor / viewer dialog
  const [openId, setOpenId] = useState(null); // "new" | invoice id
  // create-from dialogs
  const [fromTrips, setFromTrips] = useState(false);
  const [fromJobs, setFromJobs] = useState(null); // null | {contractorId, from, to, vehicleId}

  const openInvoice = (id) => setOpenId(id);

  return (
    <Box m={{ xs: "1rem 0.75rem", sm: "1.25rem 1.5rem", md: "1.5rem 2.5rem" }}>
      <FlexBetween>
        <Header title="INVOICES" subtitle="Raise invoices, record what has been paid, and see who still owes you." />
        <Box display="flex" gap="0.5rem" flexWrap="wrap">
          <Button variant="outlined" onClick={() => setFromJobs({ contractorId: "", vehicleId: "", from: today().slice(0, 8) + "01", to: today() })}>From jobs</Button>
          <Button variant="outlined" onClick={() => setFromTrips(true)}>From trips</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setOpenId("new")}
            sx={{ backgroundColor: theme.palette.secondary.light, color: theme.palette.background.alt, fontWeight: "bold" }}>
            New invoice
          </Button>
        </Box>
      </FlexBetween>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mt: "1rem" }}>
        <Tab label="Invoices" /><Tab label="Who owes me" /><Tab label="Payments" /><Tab label="Not yet invoiced" />
      </Tabs>

      {tab === 0 && <InvoiceList bump={bump} onOpen={openInvoice} />}
      {tab === 1 && <Receivables bump={bump} />}
      {tab === 2 && <PaymentsList bump={bump} onChanged={refresh} />}
      {tab === 3 && <Unbilled bump={bump}
        onJobs={(row) => {
          const [y, m] = row.month.split("-").map(Number);
          const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
          setFromJobs({ contractorId: row.contractorId, vehicleId: "", from: `${row.month}-01`, to: `${row.month}-${String(last).padStart(2, "0")}` });
        }}
        onTrips={() => setFromTrips(true)} />}

      {openId && (
        <InvoiceDialog id={openId} meta={meta} onClose={() => setOpenId(null)} onChanged={refresh} />
      )}
      {fromTrips && (
        <FromTripsDialog onClose={() => setFromTrips(false)} onCreated={(inv) => { setFromTrips(false); refresh(); setOpenId(inv._id); }} />
      )}
      {fromJobs && (
        <FromJobsDialog init={fromJobs} meta={meta} onClose={() => setFromJobs(null)} onCreated={(inv) => { setFromJobs(null); refresh(); setOpenId(inv._id); }} />
      )}
    </Box>
  );
};

/* ---------- list ---------- */
const InvoiceList = ({ bump, onOpen }) => {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [sums, setSums] = useState({ outstanding: 0, overdue: 0 });
  const [f, setF] = useState({ status: "", paymentStatus: "", customer: "" });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      Object.entries(f).forEach(([k, v]) => v && (params[k] = v));
      const data = await fetchInvoices(params);
      setRows(data.invoices);
      setSums({ outstanding: data.outstanding, overdue: data.overdue });
    } catch (e) {
      toast.error(apiMessage(e));
    } finally {
      setLoading(false);
    }
  }, [f]);
  useEffect(() => { load(); }, [load, bump]);

  return (
    <Box mt="1rem">
      <Box display="flex" gap="1rem" flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <MenuItem value="">All</MenuItem><MenuItem value="draft">Draft</MenuItem><MenuItem value="issued">Issued</MenuItem><MenuItem value="void">Void</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel>Payment</InputLabel>
          <Select label="Payment" value={f.paymentStatus} onChange={(e) => setF({ ...f, paymentStatus: e.target.value })}>
            <MenuItem value="">All</MenuItem><MenuItem value="unpaid">Unpaid</MenuItem><MenuItem value="partial">Part paid</MenuItem>
            <MenuItem value="paid">Paid</MenuItem><MenuItem value="overdue">Overdue</MenuItem>
          </Select>
        </FormControl>
        <TextField size="small" label="Customer" value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })} />
      </Box>
      <Typography mt="1rem" color={theme.palette.secondary[200]}>
        Outstanding <b>{money(sums.outstanding)}</b> | Overdue <b>{money(sums.overdue)}</b> (USD invoices counted together)
      </Typography>
      <Box mt="1rem" sx={{ overflowX: "auto", backgroundColor: theme.palette.background.alt, borderRadius: "0.55rem" }}>
        <Table size="small">
          <TableHead>
            <TableRow>{["Number", "Customer", "Date", "Due", "Total", "Paid", "Balance", "Status"].map((h) => <TableCell key={h} sx={{ fontWeight: "bold" }}>{h}</TableCell>)}</TableRow>
          </TableHead>
          <TableBody>
            {rows.map((i) => (
              <TableRow key={i._id} hover sx={{ cursor: "pointer", opacity: i.status === "void" ? 0.5 : 1 }} onClick={() => onOpen(i._id)}>
                <TableCell>{i.number || "(draft)"}</TableCell>
                <TableCell>{i.customerName}</TableCell>
                <TableCell>{d(i.issueDate)}</TableCell>
                <TableCell>{d(i.dueDate)}</TableCell>
                <TableCell>{money(i.total, i.currency)}</TableCell>
                <TableCell>{i.status === "issued" ? money(i.paid, i.currency) : ""}</TableCell>
                <TableCell>{i.status === "issued" ? money(i.balance, i.currency) : ""}</TableCell>
                <TableCell>{statusChip(i)}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={8} align="center">{loading ? "Loading..." : "No invoices yet."}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
};

/* ---------- receivables ---------- */
const Receivables = ({ bump }) => {
  const theme = useTheme();
  const [data, setData] = useState(null);
  useEffect(() => { fetchReceivables().then(setData).catch((e) => toast.error(apiMessage(e))); }, [bump]);
  if (!data) return <Typography mt="1rem">Loading...</Typography>;
  return (
    <Box mt="1rem">
      <Typography color={theme.palette.secondary[200]}>
        {Object.entries(data.totals).map(([c, v]) => `${money(v, c)} owed`).join(" | ") || "Nobody owes you anything right now."}
      </Typography>
      <Box mt="1rem" sx={{ overflowX: "auto", backgroundColor: theme.palette.background.alt, borderRadius: "0.55rem" }}>
        <Table size="small">
          <TableHead>
            <TableRow>{["Customer", "Invoices", "Not yet due", "1-30 days late", "31-60", "61-90", "90+", "Total owed"].map((h) => <TableCell key={h} sx={{ fontWeight: "bold" }}>{h}</TableCell>)}</TableRow>
          </TableHead>
          <TableBody>
            {data.customers.map((r) => (
              <TableRow key={r.customerName + r.currency} hover>
                <TableCell>{r.customerName}</TableCell><TableCell>{r.invoices}</TableCell>
                <TableCell>{money(r.current, r.currency)}</TableCell><TableCell>{money(r.d1_30, r.currency)}</TableCell>
                <TableCell>{money(r.d31_60, r.currency)}</TableCell><TableCell>{money(r.d61_90, r.currency)}</TableCell>
                <TableCell sx={{ color: r.d90_plus > 0 ? theme.palette.error.main : undefined }}>{money(r.d90_plus, r.currency)}</TableCell>
                <TableCell><b>{money(r.total, r.currency)}</b></TableCell>
              </TableRow>
            ))}
            {!data.customers.length && <TableRow><TableCell colSpan={8} align="center">All paid up.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
};

/* ---------- payments ---------- */
const PaymentsList = ({ bump, onChanged }) => {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => fetchPayments().then((r) => setRows(r.payments)).catch((e) => toast.error(apiMessage(e))), []);
  useEffect(() => { load(); }, [load, bump]);

  const remove = async (p) => {
    if (!window.confirm(`Delete this ${money(p.amount, p.currency)} payment from ${p.customerName}? The invoices it paid will owe that money again.`)) return;
    try { await deletePayment(p._id); toast.success("Payment deleted"); load(); onChanged(); } catch (e) { toast.error(apiMessage(e)); }
  };

  return (
    <Box mt="1rem">
      <Button variant="outlined" onClick={() => setOpen(true)}>Record a payment</Button>
      <Box mt="1rem" sx={{ overflowX: "auto", backgroundColor: theme.palette.background.alt, borderRadius: "0.55rem" }}>
        <Table size="small">
          <TableHead>
            <TableRow>{["Date", "Customer", "Amount", "Method", "Reference", "Applied to", "Left over", ""].map((h) => <TableCell key={h} sx={{ fontWeight: "bold" }}>{h}</TableCell>)}</TableRow>
          </TableHead>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p._id} hover>
                <TableCell>{d(p.date)}</TableCell><TableCell>{p.customerName}</TableCell>
                <TableCell>{money(p.amount, p.currency)}</TableCell><TableCell>{p.method}</TableCell><TableCell>{p.reference}</TableCell>
                <TableCell>{p.allocations.map((a) => `${a.invoiceNumber} (${money(a.amount, p.currency)})`).join(", ")}</TableCell>
                <TableCell>{p.unallocated > 0 ? money(p.unallocated, p.currency) : ""}</TableCell>
                <TableCell align="right"><IconButton size="small" onClick={() => remove(p)} aria-label="Delete payment"><DeleteOutline fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={8} align="center">No payments recorded yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Box>
      {open && <PaymentDialog onClose={() => setOpen(false)} onSaved={() => { setOpen(false); load(); onChanged(); }} />}
    </Box>
  );
};

// Record a payment: for one invoice (invoice given) or a lump sum applied oldest-first.
const PaymentDialog = ({ invoice, onClose, onSaved }) => {
  const [form, setForm] = useState({
    customerName: invoice ? invoice.customerName : "", amount: invoice ? invoice.balance : "",
    date: today(), method: "ecocash", reference: "", currency: invoice ? invoice.currency : "USD",
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form };
      if (invoice) body.allocations = [{ invoiceId: invoice._id, amount: form.amount }];
      else body.autoAllocate = true;
      await recordPayment(body);
      toast.success("Payment recorded");
      onSaved();
    } catch (e) { toast.error(apiMessage(e)); } finally { setSaving(false); }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{invoice ? `Payment for ${invoice.number}` : "Record a payment"}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: "1rem", pt: "1rem !important" }}>
        {!invoice && <TextField size="small" label="Customer (exactly as on the invoices)" value={form.customerName} onChange={set("customerName")} />}
        <TextField size="small" type="number" label="Amount received" value={form.amount} onChange={set("amount")} inputProps={{ min: 0, step: "0.01" }} />
        <TextField size="small" type="date" label="Date received" InputLabelProps={{ shrink: true }} value={form.date} onChange={set("date")} />
        <FormControl size="small">
          <InputLabel>How was it paid</InputLabel>
          <Select label="How was it paid" value={form.method} onChange={set("method")}>
            <MenuItem value="ecocash">EcoCash</MenuItem><MenuItem value="bank">Bank transfer</MenuItem><MenuItem value="cash">Cash</MenuItem><MenuItem value="other">Other</MenuItem>
          </Select>
        </FormControl>
        <TextField size="small" label="Reference (optional)" value={form.reference} onChange={set("reference")} />
        {!invoice && <Typography variant="body2" sx={{ opacity: 0.7 }}>The money is applied to this customer's oldest unpaid invoices first. Anything left over stays as credit.</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !form.amount || (!invoice && !form.customerName)}>{saving ? "Saving..." : "Save payment"}</Button>
      </DialogActions>
    </Dialog>
  );
};

/* ---------- unbilled ---------- */
const Unbilled = ({ bump, onJobs, onTrips }) => {
  const theme = useTheme();
  const [data, setData] = useState(null);
  useEffect(() => { fetchUnbilled().then(setData).catch((e) => toast.error(apiMessage(e))); }, [bump]);
  if (!data) return <Typography mt="1rem">Loading...</Typography>;
  const box = { overflowX: "auto", backgroundColor: theme.palette.background.alt, borderRadius: "0.55rem", mt: "0.5rem" };
  return (
    <Box mt="1rem" display="grid" gap="1.5rem">
      <Box>
        <Typography fontWeight="bold">Local jobs not yet invoiced</Typography>
        <Box sx={box}>
          <Table size="small">
            <TableHead><TableRow>{["Contractor", "Month", "Legs", "Value", ""].map((h) => <TableCell key={h} sx={{ fontWeight: "bold" }}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {data.jobs.map((j) => (
                <TableRow key={j.contractorId + j.month} hover>
                  <TableCell>{j.contractorName}</TableCell><TableCell>{j.month}</TableCell><TableCell>{j.legs}</TableCell><TableCell>{money(j.total)}</TableCell>
                  <TableCell align="right"><Button size="small" onClick={() => onJobs(j)}>Create invoice</Button></TableCell>
                </TableRow>
              ))}
              {!data.jobs.length && <TableRow><TableCell colSpan={5} align="center">Everything is invoiced.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Box>
      </Box>
      <Box>
        <Typography fontWeight="bold">Trips not yet invoiced</Typography>
        <Box sx={box}>
          <Table size="small">
            <TableHead><TableRow>{["Client", "Trips", "Value", ""].map((h) => <TableCell key={h} sx={{ fontWeight: "bold" }}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {data.trips.map((t) => (
                <TableRow key={t.customerName + t.currency} hover>
                  <TableCell>{t.customerName}</TableCell><TableCell>{t.trips}</TableCell><TableCell>{money(t.total, t.currency)}</TableCell>
                  <TableCell align="right"><Button size="small" onClick={onTrips}>Choose trips</Button></TableCell>
                </TableRow>
              ))}
              {!data.trips.length && <TableRow><TableCell colSpan={4} align="center">Everything is invoiced.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Box>
      </Box>
    </Box>
  );
};

/* ---------- create from trips / jobs ---------- */
const FromTripsDialog = ({ onClose, onCreated }) => {
  const [trips, setTrips] = useState([]);
  const [picked, setPicked] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    fetchTrips({ pageSize: 500 }).then((r) => setTrips(r.trips.filter((t) => !t.invoiceId && t.status !== "cancelled"))).catch((e) => toast.error(apiMessage(e)));
  }, []);
  const first = trips.find((t) => picked.includes(t._id));
  const toggle = (t) => setPicked((p) => (p.includes(t._id) ? p.filter((x) => x !== t._id) : [...p, t._id]));
  const create = async () => {
    setSaving(true);
    try { onCreated((await draftFromTrips({ tripIds: picked })).invoice); } catch (e) { toast.error(apiMessage(e)); } finally { setSaving(false); }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Invoice trips</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 1, opacity: 0.75 }}>Tick the trips to bill. They must be for one client and one currency.</Typography>
        <Table size="small">
          <TableHead><TableRow>{["", "Date", "Ref", "Client", "Route", "Price"].map((h) => <TableCell key={h} sx={{ fontWeight: "bold" }}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {trips.map((t) => (
              <TableRow key={t._id} hover onClick={() => toggle(t)} sx={{ cursor: "pointer" }}>
                <TableCell padding="checkbox"><Checkbox checked={picked.includes(t._id)} /></TableCell>
                <TableCell>{d(t.date)}</TableCell><TableCell>{t.clientRef}</TableCell><TableCell>{t.customerName}</TableCell>
                <TableCell>{t.stops.map((s) => s.place).join(" → ")}</TableCell><TableCell>{money(t.price, t.currency)}</TableCell>
              </TableRow>
            ))}
            {!trips.length && <TableRow><TableCell colSpan={6} align="center">No uninvoiced trips.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Typography sx={{ mr: "auto", ml: 2 }}>{first ? `${picked.length} selected for ${first.customerName}` : ""}</Typography>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!picked.length || saving} onClick={create}>{saving ? "Creating..." : "Create draft invoice"}</Button>
      </DialogActions>
    </Dialog>
  );
};

const FromJobsDialog = ({ init, meta, onClose, onCreated }) => {
  const [f, setF] = useState(init);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const create = async () => {
    setSaving(true);
    try { onCreated((await draftFromJobs(f)).invoice); } catch (e) { toast.error(apiMessage(e)); } finally { setSaving(false); }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Invoice a contractor's jobs</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: "1rem", pt: "1rem !important" }}>
        <FormControl size="small">
          <InputLabel>Contractor</InputLabel>
          <Select label="Contractor" value={f.contractorId} onChange={set("contractorId")}>
            {meta.contractors.map((c) => <MenuItem key={c._id} value={c._id}>{c.companyName}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel>Truck (optional)</InputLabel>
          <Select label="Truck (optional)" value={f.vehicleId} onChange={set("vehicleId")}>
            <MenuItem value="">All trucks</MenuItem>
            {meta.vehicles.map((v) => <MenuItem key={v._id} value={v._id}>{`${v.make || ""} ${v.regNumber || ""}`.trim()}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={f.from} onChange={set("from")} />
        <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={f.to} onChange={set("to")} />
        <Typography variant="body2" sx={{ opacity: 0.7 }}>Only jobs that haven't been invoiced yet are included, one line per leg.</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!f.contractorId || saving} onClick={create}>{saving ? "Creating..." : "Create draft invoice"}</Button>
      </DialogActions>
    </Dialog>
  );
};

/* ---------- invoice view / edit ---------- */
const InvoiceDialog = ({ id, meta, onClose, onChanged }) => {
  const isNew = id === "new";
  const [inv, setInv] = useState(isNew ? { ...emptyInvoice(), status: "draft" } : null);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    if (isNew) return;
    try {
      const { invoice } = await fetchInvoice(id);
      setInv({ ...invoice, issueDate: d(invoice.issueDate), dueDate: d(invoice.dueDate) });
    } catch (e) { toast.error(apiMessage(e)); onClose(); }
  }, [id, isNew, onClose]);
  useEffect(() => { load(); }, [load]);

  if (!inv) return null;
  const editable = inv.status === "draft";
  const set = (k) => (e) => setInv({ ...inv, [k]: e.target.value });

  const run = async (fn, okMsg, { close = false } = {}) => {
    setBusy(true);
    try {
      const res = await fn();
      if (okMsg) toast.success(okMsg);
      onChanged();
      if (close) onClose();
      else if (res?.invoice) setInv({ ...res.invoice, issueDate: d(res.invoice.issueDate), dueDate: d(res.invoice.dueDate) });
    } catch (e) { toast.error(apiMessage(e)); } finally { setBusy(false); }
  };

  const body = () => ({ customerName: inv.customerName, issueDate: inv.issueDate, dueDate: inv.dueDate, currency: inv.currency, taxRatePct: inv.taxRatePct, notes: inv.notes, terms: inv.terms, lines: inv.lines });
  const save = () => run(() => (isNew ? createInvoice(body()) : updateInvoice(id, body())), "Draft saved", { close: isNew });
  const issue = async () => {
    setBusy(true);
    try {
      let target = id;
      if (isNew) target = (await createInvoice(body())).invoice._id;
      else await updateInvoice(id, body());
      await issueInvoice(target);
      toast.success("Invoice issued");
      onChanged();
      onClose();
    } catch (e) { toast.error(apiMessage(e)); } finally { setBusy(false); }
  };
  const doVoid = () => { const reason = window.prompt("Why is this invoice being voided? (optional)"); if (reason === null) return; run(() => voidInvoice(id, reason), "Invoice voided"); };
  const doCredit = () => {
    const amount = window.prompt(`Credit note amount (up to ${money(inv.balance, inv.currency)})`);
    if (!amount) return;
    const reason = window.prompt("Reason for the credit note") || "";
    run(() => addCreditNote(id, { amount, reason }), "Credit note added");
  };
  const doDelete = () => { if (window.confirm("Delete this draft?")) run(() => deleteInvoice(id), "Draft deleted", { close: true }); };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {isNew ? "New invoice" : inv.number || "Draft invoice"} {!isNew && statusChip(inv)}
      </DialogTitle>
      <DialogContent sx={{ display: "grid", gap: "1rem", pt: "1rem !important" }}>
        <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(190px, 1fr))" gap="1rem">
          <Autocomplete freeSolo size="small" disabled={!editable} options={meta.customers} value={inv.customerName}
            onInputChange={(e, v) => editable && setInv((x) => ({ ...x, customerName: v }))}
            renderInput={(p) => <TextField {...p} label="Customer" />} />
          <TextField size="small" type="date" label="Invoice date" InputLabelProps={{ shrink: true }} disabled={!editable} value={inv.issueDate} onChange={set("issueDate")} />
          <TextField size="small" type="date" label="Due date (default 30 days)" InputLabelProps={{ shrink: true }} disabled={!editable} value={inv.dueDate || ""} onChange={set("dueDate")} />
          <FormControl size="small" disabled={!editable}>
            <InputLabel>Currency</InputLabel>
            <Select label="Currency" value={inv.currency} onChange={set("currency")}>{meta.currencies.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}</Select>
          </FormControl>
          <TextField size="small" type="number" label="Tax %" disabled={!editable} value={inv.taxRatePct} onChange={set("taxRatePct")} inputProps={{ min: 0, max: 100, step: "any" }} />
        </Box>

        {editable ? (
          <LinesEditor lines={inv.lines} onChange={(lines) => setInv({ ...inv, lines })} taxRatePct={inv.taxRatePct} currency={inv.currency} />
        ) : (
          <Table size="small">
            <TableHead><TableRow>{["Description", "Qty", "Price", "Amount"].map((h) => <TableCell key={h} sx={{ fontWeight: "bold" }}>{h}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {inv.lines.map((l) => <TableRow key={l._id}><TableCell>{l.description}</TableCell><TableCell>{l.quantity}</TableCell><TableCell>{money(l.unitPrice, inv.currency)}</TableCell><TableCell>{money(l.amount, inv.currency)}</TableCell></TableRow>)}
              <TableRow><TableCell colSpan={3} align="right">Total</TableCell><TableCell><b>{money(inv.total, inv.currency)}</b></TableCell></TableRow>
              {inv.paid > 0 && <TableRow><TableCell colSpan={3} align="right">Paid</TableCell><TableCell>{money(inv.paid, inv.currency)}</TableCell></TableRow>}
              {inv.credits > 0 && <TableRow><TableCell colSpan={3} align="right">Credit notes</TableCell><TableCell>{money(inv.credits, inv.currency)}</TableCell></TableRow>}
              <TableRow><TableCell colSpan={3} align="right">Balance</TableCell><TableCell><b>{money(inv.balance, inv.currency)}</b></TableCell></TableRow>
            </TableBody>
          </Table>
        )}

        <TextField size="small" label="Notes (shown on the invoice)" disabled={!editable} value={inv.notes || ""} onChange={set("notes")} multiline minRows={2} />
        <TextField size="small" label="Payment terms / bank details" disabled={!editable} value={inv.terms || ""} onChange={set("terms")} multiline minRows={2} />
        {inv.voidReason && <Typography>Voided: {inv.voidReason}</Typography>}
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: "0.25rem" }}>
        {!isNew && !editable && <Button onClick={() => openPdf(`/invoice/pdf/${id}`).catch((e) => toast.error(apiMessage(e)))}>PDF</Button>}
        {inv.status === "issued" && inv.balance > 0 && (<>
          <Button onClick={() => setPaying(true)}>Record payment</Button>
          <Button onClick={doCredit} disabled={busy}>Credit note</Button>
        </>)}
        {inv.status === "issued" && inv.paid === 0 && <Button color="error" onClick={doVoid} disabled={busy}>Void</Button>}
        {editable && !isNew && <Button color="error" onClick={doDelete} disabled={busy}>Delete draft</Button>}
        <Box flex={1} />
        <Button onClick={onClose}>Close</Button>
        {editable && <Button onClick={save} disabled={busy || !inv.customerName}>Save draft</Button>}
        {editable && <Button variant="contained" onClick={issue} disabled={busy || !inv.customerName}>Issue invoice</Button>}
      </DialogActions>
      {paying && <PaymentDialog invoice={inv} onClose={() => setPaying(false)} onSaved={() => { setPaying(false); onChanged(); load(); }} />}
    </Dialog>
  );
};

export default InvoicesPage;

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl,
  InputLabel, MenuItem, Select, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography, useTheme,
} from "@mui/material";
import { Add } from "@mui/icons-material";
import { toast } from "react-hot-toast";
import FlexBetween from "component/deliverer/FlexBetween";
import Header from "component/deliverer/Header";
import { openPdf } from "utils/invoiceApi";
import { openStoredFile } from "utils/openStoredFile";
import { shrinkForUpload } from "utils/shrinkImage";
import {
  STATUS_LABELS, addPurchaseOrderTrips, apiMessage, createPurchaseOrder, deletePurchaseOrder, fetchPurchaseOrder,
  fetchPurchaseOrders, fetchTripMeta, money, updatePurchaseOrder, uploadPurchaseOrderDocument,
} from "utils/tripApi";

const today = () => new Date().toISOString().slice(0, 10);
const d = (v) => (v ? String(v).slice(0, 10) : "");
const routeText = (stops) => (stops || []).map((s) => s.place).join(" → ");

const empty = () => ({
  customerName: "", poNumber: "", date: today(), description: "", fromPlace: "", fromCountry: "", toPlace: "",
  toCountry: "", price: "", currency: "USD", notes: "", status: "open", tripCount: 1,
});

const fromPo = (po) => ({
  ...empty(),
  customerName: po.customerName || "",
  poNumber: po.poNumber || "",
  date: d(po.date),
  description: po.description || "",
  fromPlace: po.stops?.[0]?.place || "",
  fromCountry: po.stops?.[0]?.country || "",
  toPlace: po.stops?.length > 1 ? po.stops[po.stops.length - 1].place : "",
  toCountry: po.stops?.length > 1 ? po.stops[po.stops.length - 1].country : "",
  price: po.price ?? "",
  currency: po.currency || "USD",
  notes: po.notes || "",
  status: po.status || "open",
});

const toBody = (f) => ({
  customerName: f.customerName,
  poNumber: f.poNumber,
  date: f.date,
  description: f.description,
  // a route is only saved when both ends are filled in
  stops: f.fromPlace && f.toPlace ? [{ place: f.fromPlace, country: f.fromCountry }, { place: f.toPlace, country: f.toCountry }] : [],
  price: f.price,
  currency: f.currency,
  notes: f.notes,
  status: f.status,
});

const PurchaseOrdersPage = () => {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ customers: [], currencies: ["USD"] });
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { pageSize: 200 };
      if (status) params.status = status;
      if (search.trim()) params.search = search.trim();
      setRows((await fetchPurchaseOrders(params)).purchaseOrders);
    } catch (e) {
      toast.error(apiMessage(e));
    } finally {
      setLoading(false);
    }
  }, [status, search]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchTripMeta().then(setMeta).catch(() => {}); }, []);

  return (
    <Box m={{ xs: "1rem 0.75rem", sm: "1.25rem 1.5rem", md: "1.5rem 2.5rem" }}>
      <FlexBetween>
        <Header title="PURCHASE ORDERS" subtitle="The work your clients give you. Add it now, or later when the paperwork turns up." />
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpenId("new")}
          sx={{ backgroundColor: theme.palette.secondary.light, color: theme.palette.background.alt, fontWeight: "bold" }}>
          New purchase order
        </Button>
      </FlexBetween>

      <Box mt="1.5rem" display="flex" gap="1rem" flexWrap="wrap">
        <TextField size="small" label="Search client, PO number, place" value={search} sx={{ minWidth: 260 }} onChange={(e) => setSearch(e.target.value)} />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Show</InputLabel>
          <Select label="Show" value={status} onChange={(e) => setStatus(e.target.value)}>
            <MenuItem value="">All</MenuItem><MenuItem value="open">Open</MenuItem><MenuItem value="done">Done</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box mt="1rem" sx={{ overflowX: "auto", backgroundColor: theme.palette.background.alt, borderRadius: "0.55rem" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {["Date", "PO number", "Client", "Goods", "Route", "Price per trip", "Trips delivered", "Status"].map((h) => (
                <TableCell key={h} sx={{ fontWeight: "bold" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p._id} hover sx={{ cursor: "pointer" }} onClick={() => setOpenId(p._id)}>
                <TableCell>{d(p.date)}</TableCell>
                <TableCell>{p.poNumber || <Typography variant="caption" sx={{ opacity: 0.6 }}>none</Typography>}</TableCell>
                <TableCell>{p.customerName}</TableCell>
                <TableCell>{p.description}</TableCell>
                <TableCell>{routeText(p.stops)}</TableCell>
                <TableCell>{p.price !== undefined && p.price !== null ? money(p.price, p.currency) : ""}</TableCell>
                <TableCell>{p.tripCount ? `${p.deliveredCount} of ${p.tripCount}` : "no trips yet"}</TableCell>
                <TableCell><Chip size="small" color={p.status === "done" ? "success" : "info"} label={p.status === "done" ? "Done" : "Open"} /></TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={8} align="center">{loading ? "Loading..." : "No purchase orders yet."}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Box>

      {openId && <PurchaseOrderDialog id={openId} meta={meta} onClose={() => setOpenId(null)} onChanged={load} />}
    </Box>
  );
};

const PurchaseOrderDialog = ({ id, meta, onClose, onChanged }) => {
  const isNew = id === "new";
  const [form, setForm] = useState(empty());
  const [po, setPo] = useState(null);
  const [trips, setTrips] = useState([]);
  const [more, setMore] = useState(1);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const show = useCallback((res) => {
    setPo(res.purchaseOrder);
    setForm(fromPo(res.purchaseOrder));
    setTrips(res.trips || []);
  }, []);
  const reload = useCallback(() => fetchPurchaseOrder(id).then(show), [id, show]);
  useEffect(() => {
    if (isNew) return;
    reload().catch((e) => { toast.error(apiMessage(e)); onClose(); });
  }, [isNew, reload, onClose]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const run = async (fn, msg, { close = false, refresh = true } = {}) => {
    setBusy(true);
    try {
      const res = await fn();
      if (msg) toast.success(msg);
      onChanged();
      if (close) onClose();
      else if (refresh && !isNew) await reload();
      return res;
    } catch (e) {
      toast.error(apiMessage(e));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    isNew
      ? run(
          async () => {
            const res = await createPurchaseOrder({ ...toBody(form), tripCount: form.tripCount });
            return res;
          },
          "Purchase order saved",
          { close: true }
        )
      : run(() => updatePurchaseOrder(id, toBody(form)), "Purchase order saved");

  const addTrips = () => run(() => addPurchaseOrderTrips(id, more), `Added ${more} trip${Number(more) === 1 ? "" : "s"}`);
  const remove = () => {
    if (window.confirm("Delete this purchase order? Its trips are kept.")) run(() => deletePurchaseOrder(id), "Deleted", { close: true });
  };
  const attach = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    await run(async () => uploadPurchaseOrderDocument(id, await shrinkForUpload(file)), "Original attached");
  };
  const viewOriginal = () => openStoredFile(po.document).catch((e) => toast.error(e.message));

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{isNew ? "New purchase order" : `Purchase order ${po?.poNumber || ""}`.trim()}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: "1rem", pt: "1rem !important" }}>
        <Typography variant="body2" sx={{ opacity: 0.75 }}>
          Only the client and date are needed. Fill in the rest when you have it.
        </Typography>
        <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(190px, 1fr))" gap="1rem">
          <Autocomplete freeSolo size="small" options={meta.customers || []} value={form.customerName}
            onInputChange={(e, v) => setForm((f) => ({ ...f, customerName: v }))}
            renderInput={(p) => <TextField {...p} label="Client" />} />
          <TextField size="small" label="Client's PO number (if any)" value={form.poNumber} onChange={set("poNumber")} />
          <TextField size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} value={form.date} onChange={set("date")} />
          <TextField size="small" label="What must be carried" value={form.description} onChange={set("description")} />
          <TextField size="small" label="Loading point" value={form.fromPlace} onChange={set("fromPlace")} />
          <TextField size="small" label="Country (e.g. ZW)" value={form.fromCountry} onChange={set("fromCountry")} />
          <TextField size="small" label="Offloading point" value={form.toPlace} onChange={set("toPlace")} />
          <TextField size="small" label="Country (e.g. SA)" value={form.toCountry} onChange={set("toCountry")} />
          <TextField size="small" type="number" label="Agreed price per trip" value={form.price} onChange={set("price")} inputProps={{ min: 0, step: "0.01" }} />
          <FormControl size="small">
            <InputLabel>Currency</InputLabel>
            <Select label="Currency" value={form.currency} onChange={set("currency")}>
              {(meta.currencies || ["USD"]).map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          {isNew ? (
            <TextField size="small" type="number" label="How many trips" value={form.tripCount} onChange={set("tripCount")}
              inputProps={{ min: 0, max: 50 }} helperText="Trips are created for you. Use 0 to add them later." />
          ) : (
            <FormControl size="small">
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={form.status} onChange={set("status")}>
                <MenuItem value="open">Open</MenuItem><MenuItem value="done">Done</MenuItem>
              </Select>
            </FormControl>
          )}
        </Box>
        <TextField size="small" label="Notes" value={form.notes} onChange={set("notes")} multiline minRows={2} />

        {!isNew && (
          <>
            <Typography fontWeight="bold">Trips on this order</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>{["Date", "Route", "Price", "Status", "Delivery note"].map((h) => <TableCell key={h} sx={{ fontWeight: "bold" }}>{h}</TableCell>)}</TableRow>
              </TableHead>
              <TableBody>
                {trips.map((t) => (
                  <TableRow key={t._id}>
                    <TableCell>{d(t.date)}</TableCell>
                    <TableCell>{routeText(t.stops)}</TableCell>
                    <TableCell>{money(t.price, t.currency)}</TableCell>
                    <TableCell>{STATUS_LABELS[t.status] || t.status}</TableCell>
                    <TableCell>{t.deliveryNoteNo || ""}{t.signedCopy ? " (signed)" : ""}</TableCell>
                  </TableRow>
                ))}
                {!trips.length && <TableRow><TableCell colSpan={5} align="center">No trips yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
            <Box display="flex" gap="0.5rem" alignItems="center" flexWrap="wrap">
              <TextField size="small" type="number" label="Add trips" value={more} onChange={(e) => setMore(e.target.value)} sx={{ width: 110 }} inputProps={{ min: 1, max: 50 }} />
              <Button onClick={addTrips} disabled={busy || !(Number(more) >= 1)}>Add</Button>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>Each trip is priced and filled in on the Trips page.</Typography>
            </Box>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={attach} />
      </DialogContent>
      <DialogActions sx={{ flexWrap: "wrap", gap: "0.25rem" }}>
        {!isNew && <Button onClick={() => openPdf(`/purchase-order/pdf/${id}`).catch((e) => toast.error(apiMessage(e)))}>Print</Button>}
        {!isNew && <Button onClick={() => fileRef.current && fileRef.current.click()} disabled={busy}>{po?.hasDocument ? "Replace original" : "Attach original"}</Button>}
        {!isNew && po?.hasDocument && <Button onClick={viewOriginal}>View original</Button>}
        {!isNew && <Button color="error" onClick={remove} disabled={busy}>Delete</Button>}
        <Box flex={1} />
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={save} disabled={busy || !form.customerName || !form.date}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PurchaseOrdersPage;

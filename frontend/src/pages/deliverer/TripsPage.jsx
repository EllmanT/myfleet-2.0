import React, { useCallback, useEffect, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { Add, DeleteOutline, EditOutlined } from "@mui/icons-material";
import { toast } from "react-hot-toast";
import FlexBetween from "component/deliverer/FlexBetween";
import Header from "component/deliverer/Header";
import {
  COST_LABELS,
  STATUS_LABELS,
  apiMessage,
  createTrip,
  deleteTrip,
  fetchTripMeta,
  fetchTripSummary,
  fetchTrips,
  money,
  updateTrip,
} from "utils/tripApi";

const today = () => new Date().toISOString().slice(0, 10);
const emptyStop = { place: "", country: "" };
const emptyForm = () => ({
  clientRef: "",
  date: today(),
  status: "",
  customerName: "",
  supplierName: "",
  transporterName: "",
  cargoDescription: "",
  stops: [{ ...emptyStop }, { ...emptyStop }],
  horseId: "",
  trailerId: "",
  driverId: "",
  distanceKm: "",
  price: "",
  currency: "USD",
  deliveredAt: "",
  containerNo: "",
  consignmentNo: "",
  notes: "",
  costLines: [],
  borderCrossings: [],
});

const dateOnly = (v) => (v ? String(v).slice(0, 10) : "");
const routeText = (stops) => (stops || []).map((s) => s.place).join(" → ");

const TripsPage = () => {
  const theme = useTheme();
  const [meta, setMeta] = useState({ vehicles: [], trailers: [], drivers: [], customers: [], costTypes: [], currencies: ["USD"] });
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ from: "", to: "", search: "", horseId: "", crossBorder: "" });
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { pageSize: 500 };
      Object.entries(filters).forEach(([k, v]) => v && (params[k] = v));
      const [list, sum] = await Promise.all([
        fetchTrips(params),
        fetchTripSummary({ from: filters.from, to: filters.to }),
      ]);
      setRows(list.trips);
      setTotal(list.total);
      setSummary(sum);
    } catch (e) {
      toast.error(apiMessage(e));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTripMeta().then(setMeta).catch((e) => toast.error(apiMessage(e)));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const horseName = (id) => {
    const v = meta.vehicles.find((x) => x._id === id);
    return v ? v.regNumber : "";
  };
  const trailerName = (id) => {
    const t = meta.trailers.find((x) => x._id === id);
    return t ? t.regNumber : "";
  };

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm());
    setOpen(true);
  };
  const openEdit = (t) => {
    setEditId(t._id);
    setForm({
      ...emptyForm(),
      ...t,
      date: dateOnly(t.date),
      deliveredAt: dateOnly(t.deliveredAt),
      horseId: t.horseId || "",
      trailerId: t.trailerId || "",
      driverId: t.driverId || "",
      distanceKm: t.distanceKm ?? "",
      clientRef: t.clientRef || "",
      stops: t.stops?.length ? t.stops : emptyForm().stops,
      costLines: (t.costLines || []).map((l) => ({ ...l, date: dateOnly(l.date) })),
      borderCrossings: (t.borderCrossings || []).map((c) => ({ ...c, arrivedAt: dateOnly(c.arrivedAt), clearedAt: dateOnly(c.clearedAt) })),
    });
    setOpen(true);
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setList = (key, i, patch) =>
    setForm({ ...form, [key]: form[key].map((x, idx) => (idx === i ? { ...x, ...patch } : x)) });
  const addTo = (key, item) => setForm({ ...form, [key]: [...form[key], item] });
  const removeFrom = (key, i) => setForm({ ...form, [key]: form[key].filter((_, idx) => idx !== i) });

  const save = async () => {
    setSaving(true);
    try {
      if (editId) await updateTrip(editId, form);
      else await createTrip(form);
      toast.success(editId ? "Trip updated" : "Trip added");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(apiMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Delete trip ${t.clientRef || routeText(t.stops)} for ${t.customerName}?`)) return;
    try {
      await deleteTrip(t._id);
      toast.success("Trip deleted");
      load();
    } catch (e) {
      toast.error(apiMessage(e));
    }
  };

  const usd = summary?.byCurrency?.USD || { revenue: 0, costs: 0 };
  const otherCurrencies = Object.keys(summary?.byCurrency || {}).filter((c) => c !== "USD");

  return (
    <Box m="1.5rem 2.5rem">
      <FlexBetween>
        <Header title="TRIPS" subtitle="Whole-trip records: route, cargo, price, trucks and trip costs." />
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={openNew}
          sx={{ backgroundColor: theme.palette.secondary.light, color: theme.palette.background.alt, fontWeight: "bold" }}
        >
          Add trip
        </Button>
      </FlexBetween>

      <Box mt="1.5rem" display="flex" gap="1rem" flexWrap="wrap">
        <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }}
          value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }}
          value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        <TextField size="small" label="Search client, ref, place, cargo" value={filters.search} sx={{ minWidth: 260 }}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Truck</InputLabel>
          <Select label="Truck" value={filters.horseId} onChange={(e) => setFilters({ ...filters, horseId: e.target.value })}>
            <MenuItem value="">All</MenuItem>
            {meta.vehicles.map((v) => <MenuItem key={v._id} value={v._id}>{v.regNumber}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Type</InputLabel>
          <Select label="Type" value={filters.crossBorder} onChange={(e) => setFilters({ ...filters, crossBorder: e.target.value })}>
            <MenuItem value="">All trips</MenuItem>
            <MenuItem value="true">Cross-border</MenuItem>
            <MenuItem value="false">Local</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {summary && (
        <Typography mt="1rem" color={theme.palette.secondary[200]}>
          {summary.trips} trips ({summary.crossBorderTrips} cross-border) | {summary.distanceKm.toLocaleString()} km |
          Revenue <b>{money(usd.revenue)}</b> | Costs recorded <b>{money(usd.costs)}</b>
          {otherCurrencies.length > 0 && ` | Also in ${otherCurrencies.join(", ")}`}
        </Typography>
      )}

      <Box mt="1rem" sx={{ overflowX: "auto", backgroundColor: theme.palette.background.alt, borderRadius: "0.55rem" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {["Date", "Ref", "Client", "Route", "Cargo", "Truck / Trailer", "Km", "Price", "Costs", "Margin", "Status", ""].map((h) => (
                <TableCell key={h} sx={{ fontWeight: "bold" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t._id} hover sx={{ opacity: t.status === "cancelled" ? 0.5 : 1 }}>
                <TableCell>{dateOnly(t.date)}</TableCell>
                <TableCell>{t.clientRef}</TableCell>
                <TableCell>{t.customerName}</TableCell>
                <TableCell>
                  {routeText(t.stops)}{" "}
                  {t.isCrossBorder && <Chip size="small" label="Cross-border" sx={{ ml: 0.5 }} />}
                </TableCell>
                <TableCell>{t.cargoDescription}</TableCell>
                <TableCell>{[horseName(t.horseId), trailerName(t.trailerId)].filter(Boolean).join(" + ")}</TableCell>
                <TableCell>{t.distanceKm ?? ""}</TableCell>
                <TableCell>{money(t.price, t.currency)}</TableCell>
                <TableCell>{t.costLines?.length ? money(t.totalCosts, t.currency) : ""}</TableCell>
                <TableCell>
                  {t.margin === null ? <Typography variant="caption">mixed currencies</Typography> : t.costLines?.length ? money(t.margin, t.currency) : ""}
                </TableCell>
                <TableCell>{STATUS_LABELS[t.status] || t.status}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <IconButton size="small" onClick={() => openEdit(t)} aria-label="Edit"><EditOutlined fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => remove(t)} aria-label="Delete"><DeleteOutline fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={12} align="center">{loading ? "Loading..." : "No trips for these filters."}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
      <Typography variant="caption" sx={{ opacity: 0.7 }}>{total} trips match.</Typography>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editId ? "Edit trip" : "Add trip"}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: "1rem", pt: "1rem !important" }}>
          <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(190px, 1fr))" gap="1rem">
            <TextField size="small" type="date" label="Trip date" InputLabelProps={{ shrink: true }} value={form.date} onChange={set("date")} />
            <TextField size="small" label="Job reference (e.g. AL.01)" value={form.clientRef} onChange={set("clientRef")} />
            <Autocomplete
              freeSolo size="small" options={meta.customers} value={form.customerName}
              onInputChange={(e, v) => setForm((f) => ({ ...f, customerName: v }))}
              renderInput={(p) => <TextField {...p} label="Client" />}
            />
            <TextField size="small" label="Supplier" value={form.supplierName} onChange={set("supplierName")} />
            <TextField size="small" label="Transporter" value={form.transporterName} onChange={set("transporterName")} />
            <TextField size="small" label="Cargo" value={form.cargoDescription} onChange={set("cargoDescription")} />
          </Box>

          <Typography fontWeight="bold">Route (loading point first, offloading point last)</Typography>
          {form.stops.map((s, i) => (
            <Box key={i} display="flex" gap="0.5rem">
              <TextField size="small" label={i === 0 ? "Loading point" : i === form.stops.length - 1 ? "Offloading point" : "Stop"}
                value={s.place} onChange={(e) => setList("stops", i, { place: e.target.value })} sx={{ flex: 2 }} />
              <TextField size="small" label="Country (e.g. ZW, SA)" value={s.country}
                onChange={(e) => setList("stops", i, { country: e.target.value })} sx={{ flex: 1 }} />
              <IconButton size="small" onClick={() => removeFrom("stops", i)} disabled={form.stops.length <= 2} aria-label="Remove stop">
                <DeleteOutline fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Box>
            <Button size="small" onClick={() => setForm({ ...form, stops: [...form.stops.slice(0, -1), { ...emptyStop }, form.stops[form.stops.length - 1]] })}>
              + Add a stop
            </Button>
          </Box>

          <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(190px, 1fr))" gap="1rem">
            <FormControl size="small">
              <InputLabel>Truck (horse)</InputLabel>
              <Select label="Truck (horse)" value={form.horseId} onChange={set("horseId")}>
                <MenuItem value="">None</MenuItem>
                {meta.vehicles.map((v) => <MenuItem key={v._id} value={v._id}>{`${v.make || ""} ${v.regNumber || ""}`.trim()}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small">
              <InputLabel>Trailer</InputLabel>
              <Select label="Trailer" value={form.trailerId} onChange={set("trailerId")}>
                <MenuItem value="">None</MenuItem>
                {meta.trailers.map((t) => <MenuItem key={t._id} value={t._id}>{t.regNumber}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small">
              <InputLabel>Driver</InputLabel>
              <Select label="Driver" value={form.driverId} onChange={set("driverId")}>
                <MenuItem value="">None</MenuItem>
                {meta.drivers.map((d) => <MenuItem key={d._id} value={d._id}>{d.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" type="number" label="Distance (km)" value={form.distanceKm} onChange={set("distanceKm")} inputProps={{ min: 0 }} />
            <TextField size="small" type="number" label="Price" value={form.price} onChange={set("price")} inputProps={{ min: 0, step: "0.01" }} />
            <FormControl size="small">
              <InputLabel>Currency</InputLabel>
              <Select label="Currency" value={form.currency} onChange={set("currency")}>
                {meta.currencies.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" type="date" label="Delivered on" InputLabelProps={{ shrink: true }} value={form.deliveredAt} onChange={set("deliveredAt")} />
            <FormControl size="small">
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={form.status} onChange={set("status")} displayEmpty>
                <MenuItem value="">Automatic</MenuItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" label="Container number" value={form.containerNo} onChange={set("containerNo")} />
            <TextField size="small" label="Consignment note no." value={form.consignmentNo} onChange={set("consignmentNo")} />
          </Box>

          <Typography fontWeight="bold">Trip costs</Typography>
          {form.costLines.map((l, i) => (
            <Box key={i} display="flex" gap="0.5rem" flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <Select value={l.type || "other"} onChange={(e) => setList("costLines", i, { type: e.target.value })}>
                  {meta.costTypes.map((c) => <MenuItem key={c} value={c}>{COST_LABELS[c] || c}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" label="Description" value={l.description || ""} sx={{ flex: 1, minWidth: 140 }}
                onChange={(e) => setList("costLines", i, { description: e.target.value })} />
              <TextField size="small" type="number" label="Amount" value={l.amount ?? ""} sx={{ width: 120 }}
                onChange={(e) => setList("costLines", i, { amount: e.target.value })} inputProps={{ min: 0, step: "0.01" }} />
              <FormControl size="small" sx={{ width: 90 }}>
                <Select value={l.currency || form.currency} onChange={(e) => setList("costLines", i, { currency: e.target.value })}>
                  {meta.currencies.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
              <IconButton size="small" onClick={() => removeFrom("costLines", i)} aria-label="Remove cost"><DeleteOutline fontSize="small" /></IconButton>
            </Box>
          ))}
          <Box><Button size="small" onClick={() => addTo("costLines", { type: "border_fee", description: "", amount: "", currency: form.currency })}>+ Add a cost</Button></Box>

          <Typography fontWeight="bold">Border crossings</Typography>
          {form.borderCrossings.map((c, i) => (
            <Box key={i} display="flex" gap="0.5rem" flexWrap="wrap">
              <TextField size="small" label="Border post" value={c.post || ""} sx={{ flex: 1, minWidth: 160 }}
                onChange={(e) => setList("borderCrossings", i, { post: e.target.value })} />
              <FormControl size="small" sx={{ width: 120 }}>
                <Select value={c.direction || "out"} onChange={(e) => setList("borderCrossings", i, { direction: e.target.value })}>
                  <MenuItem value="out">Leaving</MenuItem>
                  <MenuItem value="in">Entering</MenuItem>
                </Select>
              </FormControl>
              <TextField size="small" type="date" label="Arrived" InputLabelProps={{ shrink: true }} value={c.arrivedAt || ""}
                onChange={(e) => setList("borderCrossings", i, { arrivedAt: e.target.value })} />
              <TextField size="small" type="date" label="Cleared" InputLabelProps={{ shrink: true }} value={c.clearedAt || ""}
                onChange={(e) => setList("borderCrossings", i, { clearedAt: e.target.value })} />
              <IconButton size="small" onClick={() => removeFrom("borderCrossings", i)} aria-label="Remove crossing"><DeleteOutline fontSize="small" /></IconButton>
            </Box>
          ))}
          <Box><Button size="small" onClick={() => addTo("borderCrossings", { post: "Beitbridge", direction: "out", arrivedAt: "", clearedAt: "" })}>+ Add a border crossing</Button></Box>

          <TextField size="small" label="Notes" value={form.notes} onChange={set("notes")} multiline minRows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving || form.price === "" || !form.customerName}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TripsPage;

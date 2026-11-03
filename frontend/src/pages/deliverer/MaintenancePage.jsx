import React, { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, IconButton,
  InputLabel, MenuItem, Select, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField,
  Typography, useTheme,
} from "@mui/material";
import { Add, DeleteOutline } from "@mui/icons-material";
import { toast } from "react-hot-toast";
import FlexBetween from "component/deliverer/FlexBetween";
import Header from "component/deliverer/Header";
import {
  apiMessage, createPlan, createRecord, createTyre, deletePlan, deleteRecord, deleteTyre, fetchMeta,
  fetchPlans, fetchRecords, fetchTruckCosts, fetchTyres, fitTyre, money, removeTyre,
} from "utils/maintenanceApi";

const today = () => new Date().toISOString().slice(0, 10);
const d = (v) => (v ? String(v).slice(0, 10) : "");
const km = (n) => (n === null || n === undefined ? "" : Number(n).toLocaleString("en-US"));
const assetLabel = (a, type) => (type === "trailer" ? a.regNumber : `${a.make || ""} ${a.regNumber || ""}`.trim());

const statusChip = (p) =>
  p.status === "overdue" ? <Chip size="small" color="error" label={p.reasons.join(", ")} />
  : p.status === "due_soon" ? <Chip size="small" color="warning" label={p.reasons.join(", ")} />
  : <Chip size="small" color="success" variant="outlined" label="OK" />;

const box = (theme) => ({ overflowX: "auto", backgroundColor: theme.palette.background.alt, borderRadius: "0.55rem", mt: "1rem" });

// A pick-list of this company's trucks and trailers that remembers which kind it is.
const AssetPicker = ({ meta, value, onChange, disabled }) => {
  const all = [
    ...meta.vehicles.map((v) => ({ key: `vehicle:${v._id}`, type: "vehicle", id: v._id, label: assetLabel(v, "vehicle") })),
    ...meta.trailers.map((t) => ({ key: `trailer:${t._id}`, type: "trailer", id: t._id, label: `Trailer ${t.regNumber}` })),
  ];
  return (
    <FormControl size="small" disabled={disabled}>
      <InputLabel>Truck or trailer</InputLabel>
      <Select label="Truck or trailer" value={value.assetId ? `${value.assetType}:${value.assetId}` : ""}
        onChange={(e) => { const [t, id] = e.target.value.split(":"); onChange({ assetType: t, assetId: id }); }}>
        {all.map((a) => <MenuItem key={a.key} value={a.key}>{a.label}</MenuItem>)}
      </Select>
    </FormControl>
  );
};

const MaintenancePage = () => {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [meta, setMeta] = useState({ vehicles: [], trailers: [], types: [] });
  const [bump, setBump] = useState(0);
  const refresh = () => setBump((n) => n + 1);
  useEffect(() => { fetchMeta().then(setMeta).catch((e) => toast.error(apiMessage(e))); }, []);

  return (
    <Box m="1.5rem 2.5rem">
      <Header title="MAINTENANCE" subtitle="Service reminders, workshop records, and how long your tyres last." />
      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mt: "1rem" }}>
        <Tab label="Service due" /><Tab label="Workshop records" /><Tab label="Tyres" /><Tab label="Cost per km" />
      </Tabs>
      {tab === 0 && <Due meta={meta} bump={bump} onChanged={refresh} theme={theme} />}
      {tab === 1 && <Records meta={meta} bump={bump} onChanged={refresh} theme={theme} />}
      {tab === 2 && <Tyres meta={meta} bump={bump} onChanged={refresh} theme={theme} />}
      {tab === 3 && <Costs meta={meta} theme={theme} />}
    </Box>
  );
};

/* ---------- service due ---------- */
const Due = ({ meta, bump, onChanged, theme }) => {
  const [data, setData] = useState({ plans: [], overdue: 0, dueSoon: 0 });
  const [planOpen, setPlanOpen] = useState(false);
  const [logFor, setLogFor] = useState(null);
  const load = useCallback(() => fetchPlans().then(setData).catch((e) => toast.error(apiMessage(e))), []);
  useEffect(() => { load(); }, [load, bump]);

  const remove = async (p) => {
    if (!window.confirm(`Delete the plan "${p.name}" for ${p.assetName}?`)) return;
    try { await deletePlan(p._id); toast.success("Plan deleted"); onChanged(); } catch (e) { toast.error(apiMessage(e)); }
  };

  return (
    <Box>
      <FlexBetween mt="1rem">
        {data.overdue + data.dueSoon > 0
          ? <Alert severity={data.overdue ? "error" : "warning"} sx={{ flex: 1, mr: 2 }}>{data.overdue} overdue, {data.dueSoon} due soon.</Alert>
          : <Typography sx={{ opacity: 0.75 }}>Nothing is due right now.</Typography>}
        <Button variant="contained" startIcon={<Add />} onClick={() => setPlanOpen(true)}>Add a service plan</Button>
      </FlexBetween>
      <Box sx={box(theme)}>
        <Table size="small">
          <TableHead><TableRow>{["Truck / trailer", "Plan", "Every", "Last done", "Since then", "Status", ""].map((h) => <TableCell key={h} sx={{ fontWeight: "bold" }}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {data.plans.map((p) => (
              <TableRow key={p._id} hover>
                <TableCell>{p.assetName}</TableCell><TableCell>{p.name}</TableCell>
                <TableCell>{[p.intervalKm && `${km(p.intervalKm)} km`, p.intervalDays && `${p.intervalDays} days`].filter(Boolean).join(" or ")}</TableCell>
                <TableCell>{d(p.lastDoneAt)}{p.lastDoneKm !== null ? ` at ${km(p.lastDoneKm)} km` : ""}</TableCell>
                <TableCell>{p.kmSince !== null ? `${km(Math.round(p.kmSince))} km` : "distance unknown"}</TableCell>
                <TableCell>{statusChip(p)}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <Button size="small" onClick={() => setLogFor(p)}>Log it done</Button>
                  <IconButton size="small" onClick={() => remove(p)} aria-label="Delete plan"><DeleteOutline fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!data.plans.length && <TableRow><TableCell colSpan={7} align="center">No service plans yet. Add one, e.g. "Full service every 10,000 km".</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Box>
      {planOpen && <PlanDialog meta={meta} onClose={() => setPlanOpen(false)} onSaved={() => { setPlanOpen(false); onChanged(); }} />}
      {logFor && <RecordDialog meta={meta} plan={logFor} onClose={() => setLogFor(null)} onSaved={() => { setLogFor(null); onChanged(); }} />}
    </Box>
  );
};

const PlanDialog = ({ meta, onClose, onSaved }) => {
  const [f, setF] = useState({ assetType: "", assetId: "", name: "Full service", intervalKm: "", intervalDays: "", baselineKm: "", baselineDate: today() });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setSaving(true);
    try { await createPlan(f); toast.success("Plan added"); onSaved(); } catch (e) { toast.error(apiMessage(e)); } finally { setSaving(false); }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Add a service plan</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: "1rem", pt: "1rem !important" }}>
        <AssetPicker meta={meta} value={f} onChange={(a) => setF({ ...f, ...a })} />
        <TextField size="small" label="Plan name" value={f.name} onChange={set("name")} />
        <TextField size="small" type="number" label="Every (km)" value={f.intervalKm} onChange={set("intervalKm")} inputProps={{ min: 1 }} />
        <TextField size="small" type="number" label="or every (days)" value={f.intervalDays} onChange={set("intervalDays")} inputProps={{ min: 1 }} />
        <TextField size="small" type="date" label="Last done on" InputLabelProps={{ shrink: true }} value={f.baselineDate} onChange={set("baselineDate")} />
        {f.assetType === "vehicle" && <TextField size="small" type="number" label="Odometer when last done (blank = now)" value={f.baselineKm} onChange={set("baselineKm")} />}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !f.assetId || !f.name || (!f.intervalKm && !f.intervalDays)}>{saving ? "Saving..." : "Save"}</Button>
      </DialogActions>
    </Dialog>
  );
};

/* ---------- workshop records ---------- */
const Records = ({ meta, bump, onChanged, theme }) => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => fetchRecords().then((r) => { setRows(r.records); setTotal(r.total); }).catch((e) => toast.error(apiMessage(e))), []);
  useEffect(() => { load(); }, [load, bump]);
  const remove = async (r) => {
    if (!window.confirm(`Delete this ${r.type} record for ${r.assetName}?`)) return;
    try { await deleteRecord(r._id); toast.success("Record deleted"); onChanged(); } catch (e) { toast.error(apiMessage(e)); }
  };
  return (
    <Box>
      <FlexBetween mt="1rem">
        <Typography>{rows.length} records | Total spent <b>{money(total)}</b></Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>Add a record</Button>
      </FlexBetween>
      <Box sx={box(theme)}>
        <Table size="small">
          <TableHead><TableRow>{["Date", "Truck / trailer", "Type", "What was done", "Supplier", "Odometer", "Cost", ""].map((h) => <TableCell key={h} sx={{ fontWeight: "bold" }}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r._id} hover>
                <TableCell>{d(r.date)}</TableCell><TableCell>{r.assetName}</TableCell><TableCell>{r.type}</TableCell>
                <TableCell>{r.description}</TableCell><TableCell>{r.supplier}</TableCell><TableCell>{km(r.odometer)}</TableCell>
                <TableCell>{money(r.cost)}</TableCell>
                <TableCell align="right"><IconButton size="small" onClick={() => remove(r)} aria-label="Delete record"><DeleteOutline fontSize="small" /></IconButton></TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={8} align="center">No workshop records yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Box>
      {open && <RecordDialog meta={meta} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onChanged(); }} />}
    </Box>
  );
};

const RecordDialog = ({ meta, plan, onClose, onSaved }) => {
  const [f, setF] = useState({
    assetType: plan ? plan.assetType : "", assetId: plan ? plan.assetId : "", date: today(), odometer: "",
    type: "service", description: plan ? plan.name : "", supplier: "", cost: "", planId: plan ? plan._id : "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setSaving(true);
    try { await createRecord(f); toast.success(plan ? "Logged. The clock has restarted." : "Record added"); onSaved(); } catch (e) { toast.error(apiMessage(e)); } finally { setSaving(false); }
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{plan ? `Log: ${plan.name} (${plan.assetName})` : "Add a workshop record"}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: "1rem", pt: "1rem !important" }}>
        <AssetPicker meta={meta} value={f} disabled={Boolean(plan)} onChange={(a) => setF({ ...f, ...a })} />
        <TextField size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} value={f.date} onChange={set("date")} />
        <FormControl size="small">
          <InputLabel>Type</InputLabel>
          <Select label="Type" value={f.type} onChange={set("type")}>{meta.types.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select>
        </FormControl>
        <TextField size="small" label="What was done" value={f.description} onChange={set("description")} />
        <TextField size="small" label="Workshop / supplier" value={f.supplier} onChange={set("supplier")} />
        {f.assetType !== "trailer" && <TextField size="small" type="number" label="Odometer" value={f.odometer} onChange={set("odometer")} />}
        <TextField size="small" type="number" label="Cost" value={f.cost} onChange={set("cost")} inputProps={{ min: 0, step: "0.01" }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !f.assetId}>{saving ? "Saving..." : "Save"}</Button>
      </DialogActions>
    </Dialog>
  );
};

/* ---------- tyres ---------- */
const Tyres = ({ meta, bump, onChanged, theme }) => {
  const [rows, setRows] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [fitFor, setFitFor] = useState(null);
  const [removeFor, setRemoveFor] = useState(null);
  const load = useCallback(() => fetchTyres().then((r) => setRows(r.tyres)).catch((e) => toast.error(apiMessage(e))), []);
  useEffect(() => { load(); }, [load, bump]);
  const remove = async (t) => {
    if (!window.confirm(`Delete tyre ${t.serial}?`)) return;
    try { await deleteTyre(t._id); toast.success("Tyre deleted"); onChanged(); } catch (e) { toast.error(apiMessage(e)); }
  };
  return (
    <Box>
      <FlexBetween mt="1rem">
        <Typography sx={{ opacity: 0.75 }}>Cost per km appears once a tyre has run some distance.</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setAddOpen(true)}>Add a tyre</Button>
      </FlexBetween>
      <Box sx={box(theme)}>
        <Table size="small">
          <TableHead><TableRow>{["Serial", "Brand / size", "Cost", "Status", "Fitted to", "Km run", "Cost per km", ""].map((h) => <TableCell key={h} sx={{ fontWeight: "bold" }}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t._id} hover sx={{ opacity: t.status === "scrapped" ? 0.5 : 1 }}>
                <TableCell>{t.serial}</TableCell><TableCell>{[t.brand, t.size].filter(Boolean).join(" ")}</TableCell>
                <TableCell>{money(t.cost)}</TableCell><TableCell>{t.status.replace("_", " ")}</TableCell>
                <TableCell>{t.fittedTo ? `${t.fittedTo.assetName} - ${t.fittedTo.position}` : ""}</TableCell>
                <TableCell>{km(t.totalKm)}</TableCell>
                <TableCell>{t.costPerKm !== null ? `$${t.costPerKm.toFixed(4)}` : ""}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  {t.status === "in_stock" && <Button size="small" onClick={() => setFitFor(t)}>Fit</Button>}
                  {t.status === "fitted" && <Button size="small" onClick={() => setRemoveFor(t)}>Remove</Button>}
                  {!t.fitments && <IconButton size="small" onClick={() => remove(t)} aria-label="Delete tyre"><DeleteOutline fontSize="small" /></IconButton>}
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && <TableRow><TableCell colSpan={8} align="center">No tyres yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Box>
      {addOpen && <TyreDialog onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); onChanged(); }} />}
      {fitFor && <FitDialog meta={meta} tyre={fitFor} onClose={() => setFitFor(null)} onSaved={() => { setFitFor(null); onChanged(); }} />}
      {removeFor && <RemoveDialog tyre={removeFor} onClose={() => setRemoveFor(null)} onSaved={() => { setRemoveFor(null); onChanged(); }} />}
    </Box>
  );
};

const useForm = (init) => {
  const [f, setF] = useState(init);
  return [f, (k) => (e) => setF({ ...f, [k]: e.target.value }), setF];
};

const TyreDialog = ({ onClose, onSaved }) => {
  const [f, set] = useForm({ serial: "", brand: "", size: "", condition: "new", cost: "" });
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { await createTyre(f); toast.success("Tyre added"); onSaved(); } catch (e) { toast.error(apiMessage(e)); } finally { setSaving(false); } };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Add a tyre</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: "1rem", pt: "1rem !important" }}>
        <TextField size="small" label="Serial number" value={f.serial} onChange={set("serial")} />
        <TextField size="small" label="Brand" value={f.brand} onChange={set("brand")} />
        <TextField size="small" label="Size (e.g. 315/80R22.5)" value={f.size} onChange={set("size")} />
        <FormControl size="small"><InputLabel>Condition</InputLabel>
          <Select label="Condition" value={f.condition} onChange={set("condition")}><MenuItem value="new">New</MenuItem><MenuItem value="retread">Retread</MenuItem><MenuItem value="used">Used</MenuItem></Select>
        </FormControl>
        <TextField size="small" type="number" label="Cost" value={f.cost} onChange={set("cost")} inputProps={{ min: 0, step: "0.01" }} />
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={save} disabled={saving || !f.serial}>{saving ? "Saving..." : "Save"}</Button></DialogActions>
    </Dialog>
  );
};

const FitDialog = ({ meta, tyre, onClose, onSaved }) => {
  const [f, set, setF] = useForm({ assetType: "", assetId: "", position: "", fittedAt: today(), fittedOdometer: "" });
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { await fitTyre({ ...f, tyreId: tyre._id }); toast.success("Tyre fitted"); onSaved(); } catch (e) { toast.error(apiMessage(e)); } finally { setSaving(false); } };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Fit tyre {tyre.serial}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: "1rem", pt: "1rem !important" }}>
        <AssetPicker meta={meta} value={f} onChange={(a) => setF({ ...f, ...a })} />
        <TextField size="small" label="Wheel position (e.g. Steer left, Drive 2 outer right)" value={f.position} onChange={set("position")} />
        <TextField size="small" type="date" label="Date fitted" InputLabelProps={{ shrink: true }} value={f.fittedAt} onChange={set("fittedAt")} />
        {f.assetType === "vehicle" && <TextField size="small" type="number" label="Odometer now" value={f.fittedOdometer} onChange={set("fittedOdometer")} />}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={save} disabled={saving || !f.assetId || !f.position}>{saving ? "Saving..." : "Fit"}</Button></DialogActions>
    </Dialog>
  );
};

const RemoveDialog = ({ tyre, onClose, onSaved }) => {
  const [f, set, setF] = useForm({ removedAt: today(), removedOdometer: "", reason: "", scrap: false });
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { await removeTyre(tyre.fittedTo.fitmentId, f); toast.success(f.scrap ? "Tyre scrapped" : "Tyre removed"); onSaved(); } catch (e) { toast.error(apiMessage(e)); } finally { setSaving(false); } };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Remove tyre {tyre.serial}</DialogTitle>
      <DialogContent sx={{ display: "grid", gap: "1rem", pt: "1rem !important" }}>
        <Typography variant="body2">Fitted to {tyre.fittedTo.assetName}, {tyre.fittedTo.position}.</Typography>
        <TextField size="small" type="date" label="Date removed" InputLabelProps={{ shrink: true }} value={f.removedAt} onChange={set("removedAt")} />
        {tyre.fittedTo.assetType === "vehicle" && <TextField size="small" type="number" label="Odometer now" value={f.removedOdometer} onChange={set("removedOdometer")} />}
        <TextField size="small" label="Why (worn, puncture, rotated...)" value={f.reason} onChange={set("reason")} />
        <FormControl size="small"><InputLabel>After removal</InputLabel>
          <Select label="After removal" value={f.scrap ? "scrap" : "stock"} onChange={(e) => setF({ ...f, scrap: e.target.value === "scrap" })}>
            <MenuItem value="stock">Keep in stock (can be refitted)</MenuItem><MenuItem value="scrap">Scrap it</MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={save} disabled={saving}>{saving ? "Saving..." : "Remove"}</Button></DialogActions>
    </Dialog>
  );
};

/* ---------- cost per km ---------- */
const Costs = ({ meta, theme }) => {
  const [vehicleId, setVehicleId] = useState("");
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!vehicleId) { setData(null); return; }
    fetchTruckCosts({ vehicleId, from, to }).then(setData).catch((e) => toast.error(apiMessage(e)));
  }, [vehicleId, from, to]);
  const rate = (n) => (n === null || n === undefined ? "n/a" : `$${n.toFixed(3)} / km`);
  return (
    <Box mt="1rem">
      <Box display="flex" gap="1rem" flexWrap="wrap">
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Truck</InputLabel>
          <Select label="Truck" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            {meta.vehicles.map((v) => <MenuItem key={v._id} value={v._id}>{assetLabel(v, "vehicle")}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
        <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
      </Box>
      {data && (
        <Box sx={{ ...box(theme), p: "1.25rem" }}>
          <Typography>Distance driven: <b>{km(data.km)} km</b> (from this truck's jobs and trips)</Typography>
          <Typography mt="0.5rem">Workshop spend: <b>{money(data.maintenance)}</b> ({rate(data.maintenancePerKm)})</Typography>
          <Typography>Tyres (estimate): <b>{money(data.tyreEstimate)}</b> ({rate(data.tyrePerKm)}) from {data.tyresCounted} of {data.tyresFitted} fitted tyres</Typography>
          <Typography mt="0.5rem" variant="h5">Total <b>{money(data.total)}</b> = {rate(data.totalPerKm)}</Typography>
          <Typography mt="0.75rem" variant="body2" sx={{ opacity: 0.7 }}>{data.note}</Typography>
        </Box>
      )}
      {!vehicleId && <Typography mt="1rem" sx={{ opacity: 0.7 }}>Choose a truck to see what its upkeep costs per kilometre.</Typography>}
    </Box>
  );
};

export default MaintenancePage;

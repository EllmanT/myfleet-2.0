import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
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
import { Add, ContentCopyOutlined, DeleteOutline, EditOutlined } from "@mui/icons-material";
import { toast } from "react-hot-toast";
import FlexBetween from "component/deliverer/FlexBetween";
import Header from "component/deliverer/Header";
import { apiMessage, money } from "utils/expenseApi";
import {
  STATUS_HELP,
  STATUS_LABEL,
  createFill,
  deleteFill,
  fetchFills,
  fetchFuelMeta,
  fetchWeekly,
  updateFill,
} from "utils/fuelApi";

const DRIVERS = ["Chris", "Chamu"];
const toLocalInput = (d) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};
const emptyForm = () => ({
  vehicleId: "",
  driverName: "",
  filledAt: toLocalInput(new Date()),
  odometer: "",
  litres: "",
  amount: "",
  fullTank: true,
  purpose: "business",
  station: "",
  photoPosted: false,
  cashGiven: "",
  notes: "",
});

const StatusChip = ({ status }) => (
  <Chip
    size="small"
    label={STATUS_LABEL[status] || status}
    color={status === "ok" ? "success" : status === "check" ? "warning" : "error"}
    variant={status === "ok" ? "outlined" : "filled"}
  />
);

const FuelLogPage = () => {
  const theme = useTheme();
  const [meta, setMeta] = useState({ vehicles: [] });
  const [week, setWeek] = useState(null);
  const [weekDate, setWeekDate] = useState(new Date().toISOString().slice(0, 10));
  const [fills, setFills] = useState([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [w, f] = await Promise.all([fetchWeekly(weekDate), fetchFills({})]);
      setWeek(w);
      setFills(f.fills);
    } catch (e) {
      toast.error(apiMessage(e));
    }
  }, [weekDate]);

  useEffect(() => {
    fetchFuelMeta().then(setMeta).catch((e) => toast.error(apiMessage(e)));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const lastOdo = useMemo(() => {
    const m = {};
    fills.forEach((f) => {
      const k = String(f.vehicleId);
      if (!m[k] || new Date(f.filledAt) > new Date(m[k].filledAt)) m[k] = f;
    });
    return m;
  }, [fills]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const tick = (k) => (e) => setForm({ ...form, [k]: e.target.checked });

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm());
    setOpen(true);
  };
  const openEdit = (f) => {
    setEditId(f._id);
    setForm({ ...emptyForm(), ...f, vehicleId: String(f.vehicleId), filledAt: toLocalInput(f.filledAt), cashGiven: f.cashGiven ?? "" });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form, filledAt: new Date(form.filledAt).toISOString() };
      if (editId) await updateFill(editId, body);
      else await createFill(body);
      toast.success(editId ? "Fill-up updated" : "Fill-up saved");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(apiMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (f) => {
    if (!window.confirm(`Delete the ${f.litres} L fill-up for ${f.vehicleName}?`)) return;
    try {
      await deleteFill(f._id);
      toast.success("Fill-up deleted");
      load();
    } catch (e) {
      toast.error(apiMessage(e));
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(week.text);
      toast.success("Summary copied. Paste it in the WhatsApp group.");
    } catch {
      toast.error("Could not copy. Select the text and copy it by hand.");
    }
  };

  const canSave = form.vehicleId && form.odometer !== "" && form.litres !== "" && form.amount !== "";
  const last = form.vehicleId ? lastOdo[form.vehicleId] : null;

  return (
    <Box m="1.5rem 2.5rem">
      <FlexBetween>
        <Header
          title="FUEL LOG"
          subtitle="Fill the tank to full each time. Enter the odometer and litres. The weekly check shows km per litre for each truck."
        />
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={openNew}
          sx={{ backgroundColor: theme.palette.secondary.light, color: theme.palette.background.alt, fontWeight: "bold" }}
        >
          Add fill-up
        </Button>
      </FlexBetween>

      <Box mt="1.5rem" display="flex" gap="1rem" alignItems="center" flexWrap="wrap">
        <TextField size="small" type="date" label="Week containing" InputLabelProps={{ shrink: true }}
          value={weekDate} onChange={(e) => setWeekDate(e.target.value)} />
        {week && (
          <Typography color={theme.palette.secondary[200]}>
            Monday {String(week.weekStart).slice(0, 10)} to Sunday {new Date(new Date(week.weekEnd) - 864e5).toISOString().slice(0, 10)}
          </Typography>
        )}
        <Button startIcon={<ContentCopyOutlined />} onClick={copyText} disabled={!week} variant="outlined">
          Copy WhatsApp summary
        </Button>
      </Box>

      <Box mt="1rem" sx={{ overflowX: "auto", backgroundColor: theme.palette.background.alt, borderRadius: "0.55rem" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {["Truck", "Fill-ups", "Litres", "Cost", "Km driven", "Km per litre", "Normal", "Litres it should need", "Result"].map((h) => (
                <TableCell key={h} sx={{ fontWeight: "bold" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {(week?.vehicles || []).map((v) => (
              <TableRow key={v.vehicleId}>
                <TableCell>{v.name}</TableCell>
                <TableCell>{v.fills}</TableCell>
                <TableCell>{v.fills ? v.litres : "-"}</TableCell>
                <TableCell>{v.fills ? money(v.amount) : "-"}</TableCell>
                <TableCell>{v.km ?? "-"}</TableCell>
                <TableCell>{v.kmpl ?? "-"}</TableCell>
                <TableCell>{v.expectedKmpl}</TableCell>
                <TableCell>{v.expectedLitres ?? "-"}{v.expectedLitres != null ? ` (put in: ${v.litresMeasured})` : ""}</TableCell>
                <TableCell>
                  {v.fills ? (
                    <Box>
                      <StatusChip status={v.status} />
                      <Typography variant="caption" display="block">{STATUS_HELP[v.status]}</Typography>
                    </Box>
                  ) : "No fill this week"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Typography mt="0.5rem" variant="body2" color={theme.palette.secondary[300]}>
        Km per litre is only worked out when this fill and the one before it were both filled to full.
        Within 15% of normal is OK, 15 to 30% worse is Check, more than 30% worse is Review.
      </Typography>

      <Typography mt="1.5rem" variant="h5" color={theme.palette.secondary[100]}>All fill-ups</Typography>
      <Box mt="0.5rem" sx={{ overflowX: "auto", backgroundColor: theme.palette.background.alt, borderRadius: "0.55rem" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {["Date", "Truck", "Driver", "Odometer", "Litres", "Cost", "Km since last", "Km per litre", "Result", "Things to look at", ""].map((h) => (
                <TableCell key={h} sx={{ fontWeight: "bold" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {fills.map((f) => (
              <TableRow key={f._id} hover>
                <TableCell>{new Date(f.filledAt).toLocaleString()}</TableCell>
                <TableCell>{f.vehicleName}</TableCell>
                <TableCell>{f.driverName}</TableCell>
                <TableCell>{f.odometer.toLocaleString()}</TableCell>
                <TableCell>{f.litres}{f.fullTank ? "" : " (not full)"}</TableCell>
                <TableCell>{money(f.amount)}{f.purpose === "private" ? " (private)" : ""}</TableCell>
                <TableCell>{f.km ?? "-"}</TableCell>
                <TableCell>{f.kmpl ? f.kmpl.toFixed(1) : "-"}</TableCell>
                <TableCell><StatusChip status={f.status} /></TableCell>
                <TableCell sx={{ maxWidth: 320 }}>{f.flags.join(". ")}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <IconButton size="small" aria-label="Edit" onClick={() => openEdit(f)}><EditOutlined fontSize="small" /></IconButton>
                  <IconButton size="small" aria-label="Delete" onClick={() => remove(f)}><DeleteOutline fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!fills.length && (
              <TableRow><TableCell colSpan={11} align="center">No fill-ups yet. Add the first one with the button above.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editId ? "Edit fill-up" : "Add fill-up"}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: "1rem", pt: "1rem !important" }}>
          <FormControl size="small">
            <InputLabel>Truck</InputLabel>
            <Select label="Truck" value={form.vehicleId} onChange={set("vehicleId")}>
              {meta.vehicles.map((v) => <MenuItem key={v._id} value={v._id}>{v.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Driver</InputLabel>
            <Select label="Driver" value={form.driverName} onChange={set("driverName")}>
              {DRIVERS.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              <MenuItem value="Family">Family (private)</MenuItem>
              <MenuItem value="Other">Other</MenuItem>
            </Select>
          </FormControl>
          <TextField size="small" type="datetime-local" label="Date and time of the fill" InputLabelProps={{ shrink: true }} value={form.filledAt} onChange={set("filledAt")} />
          <TextField size="small" type="number" label="Odometer (km, from the dashboard photo)" value={form.odometer} onChange={set("odometer")}
            helperText={last ? `Last fill for this truck: ${last.odometer.toLocaleString()} km` : ""} inputProps={{ min: 0 }} />
          <TextField size="small" type="number" label="Litres (from the pump photo)" value={form.litres} onChange={set("litres")} inputProps={{ min: 0, step: "0.01" }} />
          <TextField size="small" type="number" label="Amount paid ($)" value={form.amount} onChange={set("amount")} inputProps={{ min: 0, step: "0.01" }} />
          <TextField size="small" type="number" label="Cash given for this fill ($, optional)" value={form.cashGiven} onChange={set("cashGiven")} inputProps={{ min: 0, step: "0.01" }} />
          <TextField size="small" label="Station" value={form.station} onChange={set("station")} />
          <FormControlLabel control={<Checkbox checked={!!form.fullTank} onChange={tick("fullTank")} />} label="Tank filled to full (until the pump clicked off)" />
          <FormControlLabel control={<Checkbox checked={!!form.photoPosted} onChange={tick("photoPosted")} />} label="Pump and odometer photos posted in the WhatsApp group" />
          <FormControlLabel
            control={<Checkbox checked={form.purpose === "private"} onChange={(e) => setForm({ ...form, purpose: e.target.checked ? "private" : "business" })} />}
            label="Private fuel (family pays). Recorded, never counted in profit"
          />
          <TextField size="small" label="Notes" value={form.notes} onChange={set("notes")} multiline minRows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving || !canSave}>{saving ? "Saving..." : "Save"}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FuelLogPage;

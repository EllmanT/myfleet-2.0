import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
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
import { Add, DeleteOutline, EditOutlined } from "@mui/icons-material";
import { toast } from "react-hot-toast";
import FlexBetween from "component/deliverer/FlexBetween";
import Header from "component/deliverer/Header";
import { apiMessage, createTrailer, deleteTrailer, fetchTrailers, updateTrailer } from "utils/tripApi";

const emptyForm = { regNumber: "", type: "flatbed", axles: "", capacityTons: "", notes: "", active: true };

const TrailersPage = () => {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTrailers();
      setRows(data.trailers);
      setTypes(data.types);
    } catch (e) {
      toast.error(apiMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const openNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (t) => {
    setEditId(t._id);
    setForm({ ...emptyForm, ...t, axles: t.axles ?? "", capacityTons: t.capacityTons ?? "" });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editId) await updateTrailer(editId, form);
      else await createTrailer(form);
      toast.success(editId ? "Trailer updated" : "Trailer added");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(apiMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Delete trailer ${t.regNumber}?`)) return;
    try {
      await deleteTrailer(t._id);
      toast.success("Trailer deleted");
      load();
    } catch (e) {
      toast.error(apiMessage(e));
    }
  };

  return (
    <Box m="1.5rem 2.5rem">
      <FlexBetween>
        <Header title="TRAILERS" subtitle="Trailers are tracked separately from trucks, so you can pair any trailer with any horse on a trip." />
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={openNew}
          sx={{ backgroundColor: theme.palette.secondary.light, color: theme.palette.background.alt, fontWeight: "bold" }}
        >
          Add trailer
        </Button>
      </FlexBetween>

      <Box mt="1.5rem" sx={{ overflowX: "auto", backgroundColor: theme.palette.background.alt, borderRadius: "0.55rem" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {["Registration", "Type", "Axles", "Capacity (t)", "Status", "Notes", ""].map((h) => (
                <TableCell key={h} sx={{ fontWeight: "bold" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t._id} hover sx={{ opacity: t.active ? 1 : 0.55 }}>
                <TableCell>{t.regNumber}</TableCell>
                <TableCell>{t.type}</TableCell>
                <TableCell>{t.axles ?? ""}</TableCell>
                <TableCell>{t.capacityTons ?? ""}</TableCell>
                <TableCell>{t.active ? "Active" : "Inactive"}</TableCell>
                <TableCell>{t.notes}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <IconButton size="small" onClick={() => openEdit(t)} aria-label="Edit"><EditOutlined fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => remove(t)} aria-label="Delete"><DeleteOutline fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={7} align="center">{loading ? "Loading..." : "No trailers yet. Add your first one."}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editId ? "Edit trailer" : "Add trailer"}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: "1rem", pt: "1rem !important" }}>
          <TextField size="small" label="Registration number" value={form.regNumber} onChange={set("regNumber")} />
          <FormControl size="small">
            <InputLabel>Type</InputLabel>
            <Select label="Type" value={form.type} onChange={set("type")}>
              {types.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" type="number" label="Axles" value={form.axles} onChange={set("axles")} inputProps={{ min: 1, max: 12 }} />
          <TextField size="small" type="number" label="Capacity (tonnes)" value={form.capacityTons} onChange={set("capacityTons")} inputProps={{ min: 0 }} />
          <TextField size="small" label="Notes" value={form.notes} onChange={set("notes")} multiline minRows={2} />
          <FormControlLabel
            control={<Checkbox checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />}
            label="Active (untick to hide it from new trips without deleting it)"
          />
          <Typography variant="body2" sx={{ opacity: 0.7 }}>Licences and permits for this trailer are tracked on the Documents page.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving || !form.regNumber.trim()}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TrailersPage;

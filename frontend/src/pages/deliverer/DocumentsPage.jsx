import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
  useTheme,
} from "@mui/material";
import { Add, DeleteOutline, EditOutlined } from "@mui/icons-material";
import { toast } from "react-hot-toast";
import FlexBetween from "component/deliverer/FlexBetween";
import Header from "component/deliverer/Header";
import { DOC_LABELS, apiMessage, createDoc, deleteDoc, fetchDocMeta, fetchDocs, updateDoc } from "utils/tripApi";

const OWNER_LABELS = { vehicle: "Truck", trailer: "Trailer", driver: "Driver" };
const emptyForm = { ownerType: "vehicle", ownerId: "", docType: "yellow_card", number: "", issuedAt: "", expiresAt: "", notes: "" };
const dateOnly = (v) => (v ? String(v).slice(0, 10) : "");

const statusChip = (d) => {
  if (d.status === "expired") return <Chip size="small" color="error" label={`Expired ${Math.abs(d.daysLeft)} day(s) ago`} />;
  if (d.status === "due_soon") return <Chip size="small" color="warning" label={d.daysLeft === 0 ? "Expires today" : `${d.daysLeft} day(s) left`} />;
  return <Chip size="small" color="success" variant="outlined" label="OK" />;
};

const DocumentsPage = () => {
  const theme = useTheme();
  const [meta, setMeta] = useState({ vehicles: [], trailers: [], drivers: [] });
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDocs(status ? { status } : {});
      setRows(data.docs);
    } catch (e) {
      toast.error(apiMessage(e));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchDocMeta().then(setMeta).catch((e) => toast.error(apiMessage(e)));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const owners = form.ownerType === "vehicle" ? meta.vehicles : form.ownerType === "trailer" ? meta.trailers : meta.drivers;
  const ownerLabel = (o) => (form.ownerType === "driver" ? o.name : `${o.make || ""} ${o.regNumber || ""}`.trim());

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const openNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (d) => {
    setEditId(d._id);
    setForm({ ...emptyForm, ...d, issuedAt: dateOnly(d.issuedAt), expiresAt: dateOnly(d.expiresAt) });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editId) await updateDoc(editId, form);
      else await createDoc(form);
      toast.success(editId ? "Document updated" : "Document added");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(apiMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (d) => {
    if (!window.confirm(`Delete this ${DOC_LABELS[d.docType] || d.docType} for ${d.ownerName}?`)) return;
    try {
      await deleteDoc(d._id);
      toast.success("Document deleted");
      load();
    } catch (e) {
      toast.error(apiMessage(e));
    }
  };

  const expired = rows.filter((d) => d.status === "expired").length;
  const dueSoon = rows.filter((d) => d.status === "due_soon").length;

  return (
    <Box m={{ xs: "1rem 0.75rem", sm: "1.25rem 1.5rem", md: "1.5rem 2.5rem" }}>
      <FlexBetween>
        <Header title="DOCUMENTS" subtitle="Yellow Cards, licences, permits and other papers that expire, for trucks, trailers and drivers." />
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={openNew}
          sx={{ backgroundColor: theme.palette.secondary.light, color: theme.palette.background.alt, fontWeight: "bold" }}
        >
          Add document
        </Button>
      </FlexBetween>

      {!status && (expired > 0 || dueSoon > 0) && (
        <Alert severity={expired > 0 ? "error" : "warning"} sx={{ mt: "1.5rem" }}>
          {expired > 0 && `${expired} document(s) have expired. `}
          {dueSoon > 0 && `${dueSoon} expire within 30 days.`}
        </Alert>
      )}

      <Box mt="1.5rem" display="flex" gap="1rem">
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Show</InputLabel>
          <Select label="Show" value={status} onChange={(e) => setStatus(e.target.value)}>
            <MenuItem value="">Everything</MenuItem>
            <MenuItem value="expired">Expired</MenuItem>
            <MenuItem value="due_soon">Expiring soon</MenuItem>
            <MenuItem value="ok">OK</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box mt="1rem" sx={{ overflowX: "auto", backgroundColor: theme.palette.background.alt, borderRadius: "0.55rem" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {["Belongs to", "Document", "Number", "Issued", "Expires", "Status", ""].map((h) => (
                <TableCell key={h} sx={{ fontWeight: "bold" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d._id} hover>
                <TableCell>{OWNER_LABELS[d.ownerType]}: {d.ownerName}</TableCell>
                <TableCell>{DOC_LABELS[d.docType] || d.docType}</TableCell>
                <TableCell>{d.number}</TableCell>
                <TableCell>{dateOnly(d.issuedAt)}</TableCell>
                <TableCell>{dateOnly(d.expiresAt)}</TableCell>
                <TableCell>{statusChip(d)}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  <IconButton size="small" onClick={() => openEdit(d)} aria-label="Edit"><EditOutlined fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => remove(d)} aria-label="Delete"><DeleteOutline fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={7} align="center">{loading ? "Loading..." : "No documents yet. Add a Yellow Card or licence to get expiry reminders."}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editId ? "Edit document" : "Add document"}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: "1rem", pt: "1rem !important" }}>
          <FormControl size="small">
            <InputLabel>Belongs to</InputLabel>
            <Select label="Belongs to" value={form.ownerType} disabled={!!editId}
              onChange={(e) => setForm({ ...form, ownerType: e.target.value, ownerId: "" })}>
              {Object.entries(OWNER_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>{OWNER_LABELS[form.ownerType]}</InputLabel>
            <Select label={OWNER_LABELS[form.ownerType]} value={form.ownerId} disabled={!!editId} onChange={set("ownerId")}>
              {owners.map((o) => <MenuItem key={o._id} value={o._id}>{ownerLabel(o)}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Document</InputLabel>
            <Select label="Document" value={form.docType} onChange={set("docType")}>
              {Object.entries(DOC_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Number" value={form.number} onChange={set("number")} />
          <TextField size="small" type="date" label="Issued" InputLabelProps={{ shrink: true }} value={form.issuedAt} onChange={set("issuedAt")} />
          <TextField size="small" type="date" label="Expires" InputLabelProps={{ shrink: true }} value={form.expiresAt} onChange={set("expiresAt")} />
          <TextField size="small" label="Notes" value={form.notes} onChange={set("notes")} multiline minRows={2} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving || !form.ownerId || !form.expiresAt}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DocumentsPage;

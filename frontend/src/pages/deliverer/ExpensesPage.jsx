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
import {
  CATEGORY_LABELS,
  apiMessage,
  createExpense,
  deleteExpense,
  fetchExpenses,
  fetchMeta,
  money,
  updateExpense,
} from "utils/expenseApi";

const emptyForm = {
  type: "expense",
  category: "fuel",
  date: new Date().toISOString().slice(0, 10),
  amount: "",
  description: "",
  vehicleId: "",
  payee: "",
  litres: "",
  retainedInBusiness: false,
  isEstimate: false,
  notes: "",
};

const ExpensesPage = () => {
  const theme = useTheme();
  const [meta, setMeta] = useState({ expenseCategories: [], incomeCategories: [], vehicles: [] });
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ from: "2026-01-01", to: "", category: "", vehicleId: "" });
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { pageSize: 500 };
      Object.entries(filters).forEach(([k, v]) => v && (params[k] = v));
      const data = await fetchExpenses(params);
      setRows(data.expenses);
      setTotal(data.total);
    } catch (e) {
      toast.error(apiMessage(e));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchMeta().then(setMeta).catch((e) => toast.error(apiMessage(e)));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const vehicleName = (id) => {
    const v = meta.vehicles.find((x) => x._id === id);
    return v ? `${v.make || ""} ${v.regNumber || ""}`.trim() : "";
  };

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (r) => {
    setEditId(r._id);
    setForm({
      ...emptyForm,
      ...r,
      date: String(r.date).slice(0, 10),
      vehicleId: r.vehicleId || "",
      litres: r.litres ?? "",
    });
    setOpen(true);
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const categories = form.type === "income" ? meta.incomeCategories : meta.expenseCategories;

  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form };
      if (editId) await updateExpense(editId, body);
      else await createExpense(body);
      toast.success(editId ? "Entry updated" : "Entry added");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(apiMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r) => {
    if (!window.confirm(`Delete this ${CATEGORY_LABELS[r.category] || r.category} entry of ${money(r.amount)}?`)) return;
    try {
      await deleteExpense(r._id);
      toast.success("Entry deleted");
      load();
    } catch (e) {
      toast.error(apiMessage(e));
    }
  };

  const shown = rows.reduce(
    (t, r) => {
      if (r.type === "income") t.income += r.amount;
      else if (r.countsInProfit) t.expense += r.amount;
      else t.private += r.amount;
      return t;
    },
    { income: 0, expense: 0, private: 0 }
  );

  return (
    <Box m={{ xs: "1rem 0.75rem", sm: "1.25rem 1.5rem", md: "1.5rem 2.5rem" }}>
      <FlexBetween>
        <Header title="EXPENSES" subtitle="Fuel, salaries, insurance, services and other costs. Extra income (cash hires) too." />
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={openNew}
          sx={{ backgroundColor: theme.palette.secondary.light, color: theme.palette.background.alt, fontWeight: "bold" }}
        >
          Add entry
        </Button>
      </FlexBetween>

      <Box mt="1.5rem" display="flex" gap="1rem" flexWrap="wrap">
        <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }}
          value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }}
          value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Category</InputLabel>
          <Select label="Category" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <MenuItem value="">All</MenuItem>
            {[...meta.expenseCategories, ...meta.incomeCategories].map((c) => (
              <MenuItem key={c} value={c}>{CATEGORY_LABELS[c] || c}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Vehicle</InputLabel>
          <Select label="Vehicle" value={filters.vehicleId} onChange={(e) => setFilters({ ...filters, vehicleId: e.target.value })}>
            <MenuItem value="">All</MenuItem>
            {meta.vehicles.map((v) => (
              <MenuItem key={v._id} value={v._id}>{`${v.make || ""} ${v.regNumber || ""}`.trim()}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Typography mt="1rem" color={theme.palette.secondary[200]}>
        {total} entries shown. Costs in profit: <b>{money(shown.expense)}</b> | Extra income: <b>{money(shown.income)}</b> | Private fuel (not in profit): <b>{money(shown.private)}</b>
      </Typography>

      <Box mt="1rem" sx={{ overflowX: "auto", backgroundColor: theme.palette.background.alt, borderRadius: "0.55rem" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {["Date", "Category", "Description", "Vehicle / Payee", "Litres", "Amount", ""].map((h) => (
                <TableCell key={h} sx={{ fontWeight: "bold" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r._id} hover sx={{ opacity: r.countsInProfit || r.type === "income" ? 1 : 0.65 }}>
                <TableCell>{String(r.date).slice(0, 10)}</TableCell>
                <TableCell>
                  {CATEGORY_LABELS[r.category] || r.category}
                  {r.isEstimate ? " (est.)" : ""}
                  {r.retainedInBusiness ? " (left in business)" : ""}
                </TableCell>
                <TableCell>{r.description}</TableCell>
                <TableCell>{vehicleName(r.vehicleId) || r.payee}</TableCell>
                <TableCell>{r.litres ? Number(r.litres).toFixed(1) : ""}</TableCell>
                <TableCell>{r.type === "income" ? "+" : ""}{money(r.amount)}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(r)} aria-label="Edit"><EditOutlined fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={() => remove(r)} aria-label="Delete"><DeleteOutline fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={7} align="center">{loading ? "Loading..." : "No entries for these filters."}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editId ? "Edit entry" : "Add entry"}</DialogTitle>
        <DialogContent sx={{ display: "grid", gap: "1rem", pt: "1rem !important" }}>
          <FormControl size="small">
            <InputLabel>Type</InputLabel>
            <Select label="Type" value={form.type} disabled={!!editId}
              onChange={(e) => setForm({ ...form, type: e.target.value, category: e.target.value === "income" ? "cash_hire" : "fuel" })}>
              <MenuItem value="expense">Expense</MenuItem>
              <MenuItem value="income">Extra income (cash hire etc.)</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Category</InputLabel>
            <Select label="Category" value={form.category} onChange={set("category")}>
              {categories.map((c) => <MenuItem key={c} value={c}>{CATEGORY_LABELS[c] || c}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" type="date" label="Date" InputLabelProps={{ shrink: true }} value={form.date} onChange={set("date")} />
          <TextField size="small" type="number" label="Amount ($)" value={form.amount} onChange={set("amount")} inputProps={{ min: 0, step: "0.01" }} />
          <TextField size="small" label="Description" value={form.description} onChange={set("description")} />
          <FormControl size="small">
            <InputLabel>Vehicle (optional)</InputLabel>
            <Select label="Vehicle (optional)" value={form.vehicleId} onChange={set("vehicleId")}>
              <MenuItem value="">None (whole business)</MenuItem>
              {meta.vehicles.map((v) => <MenuItem key={v._id} value={v._id}>{`${v.make || ""} ${v.regNumber || ""}`.trim()}</MenuItem>)}
            </Select>
          </FormControl>
          {form.category.includes("salary") && (
            <>
              <TextField size="small" label="Paid to" value={form.payee} onChange={set("payee")} />
              <FormControlLabel
                control={<Checkbox checked={!!form.retainedInBusiness} onChange={(e) => setForm({ ...form, retainedInBusiness: e.target.checked })} />}
                label="Left in the business (a cost, but not cash taken out)"
              />
            </>
          )}
          {form.category.includes("fuel") && (
            <TextField size="small" type="number" label="Litres" value={form.litres} onChange={set("litres")} inputProps={{ min: 0, step: "0.1" }} />
          )}
          <TextField size="small" label="Notes" value={form.notes} onChange={set("notes")} multiline minRows={2} />
          {form.category === "private_fuel" && (
            <Typography variant="body2">Private fuel is recorded for information only. It is never counted in profit.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving || form.amount === ""}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExpensesPage;

import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography, useTheme,
} from "@mui/material";
import { useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import Header from "component/deliverer/Header";
import { server } from "server";
import { downloadCompanyExport } from "utils/downloadExport";

const opts = { withCredentials: true };
const PLATFORM_ROLES = ["Super Admin", "Site Admin"];
const BANDS = [
  { value: "starter", label: "Starter, 1-2 trucks" },
  { value: "fleet", label: "Fleet, 3-10 trucks" },
  { value: "pro", label: "Pro, 11-25 trucks" },
];
const STATUSES = ["trial", "active", "suspended", "cancelled"];
const STATE_LABEL = { legacy: "Existing", trial: "Trial", active: "Paying", read_only: "Read-only", suspended: "Suspended", cancelled: "Cancelled" };
const STATE_COLOR = { legacy: "default", trial: "info", active: "success", read_only: "warning", suspended: "error", cancelled: "default" };
const day = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");
const isoDay = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const message = (error) => error.response?.data?.message || "That did not work. Try again.";

const Tile = ({ label, value, hint }) => (
  <Box sx={{ flex: "1 1 150px", minWidth: 150 }}>
    <Typography variant="body2" sx={{ opacity: 0.7 }}>{label}</Typography>
    <Typography variant="h4" fontWeight="bold">{value}</Typography>
    {hint ? <Typography variant="caption" sx={{ opacity: 0.6 }}>{hint}</Typography> : null}
  </Box>
);

// One company: quick actions, the plan form, deletion, and what was changed before.
const ManageDialog = ({ row, onClose, onChanged }) => {
  const legacy = row.billing.state === "legacy";
  const [band, setBand] = useState(row.billing.band || "starter");
  const [status, setStatus] = useState(legacy ? "" : row.billing.state === "read_only" ? "trial" : row.billing.state);
  const [paidUntil, setPaidUntil] = useState(isoDay(row.billing.paidUntil));
  const [note, setNote] = useState(row.note || "");
  const [busy, setBusy] = useState(false);
  const [trail, setTrail] = useState([]);

  useEffect(() => {
    axios
      .get(`${server}/admin/companies/${row.id}/audit`, opts)
      .then(({ data }) => setTrail(data.entries))
      .catch(() => setTrail([]));
  }, [row.id, row.billing.state, row.deletion.pending, row.billing.paidUntil]);

  const run = async (fn, done) => {
    setBusy(true);
    try {
      await fn();
      if (done) toast.success(done);
      await onChanged();
    } catch (error) {
      toast.error(message(error));
    } finally {
      setBusy(false);
    }
  };
  const put = (body) => axios.put(`${server}/tenant/billing`, { companyId: row.id, ...body }, opts);

  const save = () => run(() => put({ band, status: status || undefined, paidUntil: paidUntil || null, note }), "Saved");
  const markPaid = (n) => {
    const current = row.billing.paidUntil && new Date(row.billing.paidUntil) > new Date() ? new Date(row.billing.paidUntil) : new Date();
    const until = new Date(current.getTime() + n * 86400000);
    setStatus("active");
    setPaidUntil(isoDay(until));
    return run(() => put({ band, status: "active", paidUntil: until.toISOString() }), `Paid until ${day(until)}`);
  };
  const scheduleDeletion = () => {
    const ok = window.confirm(`Schedule ${row.name} and all its data for deletion in 30 days? They can still cancel until then.`);
    if (ok) run(() => axios.post(`${server}/admin/companies/${row.id}/deletion`, {}, opts), "Deletion scheduled");
  };

  return (
    <Dialog open onClose={() => !busy && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>{row.name}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ opacity: 0.7, mb: 2 }}>
          {row.ownerEmail || "No owner email"} · {row.vehicles} trucks · {row.users} users · created {day(row.createdAt)}
          {legacy ? " · existing customer: no limits until you give a plan" : ""}
        </Typography>

        <Typography fontWeight="bold" sx={{ mb: 1 }}>Quick actions</Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 3 }}>
          <Button size="small" variant="outlined" disabled={busy} onClick={() => markPaid(30)}>Mark paid, +30 days</Button>
          <Button size="small" variant="outlined" disabled={busy} onClick={() => run(() => put({ extendTrialDays: 14 }), "Trial extended 14 days")}>Extend trial 14 days</Button>
          {row.billing.state === "suspended" ? (
            <Button size="small" variant="outlined" disabled={busy} onClick={() => run(() => put({ status: row.billing.paidUntil ? "active" : "trial" }), "Restored")}>Restore</Button>
          ) : (
            <Button size="small" variant="outlined" color="error" disabled={busy} onClick={() => run(() => put({ status: "suspended" }), "Suspended")}>Suspend</Button>
          )}
          <Button size="small" variant="outlined" disabled={busy} onClick={() => run(() => downloadCompanyExport(row.id), "Download started")}>Download their data</Button>
        </Box>

        <Typography fontWeight="bold" sx={{ mb: 1 }}>Plan</Typography>
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, mb: 2 }}>
          <TextField select size="small" label="Band" value={band} onChange={(e) => setBand(e.target.value)}>
            {BANDS.map((b) => <MenuItem key={b.value} value={b.value}>{b.label}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {legacy ? <MenuItem value="">Leave as existing</MenuItem> : null}
            {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
          <TextField size="small" type="date" label="Paid until" InputLabelProps={{ shrink: true }} value={paidUntil} onChange={(e) => setPaidUntil(e.target.value)} />
          <TextField size="small" label="Note (EcoCash reference, why)" value={note} onChange={(e) => setNote(e.target.value)} inputProps={{ maxLength: 500 }} />
        </Box>
        <Button variant="contained" disabled={busy} onClick={save}>Save plan</Button>

        <Typography fontWeight="bold" sx={{ mt: 4, mb: 1 }}>Deletion</Typography>
        {row.deletion.pending ? (
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Scheduled for {day(row.deletion.scheduledFor)} ({row.deletion.daysLeft} days left).
            </Typography>
            <Button size="small" variant="outlined" disabled={busy} onClick={() => run(() => axios.delete(`${server}/admin/companies/${row.id}/deletion`, opts), "Deletion cancelled")}>
              Cancel deletion
            </Button>
          </Box>
        ) : (
          <Button size="small" variant="outlined" color="error" disabled={busy} onClick={scheduleDeletion}>Schedule deletion</Button>
        )}

        <Typography fontWeight="bold" sx={{ mt: 4, mb: 1 }}>History</Typography>
        {trail.length === 0 ? (
          <Typography variant="body2" sx={{ opacity: 0.7 }}>No changes recorded yet.</Typography>
        ) : (
          trail.slice(0, 8).map((e, i) => (
            <Typography key={i} variant="body2" sx={{ py: 0.25 }}>
              {day(e.at)} · {e.action.replace(".", " ")} · {e.by}
              {e.after && e.after.status ? ` · ${e.after.band || ""} ${e.after.status}` : ""}
            </Typography>
          ))
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

const AdminConsolePage = () => {
  const theme = useTheme();
  const { user } = useSelector((s) => s.user);
  const allowed = Boolean(user && PLATFORM_ROLES.includes(user.role));
  const [rows, setRows] = useState(null);
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([axios.get(`${server}/admin/companies`, opts), axios.get(`${server}/admin/summary`, opts)]);
      setRows(c.data.companies);
      setSummary(s.data.summary);
      setFailed(false);
    } catch (error) {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  const shown = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => `${r.name} ${r.ownerEmail || ""} ${r.city || ""}`.toLowerCase().includes(q)) : rows;
  }, [rows, search]);
  const open = rows && rows.find((r) => r.id === openId);

  if (!allowed) {
    return (
      <Box m="2rem">
        <Typography>This page is for platform admins.</Typography>
      </Box>
    );
  }

  return (
    <Box m={{ xs: "1rem 0.75rem", sm: "1.25rem 1.5rem", md: "1.5rem 2.5rem" }}>
      <Header title="ADMIN CONSOLE" subtitle="Every company on myfleet: plan, payment, usage and deletion. Changes are recorded." />

      {failed && (
        <Typography mt="2rem">
          Could not load companies.{" "}
          <span role="button" tabIndex={0} style={{ textDecoration: "underline", cursor: "pointer" }} onClick={load} onKeyDown={(e) => e.key === "Enter" && load()}>
            Try again
          </span>
        </Typography>
      )}

      {summary && (
        <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mt: 3, pb: 3, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Tile label="Companies" value={summary.companies} />
          <Tile label="Paying" value={summary.byState.active || 0} hint={`$${summary.monthlyUsd} a month at list price`} />
          <Tile label="On trial" value={summary.byState.trial || 0} hint={`${summary.trialsEndingWithin7Days} ending within 7 days`} />
          <Tile label="Read-only or suspended" value={(summary.byState.read_only || 0) + (summary.byState.suspended || 0)} />
          <Tile label="AI pages this month" value={summary.aiPagesThisMonth} hint={`${summary.aiCallsThisMonth} calls`} />
          <Tile label="Pending deletion" value={summary.pendingDeletion} />
        </Box>
      )}

      <Box sx={{ mt: 3, mb: 2, maxWidth: 360 }}>
        <TextField fullWidth size="small" label="Search company, owner or city" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Box>

      {rows && (
        <TableContainer>
          <Table size="small" aria-label="Companies">
            <TableHead>
              <TableRow>
                <TableCell>Company</TableCell>
                <TableCell>Plan</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Until</TableCell>
                <TableCell align="right">Trucks</TableCell>
                <TableCell align="right">Users</TableCell>
                <TableCell align="right">AI pages</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Typography fontWeight="bold">{r.name}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>{r.ownerEmail || "no owner"}</Typography>
                  </TableCell>
                  <TableCell>{r.billing.bandLabel ? `${r.billing.bandLabel}, $${r.billing.priceUsd}` : "No limits"}</TableCell>
                  <TableCell>
                    <Chip size="small" color={STATE_COLOR[r.billing.state]} label={STATE_LABEL[r.billing.state] || r.billing.state} />
                    {r.deletion.pending ? <Chip size="small" color="error" variant="outlined" label={`Deleting in ${r.deletion.daysLeft}d`} sx={{ ml: 0.5 }} /> : null}
                  </TableCell>
                  <TableCell>{r.billing.state === "trial" ? `${r.billing.daysLeft} days left` : r.billing.paidUntil ? day(r.billing.paidUntil) : ""}</TableCell>
                  <TableCell align="right">{r.vehicles}</TableCell>
                  <TableCell align="right">{r.users}</TableCell>
                  <TableCell align="right">{r.aiPagesThisMonth}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => setOpenId(r.id)}>Manage</Button>
                  </TableCell>
                </TableRow>
              ))}
              {shown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography sx={{ py: 3, textAlign: "center", opacity: 0.7 }}>No companies match.</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {!rows && !failed && <Typography mt="2rem">Loading…</Typography>}

      {open && <ManageDialog key={open.id} row={open} onClose={() => setOpenId(null)} onChanged={load} />}
    </Box>
  );
};

export default AdminConsolePage;

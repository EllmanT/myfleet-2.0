import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography, useTheme } from "@mui/material";
import { toast } from "react-hot-toast";
import { server } from "server";

const opts = { withCredentials: true };

// "Delete this company and all its data": a request with a cooling-off period, not an instant delete.
const DeleteCompanySection = ({ onExport }) => {
  const theme = useTheme();
  const [status, setStatus] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${server}/tenant/me`, opts);
      setCompanyName(data.companyName || "");
      setStatus(data.deletion || { pending: false });
    } catch (error) {
      setStatus(null);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const fail = (error) => toast.error(error.response?.data?.message || "That did not work. Try again.");

  const request = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${server}/tenant/deletion`, { confirmName: typed }, opts);
      setStatus(data.deletion);
      setOpen(false);
      setTyped("");
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await axios.delete(`${server}/tenant/deletion`, opts);
      setStatus({ pending: false });
      toast.success("Deletion cancelled. Nothing was removed.");
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;
  const date = status.pending ? new Date(status.scheduledFor).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <Box mt="3rem" maxWidth="720px" pt="1.5rem" borderTop={`1px solid ${theme.palette.divider}`}>
      <Typography fontWeight="bold">Delete this company</Typography>
      {status.pending ? (
        <>
          <Typography variant="body2" sx={{ mt: 0.5, mb: 1.5 }} role="status">
            This company and all its data will be deleted on <strong>{date}</strong> ({status.daysLeft}{" "}
            {status.daysLeft === 1 ? "day" : "days"} left). Until then everything works as normal.
            Download your data now if you want to keep it.
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button variant="contained" onClick={cancel} disabled={busy}>
              Keep my company
            </Button>
            <Button variant="outlined" onClick={onExport}>
              Download my data
            </Button>
          </Box>
        </>
      ) : (
        <>
          <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.5, mb: 1.5 }}>
            Permanently removes every job, customer, vehicle, driver, invoice, uploaded document and
            user login. It is not instant: you get 30 days to change your mind, and you can download
            everything first. Keep your own copy of your financial records; tax law requires you to
            hold them.
          </Typography>
          <Button variant="outlined" color="error" onClick={() => setOpen(true)}>
            Delete company…
          </Button>
        </>
      )}

      <Dialog open={open} onClose={() => !busy && setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Delete {companyName}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            After 30 days, all of this company's data is permanently deleted and nobody can sign in.
            Until then you can cancel here. Type the company name to confirm.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Company name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            helperText={companyName}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={request} disabled={busy || !typed.trim()}>
            Delete in 30 days
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DeleteCompanySection;

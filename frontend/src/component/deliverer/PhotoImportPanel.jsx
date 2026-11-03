import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  Alert, Box, Button, CircularProgress, FormControl, IconButton, InputLabel, MenuItem, Select, Table,
  TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography, useTheme,
} from "@mui/material";
import { DeleteOutline, PhotoCameraOutlined } from "@mui/icons-material";
import { toast } from "react-hot-toast";
import { server } from "server";
import ExcelImportPanel from "component/deliverer/ExcelImportPanel";

const FIELDS = [
  ["driver", "Driver", 90], ["date", "Date", 140], ["timeOut", "Out", 80], ["mileageOut", "Mileage out", 110],
  ["from", "From", 130], ["to", "To", 130], ["mileageIn", "Mileage in", 110], ["timeIn", "In", 80],
  ["totalKm", "Km", 80], ["contractor", "For", 110],
];
const NUMERIC = new Set(["mileageOut", "mileageIn", "totalKm"]);
const emptyRow = () => ({ id: Math.random(), driver: "", date: "", timeOut: "", mileageOut: "", from: "", to: "", mileageIn: "", timeIn: "", totalKm: "", contractor: "", notes: "", flags: [] });
const msg = (e) => e?.response?.data?.message || e.message || "Something went wrong";

// Photo or PDF of a logbook -> reviewable rows -> the normal Excel import steps.
const PhotoImportPanel = ({ customers, onImported }) => {
  const theme = useTheme();
  const inputRef = useRef(null);
  const now = new Date();
  const [stage, setStage] = useState("pick"); // pick | reading | review | import
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [vehicleReg, setVehicleReg] = useState("");
  const [vehicleDescription, setVehicleDescription] = useState("");
  const [rows, setRows] = useState([]);
  const [progress, setProgress] = useState("");
  const [allowance, setAllowance] = useState(null);
  const [injected, setInjected] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    axios.get(`${server}/ai-import/usage`, { withCredentials: true }).then((r) => setAllowance(r.data)).catch(() => {});
  }, [stage]);

  const readFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setStage("reading");
    let all = rows;
    let reg = vehicleReg;
    try {
      for (const [i, file] of files.entries()) {
        setProgress(`Reading page ${i + 1} of ${files.length}...`);
        const form = new FormData();
        form.append("file", file);
        form.append("year", year);
        form.append("month", month);
        if (reg) form.append("vehicleReg", reg);
        const { data } = await axios.post(`${server}/ai-import/extract`, form, { withCredentials: true });
        if (!reg && data.vehicleReg) { reg = data.vehicleReg; setVehicleReg(reg); }
        if (data.vehicleDescription && !vehicleDescription) setVehicleDescription(data.vehicleDescription);
        all = [...all, ...data.rows.map((r) => ({ ...r, id: Math.random() }))];
        setAllowance(data.allowance);
      }
      setRows(all);
      setStage("review");
    } catch (e) {
      toast.error(msg(e));
      setRows(all);
      setStage(all.length ? "review" : "pick");
    }
  };

  const edit = (id, field, value) =>
    setRows((rs) => rs.map((r) => (r.id !== id ? r : {
      ...r,
      [field]: NUMERIC.has(field) ? (value === "" ? "" : Number(value)) : value,
      // once you've looked at a cell, the "check this" mark on it goes away
      flags: r.flags.filter((f) => f.field !== field),
    })));

  const flagged = rows.reduce((n, r) => n + r.flags.length, 0);

  const continueToMatching = async () => {
    setBusy(true);
    try {
      const res = await axios.post(`${server}/ai-import/workbook`, { vehicleReg, vehicleDescription, rows }, { withCredentials: true, responseType: "blob" });
      const file = new File([res.data], `photo-log-${vehicleReg.replace(/\s/g, "")}.xlsx`, { type: res.data.type });
      setInjected(file);
      setStage("import");
    } catch (e) {
      // error bodies arrive as blobs here; read the message out of it
      let text = msg(e);
      try { text = JSON.parse(await e.response.data.text()).message; } catch (_) { /* keep generic */ }
      toast.error(text);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setRows([]); setInjected(null); setStage("pick"); };

  if (stage === "import") {
    return (
      <Box>
        <Button onClick={() => setStage("review")} sx={{ mb: "0.5rem" }}>Back to the rows</Button>
        <ExcelImportPanel customers={customers} injectedFile={injected} onImported={(r) => { onImported?.(r); }} />
      </Box>
    );
  }

  if (stage === "reading") {
    return (
      <Box display="flex" alignItems="center" gap="1rem" mt="2rem" justifyContent="center">
        <CircularProgress size={22} />
        <Typography>{progress} This takes about 20 seconds.</Typography>
      </Box>
    );
  }

  if (stage === "review") {
    return (
      <Box mt="0.5rem">
        <Box display="flex" gap="1rem" flexWrap="wrap" alignItems="center" mb="1rem">
          <TextField size="small" label="Vehicle registration" value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value)} />
          <TextField size="small" label="Vehicle" value={vehicleDescription} onChange={(e) => setVehicleDescription(e.target.value)} />
          <Button onClick={() => inputRef.current?.click()}>Add another page</Button>
          <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={(e) => { readFiles(e.target.files); e.target.value = ""; }} />
        </Box>
        <Alert severity={flagged ? "warning" : "success"} sx={{ mb: "1rem" }}>
          {flagged
            ? `${flagged} thing(s) to check. Yellow means hard to read or missing. Orange means the numbers don't add up. Hover for the reason, and compare with the paper.`
            : "Nothing flagged. It's still worth a quick look against the paper before importing."}
        </Alert>
        <Box sx={{ overflowX: "auto", backgroundColor: theme.palette.background.alt, borderRadius: "0.55rem" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                {FIELDS.map(([k, label]) => <TableCell key={k} sx={{ fontWeight: "bold" }}>{label}</TableCell>)}
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell>{i + 1}</TableCell>
                  {FIELDS.map(([k, label, w]) => {
                    const f = r.flags.find((x) => x.field === k);
                    const bg = f ? (f.type === "doesnt_add_up" ? "rgba(255,152,0,0.28)" : "rgba(255,235,59,0.35)") : undefined;
                    return (
                      <TableCell key={k} sx={{ p: "2px" }}>
                        <Tooltip title={f ? f.reason : ""} arrow placement="top">
                          <TextField
                            size="small" value={r[k] ?? ""} onChange={(e) => edit(r.id, k, e.target.value)}
                            type={NUMERIC.has(k) ? "number" : "text"}
                            sx={{ width: w, "& .MuiInputBase-root": { backgroundColor: bg } }}
                            inputProps={{ "aria-label": `${label}, row ${i + 1}`, style: { padding: "6px 8px" } }}
                          />
                        </Tooltip>
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <IconButton size="small" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))} aria-label={`Remove row ${i + 1}`}><DeleteOutline fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Box display="flex" gap="0.5rem" mt="1rem">
          <Button onClick={() => setRows([...rows, emptyRow()])}>+ Add a row</Button>
          <Box flex={1} />
          <Button onClick={reset}>Start over</Button>
          <Button variant="contained" onClick={continueToMatching} disabled={busy || !rows.length || !vehicleReg}>
            {busy ? "Preparing..." : "Looks right, continue"}
          </Button>
        </Box>
      </Box>
    );
  }

  // pick
  return (
    <Box maxWidth="760px" mx="auto" mt="1rem">
      <Typography variant="h5" fontWeight="bold" mb="0.5rem">Import from a photo</Typography>
      <Typography mb="1rem" sx={{ opacity: 0.8 }}>
        Take a clear, flat photo of the logbook page (or upload a PDF). The app reads it into rows for you to check. Nothing is saved until you approve it.
      </Typography>
      <Box display="flex" gap="1rem" flexWrap="wrap" mb="1rem">
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Month</InputLabel>
          <Select label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>
            {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField size="small" type="number" label="Year" value={year} onChange={(e) => setYear(e.target.value)} sx={{ width: 110 }} />
        <TextField size="small" label="Vehicle reg (optional)" value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value)} />
      </Box>
      <Button variant="contained" startIcon={<PhotoCameraOutlined />} onClick={() => inputRef.current?.click()}>Choose photo or PDF</Button>
      <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={(e) => { readFiles(e.target.files); e.target.value = ""; }} />
      {allowance && (
        <Typography mt="1rem" variant="body2" sx={{ opacity: 0.7 }}>
          {allowance.remaining} of {allowance.limit} pages of photo reading left this month.
        </Typography>
      )}
    </Box>
  );
};

export default PhotoImportPanel;

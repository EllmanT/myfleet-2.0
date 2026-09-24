import React, { useCallback, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import {
  Alert,
  Autocomplete,
  TextField,
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from "@mui/material";
import {
  CheckCircleOutline,
  DescriptionOutlined,
  ExpandLess,
  ExpandMore,
  UploadFileOutlined,
} from "@mui/icons-material";
import { server } from "server";

const KIND_LABEL = {
  vehicle: "Vehicle",
  driver: "Driver",
  contractor: "Contractor",
  customer: "Place",
};

const STATUS_CHIP = {
  suggested: { label: "Close match", color: "warning" },
  new: { label: "New customer", color: "info" },
  unresolved: { label: "Choose one", color: "error" },
  chosen: { label: "Your choice", color: "success" },
  auto: { label: "Matched", color: "default" },
};

const LEG_STATUS_LABEL = {
  skipped: "Skipped",
  duplicate: "Already imported",
  error: "Problem",
  blocked: "Needs a match",
};

const money = (value) =>
  `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (iso) =>
  iso
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        timeZone: "UTC",
      })
    : "";

function buildForm(files, choices, options) {
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  form.append("choices", JSON.stringify(choices));
  form.append("options", JSON.stringify(options));
  return form;
}

const errorMessage = (error) =>
  error?.response?.data?.message || error?.message || "Something went wrong";

// Place matches: the server's suggestions first, then every customer, so
// any sheet spelling can be pointed at any existing customer.
const PlaceField = ({ decision, customers, disabled, onChange }) => {
  const options = useMemo(() => {
    const suggested = decision.options.map((o) => ({ ...o, group: "Suggested" }));
    const seen = new Set(suggested.map((o) => o.value));
    const rest = customers
      .filter((c) => c?._id && !seen.has(c._id))
      .map((c) => ({ value: c._id, label: c.name, group: "All customers" }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [...suggested, ...rest];
  }, [decision.options, customers]);

  const selected = options.find((o) => o.value === decision.value) || null;
  return (
    <Autocomplete
      size="small"
      disabled={disabled}
      options={options}
      groupBy={(o) => o.group}
      value={selected}
      onChange={(e, option) => option && onChange(option.value)}
      isOptionEqualToValue={(a, b) => a.value === b.value}
      getOptionLabel={(o) => o.label}
      disableClearable
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Search customers…"
          inputProps={{ ...params.inputProps, "aria-label": `Match for ${decision.raw}` }}
        />
      )}
    />
  );
};

const ExcelImportPanel = ({ onImported, customers = [] }) => {
  const theme = useTheme();
  const inputRef = useRef(null);
  const requestId = useRef(0);

  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [choices, setChoices] = useState({});
  const [useFirstName, setUseFirstName] = useState(true);
  const [preview, setPreview] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | analysing | importing | done
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [showNotImported, setShowNotImported] = useState(false);

  const accent = theme.palette.secondary[300];
  const line = theme.palette.secondary[700];

  const runPreview = useCallback(async (nextFiles, nextChoices, nextUseFirstName) => {
    if (!nextFiles.length) return;
    const id = ++requestId.current;
    setPhase("analysing");
    setError("");
    try {
      const { data } = await axios.post(
        `${server}/job-import/preview`,
        buildForm(nextFiles, nextChoices, { useFirstNameForCompound: nextUseFirstName }),
        { withCredentials: true }
      );
      // Ignore stale responses when choices change quickly.
      if (id === requestId.current) setPreview(data.preview);
    } catch (err) {
      if (id === requestId.current) setError(errorMessage(err));
    } finally {
      if (id === requestId.current) setPhase("idle");
    }
  }, []);

  const acceptFiles = (fileList) => {
    const picked = Array.from(fileList || []).filter((file) =>
      /\.(xlsx|xls)$/i.test(file.name)
    );
    if (!picked.length) {
      toast.error("Choose an Excel file (.xlsx)");
      return;
    }
    setFiles(picked);
    setChoices({});
    setResult(null);
    setPreview(null);
    runPreview(picked, {}, useFirstName);
  };

  const setChoice = (key, value) => {
    const next = { ...choices, [key]: value };
    setChoices(next);
    runPreview(files, next, useFirstName);
  };

  const toggleFirstName = (checked) => {
    setUseFirstName(checked);
    // Compound-place choices were made under the old default; start fresh.
    const next = Object.fromEntries(
      Object.entries(choices).filter(([key]) => !key.startsWith("customer:"))
    );
    setChoices(next);
    runPreview(files, next, checked);
  };

  const reset = () => {
    requestId.current += 1;
    setFiles([]);
    setChoices({});
    setPreview(null);
    setResult(null);
    setError("");
    setPhase("idle");
  };

  const handleImport = async () => {
    setPhase("importing");
    setError("");
    try {
      const { data } = await axios.post(
        `${server}/job-import/commit`,
        buildForm(files, choices, { useFirstNameForCompound: useFirstName }),
        { withCredentials: true }
      );
      setResult(data.result);
      setPhase("done");
      toast.success(data.message);
      onImported?.(data.result);
    } catch (err) {
      setPhase("idle");
      setError(errorMessage(err));
    }
  };

  const reviewDecisions = useMemo(
    () =>
      (preview?.decisions || []).filter((d) => showAllMatches || d.needsReview),
    [preview, showAllMatches]
  );
  const notImported = useMemo(
    () => (preview?.legs || []).filter((leg) => leg.status !== "ready"),
    [preview]
  );
  const hasCompound = (preview?.decisions || []).some((d) => d.compound);
  const multiSheet = (preview?.sheets || []).filter((s) => !s.skipped).length > 1;
  const busy = phase === "analysing" || phase === "importing";
  const summary = preview?.summary;

  const pressable = {
    transition: "transform 160ms cubic-bezier(0.23, 1, 0.32, 1)",
    ":active": { transform: "scale(0.97)" },
  };

  // ---------- Done ----------
  if (phase === "done" && result) {
    return (
      <Box maxWidth="760px" mx="auto" mt="1rem">
        <Box display="flex" alignItems="center" gap="0.75rem" mb="1rem">
          <CheckCircleOutline sx={{ color: theme.palette.success.main, fontSize: 32 }} />
          <Box>
            <Typography variant="h4" fontWeight="bold" color={theme.palette.secondary[100]}>
              Imported {result.jobsCreated} jobs ({result.legsCreated} trips)
            </Typography>
            {result.newCustomers.length > 0 && (
              <Typography color={theme.palette.secondary[300]}>
                New customers added: {result.newCustomers.join(", ")}
              </Typography>
            )}
          </Box>
        </Box>
        <Table size="small" sx={{ mb: "1rem" }}>
          <TableBody>
            {result.jobs.map((job) => (
              <TableRow key={job.jobNumber}>
                <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{job.jobNumber}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(job.date)}</TableCell>
                <TableCell>{job.contractorName}</TableCell>
                <TableCell>{job.route.join(" → ")}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                  {money(job.cost)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button variant="outlined" onClick={reset} sx={{ color: theme.palette.secondary[100], ...pressable }}>
          Import another file
        </Button>
      </Box>
    );
  }

  return (
    <Box maxWidth="1200px" mx="auto" mt="0.5rem">
      {/* ---------- Drop zone ---------- */}
      <Box
        role="button"
        tabIndex={0}
        aria-label="Choose Excel vehicle logs to import"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          acceptFiles(e.dataTransfer.files);
        }}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          p: files.length ? "0.9rem 1.25rem" : "2.5rem 1.5rem",
          border: `1.5px dashed ${dragging ? accent : line}`,
          borderRadius: "14px",
          backgroundColor: dragging ? theme.palette.background.alt : "transparent",
          cursor: "pointer",
          transition:
            "border-color 150ms ease, background-color 150ms ease, padding 200ms cubic-bezier(0.23, 1, 0.32, 1)",
          justifyContent: files.length ? "flex-start" : "center",
          flexDirection: files.length ? "row" : "column",
          textAlign: files.length ? "left" : "center",
          outline: "none",
          ":focus-visible": { boxShadow: `0 0 0 2px ${accent}` },
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          hidden
          onChange={(e) => {
            acceptFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {files.length ? (
          <>
            <DescriptionOutlined sx={{ color: accent }} />
            <Box flex="1" minWidth={0}>
              <Typography fontWeight={600} color={theme.palette.secondary[100]} noWrap>
                {files.map((f) => f.name).join(", ")}
              </Typography>
              <Typography variant="body2" color={theme.palette.secondary[300]}>
                Drop another file here or click to replace
              </Typography>
            </Box>
          </>
        ) : (
          <>
            <UploadFileOutlined sx={{ fontSize: 40, color: accent }} />
            <Typography variant="h5" fontWeight={600} color={theme.palette.secondary[100]}>
              Drop vehicle logs here, or click to choose
            </Typography>
            <Typography color={theme.palette.secondary[300]} maxWidth="52ch">
              One sheet per vehicle with the reg number in the title. Rows marked PVT or with no
              contractor are left out. Nothing is saved until you press Import.
            </Typography>
          </>
        )}
      </Box>

      <Box height="4px" mt="0.5rem">
        {busy && <LinearProgress color="secondary" />}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: "0.75rem" }}>
          {error}
        </Alert>
      )}

      {preview && (
        <Box sx={{ opacity: phase === "analysing" ? 0.6 : 1, transition: "opacity 150ms ease" }}>
          {/* ---------- Summary ---------- */}
          <Box
            display="flex"
            flexWrap="wrap"
            alignItems="baseline"
            columnGap="1.5rem"
            rowGap="0.25rem"
            mt="1rem"
          >
            <Typography variant="h4" fontWeight="bold" color={theme.palette.secondary[100]}>
              {summary.jobs} jobs · {summary.ready} trips · {summary.distance} km ·{" "}
              {money(summary.cost)}
            </Typography>
            <Typography color={theme.palette.secondary[300]}>
              {[
                summary.skipped && `${summary.skipped} skipped`,
                summary.duplicate && `${summary.duplicate} already imported`,
                summary.error && `${summary.error} with problems`,
                summary.blocked && `${summary.blocked} waiting on a match`,
              ]
                .filter(Boolean)
                .join(" · ") || "Every row will be imported"}
            </Typography>
          </Box>

          {preview.sheets
            .filter((sheet) => sheet.skipped)
            .map((sheet) => (
              <Alert key={`${sheet.fileName}-${sheet.sheetName}`} severity="info" sx={{ mt: "0.75rem" }}>
                Sheet “{sheet.sheetName}” was ignored — it isn’t a vehicle log.
              </Alert>
            ))}

          {/* ---------- Matches to review ---------- */}
          <Box mt="1.75rem">
            <Box display="flex" alignItems="center" flexWrap="wrap" gap="0.5rem 1.5rem" mb="0.5rem">
              <Typography variant="h5" fontWeight="bold" color={theme.palette.secondary[100]}>
                {summary.toReview
                  ? `Check ${summary.toReview} ${summary.toReview === 1 ? "match" : "matches"}`
                  : "All names matched"}
              </Typography>
              {hasCompound && (
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      color="secondary"
                      checked={useFirstName}
                      onChange={(e) => toggleFirstName(e.target.checked)}
                    />
                  }
                  label="Use the first name for places like “Lammel / Shippy”"
                />
              )}
              <Button
                size="small"
                onClick={() => setShowAllMatches((v) => !v)}
                sx={{ color: theme.palette.secondary[300], ml: "auto" }}
              >
                {showAllMatches ? "Show only ones to check" : "Show every match"}
              </Button>
            </Box>

            {reviewDecisions.length > 0 && (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>In the sheet</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell sx={{ minWidth: 260 }}>Use in the system</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reviewDecisions.map((decision) => {
                    const chip = STATUS_CHIP[decision.status] || STATUS_CHIP.auto;
                    return (
                      <TableRow key={decision.key}>
                        <TableCell sx={{ fontWeight: 600 }}>{decision.raw}</TableCell>
                        <TableCell>{KIND_LABEL[decision.kind]}</TableCell>
                        <TableCell>
                          {decision.kind === "customer" ? (
                            <PlaceField
                              decision={decision}
                              customers={customers}
                              disabled={phase === "importing"}
                              onChange={(value) => setChoice(decision.key, value)}
                            />
                          ) : (
                          <Select
                            size="small"
                            fullWidth
                            displayEmpty
                            disabled={phase === "importing"}
                            value={decision.value || ""}
                            onChange={(e) => setChoice(decision.key, e.target.value)}
                            inputProps={{ "aria-label": `Match for ${decision.raw}` }}
                          >
                            <MenuItem value="" disabled>
                              Choose…
                            </MenuItem>
                            {decision.options.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" variant="outlined" color={chip.color} label={chip.label} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Box>

          {/* ---------- Jobs ---------- */}
          <Typography variant="h5" fontWeight="bold" color={theme.palette.secondary[100]} mt="1.75rem" mb="0.5rem">
            Jobs to create
          </Typography>
          {preview.jobs.length ? (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ "& td, & th": { whiteSpace: "nowrap" } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Job</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Vehicle</TableCell>
                    <TableCell>Driver</TableCell>
                    <TableCell>Contractor</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Route</TableCell>
                    <TableCell align="right">Km</TableCell>
                    <TableCell align="right">Rate</TableCell>
                    <TableCell align="right">Cost</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody sx={{ "& td": { fontVariantNumeric: "tabular-nums" } }}>
                  {preview.jobs.map((job) => (
                    <TableRow key={job.tempId}>
                      <TableCell sx={{ fontWeight: 600 }}>{job.jobNumber}</TableCell>
                      <TableCell>{formatDate(job.date)}</TableCell>
                      <TableCell>{job.regNumber}</TableCell>
                      <TableCell>{job.driverName}</TableCell>
                      <TableCell>{job.contractorName}</TableCell>
                      <TableCell sx={{ textTransform: "capitalize" }}>{job.deliveryType}</TableCell>
                      <TableCell sx={{ whiteSpace: "normal !important", minWidth: 240 }}>
                        {job.route.join(" → ")}
                      </TableCell>
                      <TableCell align="right">{job.distance}</TableCell>
                      <TableCell align="right">{money(job.rate)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {money(job.cost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          ) : (
            <Typography color={theme.palette.secondary[300]}>
              {summary.duplicate
                ? "Every trip in this file is already in the system."
                : "No trips to import yet — check the rows below."}
            </Typography>
          )}
          <Typography variant="body2" color={theme.palette.secondary[300]} mt="0.5rem">
            Job numbers are provisional and are confirmed when you import.
          </Typography>

          {/* ---------- Not imported ---------- */}
          {notImported.length > 0 && (
            <Box mt="1.25rem">
              <Button
                size="small"
                onClick={() => setShowNotImported((v) => !v)}
                endIcon={showNotImported ? <ExpandLess /> : <ExpandMore />}
                sx={{ color: theme.palette.secondary[300], px: 0 }}
              >
                {notImported.length} {notImported.length === 1 ? "row" : "rows"} won't be imported
              </Button>
              <Collapse in={showNotImported}>
                <Table size="small">
                  <TableBody>
                    {notImported.map((leg) => (
                      <TableRow key={leg.id}>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          {multiSheet ? `${leg.sheetName} · ` : ""}Row {leg.rowNumber}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(leg.date)}</TableCell>
                        <TableCell>
                          {leg.fromRaw} → {leg.toRaw}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          {LEG_STATUS_LABEL[leg.status]}
                        </TableCell>
                        <TableCell>{leg.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Collapse>
            </Box>
          )}

          {/* ---------- Actions ---------- */}
          <Box
            display="flex"
            justifyContent="flex-end"
            alignItems="center"
            gap="0.75rem"
            mt="1.5rem"
            pt="1rem"
            borderTop={`1px solid ${line}`}
          >
            {summary.blocked > 0 && (
              <Typography color={theme.palette.error.main} mr="auto">
                Choose a match for every name marked “Choose one” to continue.
              </Typography>
            )}
            <Button onClick={reset} disabled={phase === "importing"} sx={{ color: theme.palette.secondary[300] }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="secondary"
              disabled={!preview.canCommit || busy}
              onClick={handleImport}
              sx={{ fontWeight: "bold", minWidth: 180, ...pressable }}
            >
              {phase === "importing"
                ? "Importing…"
                : `Import ${summary.jobs} ${summary.jobs === 1 ? "job" : "jobs"}`}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ExcelImportPanel;

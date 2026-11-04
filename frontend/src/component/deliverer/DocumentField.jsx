import React, { useRef, useState } from "react";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { isStoredFile, openStoredFile } from "utils/openStoredFile";
import { formatSize, shrinkForUpload } from "utils/shrinkImage";

// One uploaded document (a driver's licence or ID), with what the person needs to know:
//   - a picked file waiting to be saved (name and size)
//   - a document already on file, with a button to view it
//   - an older record whose file was never kept ("upload it again")
//   - nothing yet
// `editable` is false when the dialog is only for viewing.
const DocumentField = ({ label, storedKey, file, onChange, editable, required }) => {
  const theme = useTheme();
  const inputRef = useRef(null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  const onFile = async (event) => {
    const picked = event.target.files && event.target.files[0];
    event.target.value = ""; // choosing the same file again must still fire
    if (!picked) return;
    setProblem("");
    setBusy(true);
    try {
      onChange(await shrinkForUpload(picked));
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  };

  const view = async () => {
    setProblem("");
    try {
      await openStoredFile(storedKey);
    } catch (error) {
      setProblem(error.message);
    }
  };

  const onFileStored = isStoredFile(storedKey);
  const legacy = Boolean(storedKey) && !onFileStored;

  let status;
  let statusColor = theme.palette.text.secondary;
  if (file) {
    status = `${file.name} (${formatSize(file.size)}), will be saved`;
    statusColor = theme.palette.text.primary;
  } else if (onFileStored) {
    status = "On file";
  } else if (legacy) {
    status = "The file for this record was not kept. Upload it again.";
    statusColor = theme.palette.warning.main;
  } else {
    status = required && editable ? "Required" : "Not uploaded";
  }

  const chooseLabel = file || onFileStored || legacy ? "Replace" : "Choose file";

  return (
    <Box sx={{ m: 1, minWidth: 250 }}>
      <Typography component="span" sx={{ display: "block", fontWeight: 500, mb: 0.5 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: statusColor, wordBreak: "break-word", mb: 1 }}
        aria-live="polite"
      >
        {status}
      </Typography>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {onFileStored && !file && (
          <Button variant="outlined" size="small" onClick={view}>
            View
          </Button>
        )}
        {editable && (
          <Button
            variant="outlined"
            size="small"
            disabled={busy}
            onClick={() => inputRef.current && inputRef.current.click()}
            aria-label={`${chooseLabel} ${label}`}
          >
            {busy ? "Preparing…" : chooseLabel}
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={onFile}
          hidden
          tabIndex={-1}
        />
      </Box>
      {problem && (
        <Typography variant="body2" role="alert" sx={{ color: theme.palette.error.main, mt: 1 }}>
          {problem}
        </Typography>
      )}
    </Box>
  );
};

export default DocumentField;

import React, { useState } from "react";
import { Box, Button, Chip, Switch, Typography, useTheme } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import Header from "component/deliverer/Header";
import { saveModules, loadTenant } from "redux/actions/tenant";
import DeleteCompanySection from "component/deliverer/DeleteCompanySection";
import { downloadCompanyExport } from "utils/downloadExport";

const ADMIN_ROLES = ["Deliverer Admin", "Super Admin", "Site Admin"];

const ModulesPage = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { user, modules, moduleRegistry, modulesLoaded } = useSelector((s) => s.user);
  const [saving, setSaving] = useState("");
  const canEdit = Boolean(user && ADMIN_ROLES.includes(user.role));
  const [exporting, setExporting] = useState(false);

  const exportData = async () => {
    setExporting(true);
    try {
      await downloadCompanyExport();
      toast.success("Your data has been downloaded");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setExporting(false);
    }
  };

  const toggle = async (key, value) => {
    setSaving(key);
    try {
      await dispatch(saveModules({ [key]: value }));
      toast.success(value ? "Switched on" : "Switched off");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save that change");
    } finally {
      setSaving("");
    }
  };

  return (
    <Box m={{ xs: "1rem 0.75rem", sm: "1.25rem 1.5rem", md: "1.5rem 2.5rem" }}>
      <Header
        title="MODULES"
        subtitle="Choose which parts of myfleet your company uses. Switching one off hides it for everyone; your data is kept."
      />

      {!modulesLoaded && <Typography mt="2rem">Loading…</Typography>}

      {modulesLoaded && !moduleRegistry && (
        <Typography mt="2rem">
          Couldn't load your settings.{" "}
          <span
            role="button"
            tabIndex={0}
            style={{ textDecoration: "underline", cursor: "pointer" }}
            onClick={() => dispatch(loadTenant())}
            onKeyDown={(e) => e.key === "Enter" && dispatch(loadTenant())}
          >
            Try again
          </span>
        </Typography>
      )}

      {moduleRegistry && (
        <Box mt="1.5rem" maxWidth="720px">
          {!canEdit && (
            <Typography mb="1rem" sx={{ opacity: 0.75 }}>
              Only company admins can change these.
            </Typography>
          )}
          {moduleRegistry.map((m) => (
            <Box
              key={m.key}
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              gap="1rem"
              py="1rem"
              borderBottom={`1px solid ${theme.palette.divider}`}
              sx={{ opacity: m.available ? 1 : 0.55 }}
            >
              <Box>
                <Typography fontWeight="bold">
                  {m.label}{" "}
                  {!m.available && <Chip size="small" label="Coming soon" sx={{ ml: 1 }} />}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.75 }}>
                  {m.description}
                </Typography>
              </Box>
              <Switch
                checked={Boolean(modules && modules[m.key])}
                disabled={!m.available || !canEdit || saving === m.key}
                onChange={(e) => toggle(m.key, e.target.checked)}
                inputProps={{ "aria-label": m.label }}
              />
            </Box>
          ))}
        </Box>
      )}

      {canEdit && (
        <Box mt="3rem" maxWidth="720px">
          <Typography fontWeight="bold">Your data</Typography>
          <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.5, mb: 1.5 }}>
            Download everything your company has entered: jobs, customers, vehicles, drivers, invoices,
            expenses and uploaded documents. You get spreadsheets you can open in Excel, and a copy in
            a format other systems can read.
          </Typography>
          <Button variant="outlined" onClick={exportData} disabled={exporting}>
            {exporting ? "Preparing your download…" : "Download all company data"}
          </Button>
        </Box>
      )}

      {canEdit && user.role === "Deliverer Admin" && (
        <DeleteCompanySection onExport={exportData} />
      )}
    </Box>
  );
};

export default ModulesPage;

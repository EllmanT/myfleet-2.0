import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Box, Button, TextField, Typography, useTheme } from "@mui/material";
import { useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import Header from "component/deliverer/Header";
import { server } from "server";
import { shrinkForUpload } from "utils/shrinkImage";
import { apiMessage, fetchLetterhead, removeLogo, saveLetterhead, uploadLogo } from "utils/tripApi";

const blank = { address: "", city: "", phone: "", email: "", tin: "", bankDetails: "", paymentTermsDays: "" };

// The details printed at the top of every quotation, purchase order, delivery note and invoice.
const CompanyDetailsPage = () => {
  const theme = useTheme();
  const { user } = useSelector((state) => state.user);
  const canEdit = ["Deliverer Admin", "Super Admin"].includes(user && user.role);
  const [form, setForm] = useState(blank);
  const [name, setName] = useState("");
  const [logoKey, setLogoKey] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const apply = useCallback((lh) => {
    setName(lh.companyName);
    setLogoKey(lh.logo || "");
    setForm({
      address: lh.address, city: lh.city, phone: lh.phone, email: lh.email, tin: lh.tin,
      bankDetails: lh.bankDetails, paymentTermsDays: lh.paymentTermsDays,
    });
  }, []);

  useEffect(() => {
    fetchLetterhead().then((r) => apply(r.letterhead)).catch((e) => toast.error(apiMessage(e)));
  }, [apply]);

  // the logo is private, so it is fetched with the sign-in attached and shown from memory
  useEffect(() => {
    let url = "";
    let cancelled = false;
    setLogoUrl("");
    if (!logoKey) return undefined;
    axios
      .get(`${server}/files/${logoKey.split("/").map(encodeURIComponent).join("/")}`, { responseType: "blob", withCredentials: true })
      .then(({ data }) => {
        if (cancelled) return;
        url = URL.createObjectURL(data);
        setLogoUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [logoKey]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const run = async (fn, msg) => {
    setBusy(true);
    try {
      const res = await fn();
      if (res && res.letterhead) apply(res.letterhead);
      if (msg) toast.success(msg);
    } catch (e) {
      toast.error(e.response ? apiMessage(e) : e.message);
    } finally {
      setBusy(false);
    }
  };

  const onLogo = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.type === "application/pdf") return toast.error("Choose a PNG or JPG picture of your logo.");
    run(async () => uploadLogo(await shrinkForUpload(file)), "Logo saved");
  };

  return (
    <Box m={{ xs: "1rem 0.75rem", sm: "1.25rem 1.5rem", md: "1.5rem 2.5rem" }} maxWidth="760px">
      <Header title="COMPANY DETAILS" subtitle="Shown at the top of your quotations, purchase orders, delivery notes and invoices." />
      {!canEdit && <Typography mt="1rem" color="warning.main">Only a company admin can change these details.</Typography>}

      <Box mt="1.5rem" p="1rem" sx={{ backgroundColor: theme.palette.background.alt, borderRadius: "0.55rem" }}>
        <Typography fontWeight="bold" mb="0.5rem">Logo</Typography>
        <Box display="flex" alignItems="center" gap="1rem" flexWrap="wrap">
          <Box sx={{ width: 140, height: 80, border: "1px dashed", borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#fff", borderRadius: 1 }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Company logo" style={{ maxWidth: "100%", maxHeight: "100%" }} />
            ) : (
              <Typography variant="caption" color="text.secondary" sx={{ px: 1, textAlign: "center" }}>{logoKey ? "Loading..." : "No logo yet"}</Typography>
            )}
          </Box>
          {canEdit && (
            <Box display="flex" gap="0.5rem">
              <Button variant="outlined" onClick={() => fileRef.current && fileRef.current.click()} disabled={busy}>
                {logoKey ? "Change logo" : "Upload logo"}
              </Button>
              {logoKey && <Button color="error" onClick={() => run(removeLogo, "Logo removed")} disabled={busy}>Remove</Button>}
            </Box>
          )}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden onChange={onLogo} />
        </Box>
      </Box>

      <Box mt="1rem" p="1rem" display="grid" gap="1rem" sx={{ backgroundColor: theme.palette.background.alt, borderRadius: "0.55rem" }}>
        <Typography fontWeight="bold">{name}</Typography>
        <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(220px, 1fr))" gap="1rem">
          <TextField size="small" label="Address" value={form.address} onChange={set("address")} disabled={!canEdit} />
          <TextField size="small" label="City" value={form.city} onChange={set("city")} disabled={!canEdit} />
          <TextField size="small" label="Phone" value={form.phone} onChange={set("phone")} disabled={!canEdit} />
          <TextField size="small" label="Email" value={form.email} onChange={set("email")} disabled={!canEdit} />
          <TextField size="small" label="TIN" value={form.tin} onChange={set("tin")} disabled={!canEdit} />
          <TextField size="small" type="number" label="Payment terms (days)" value={form.paymentTermsDays} onChange={set("paymentTermsDays")}
            disabled={!canEdit} inputProps={{ min: 0, max: 365 }} helperText="Printed on invoices, e.g. 30. Use 0 for due on receipt." />
        </Box>
        <TextField size="small" label="Banking details (bank, account name, number, branch)" value={form.bankDetails} onChange={set("bankDetails")}
          disabled={!canEdit} multiline minRows={3} />
        {canEdit && (
          <Box>
            <Button variant="contained" disabled={busy} onClick={() => run(() => saveLetterhead(form), "Company details saved")}
              sx={{ backgroundColor: theme.palette.secondary.light, color: theme.palette.background.alt, fontWeight: "bold" }}>
              Save
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default CompanyDetailsPage;

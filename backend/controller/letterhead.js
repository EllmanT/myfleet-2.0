const express = require("express");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated } = require("../middleware/auth");
const { requireCompany, requireRole } = require("../middleware/tenantAccess");
const { upload } = require("../multer");
const { saveFile, deleteFile, sniffType } = require("../services/fileStorage");
const Deliverer = require("../model/deliverer");
const router = express.Router();

const text = (v, max) => String(v === undefined || v === null ? "" : v).trim().slice(0, max);

const present = (c) => ({
  companyName: c.companyName,
  address: c.address || "",
  city: c.city || "",
  phone: (c.letterhead && c.letterhead.phone) || "",
  email: (c.letterhead && c.letterhead.email) || "",
  tin: (c.letterhead && c.letterhead.tin) || "",
  bankDetails: (c.letterhead && c.letterhead.bankDetails) || "",
  paymentTermsDays:
    c.letterhead && c.letterhead.paymentTermsDays !== undefined && c.letterhead.paymentTermsDays !== null
      ? c.letterhead.paymentTermsDays
      : "",
  hasLogo: Boolean(c.letterhead && c.letterhead.logo),
  logo: (c.letterhead && c.letterhead.logo) || "",
});

const guard = [isAuthenticated, requireCompany];
const adminOnly = requireRole("Deliverer Admin", "Super Admin");

const load = async (req) => {
  const company = await Deliverer.findById(req.user.companyId);
  if (!company) throw new ErrorHandler("Company not found", 404);
  return company;
};

// What appears at the top of quotations, purchase orders, delivery notes and invoices.
router.get(
  "/",
  ...guard,
  catchAsyncErrors(async (req, res) => {
    res.status(200).json({ success: true, letterhead: present(await load(req)) });
  })
);

router.put(
  "/",
  ...guard,
  adminOnly,
  catchAsyncErrors(async (req, res, next) => {
    const company = await load(req);
    const b = req.body || {};
    const days = b.paymentTermsDays;
    if (days !== "" && days !== undefined && days !== null) {
      const n = Number(days);
      if (!Number.isInteger(n) || n < 0 || n > 365) {
        return next(new ErrorHandler("Payment terms must be a whole number of days from 0 to 365", 400));
      }
    }
    const email = text(b.email, 120);
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return next(new ErrorHandler("That email address does not look right", 400));

    if (b.address !== undefined && text(b.address, 200)) company.address = text(b.address, 200);
    if (b.city !== undefined && text(b.city, 80)) company.city = text(b.city, 80);
    const lh = company.letterhead || {};
    company.letterhead = {
      phone: b.phone !== undefined ? text(b.phone, 60) : lh.phone || "",
      email: b.email !== undefined ? email : lh.email || "",
      tin: b.tin !== undefined ? text(b.tin, 60) : lh.tin || "",
      bankDetails: b.bankDetails !== undefined ? text(b.bankDetails, 600) : lh.bankDetails || "",
      paymentTermsDays:
        days === "" || days === null ? undefined : days !== undefined ? Number(days) : lh.paymentTermsDays,
      logo: lh.logo || "",
    };
    await company.save();
    res.status(200).json({ success: true, letterhead: present(company) });
  })
);

// The logo is a JPEG or PNG (those are what the PDFs can draw).
router.post(
  "/logo",
  ...guard,
  adminOnly,
  upload.single("logo"),
  catchAsyncErrors(async (req, res, next) => {
    if (!req.file) return next(new ErrorHandler("Choose a logo image", 400));
    const type = sniffType(req.file.buffer);
    if (!type || !["jpg", "png"].includes(type.ext)) {
      return next(new ErrorHandler("The logo must be a PNG or JPG image", 400));
    }
    const company = await load(req);
    const stored = await saveFile({ tenantId: String(company._id), kind: "logo", buffer: req.file.buffer });
    const old = company.letterhead && company.letterhead.logo;
    company.set("letterhead.logo", stored.key);
    await company.save();
    if (old) await deleteFile(old);
    res.status(200).json({ success: true, letterhead: present(company) });
  })
);

router.delete(
  "/logo",
  ...guard,
  adminOnly,
  catchAsyncErrors(async (req, res) => {
    const company = await load(req);
    const old = company.letterhead && company.letterhead.logo;
    company.set("letterhead.logo", "");
    await company.save();
    if (old) await deleteFile(old);
    res.status(200).json({ success: true, letterhead: present(company) });
  })
);

module.exports = router;

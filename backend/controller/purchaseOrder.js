const express = require("express");
const mongoose = require("mongoose");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated } = require("../middleware/auth");
const { requireModule } = require("../middleware/moduleAccess");
const { requireCompany } = require("../middleware/tenantAccess");
const { escapeRegex } = require("../utils/escapeRegex");
const { detectCrossBorder, round2 } = require("../utils/tripMath");
const { streamDocumentPdf } = require("../utils/documentPdf");
const { companyForPdf } = require("../services/letterhead");
const { upload } = require("../multer");
const { saveFile, deleteFile } = require("../services/fileStorage");
const PurchaseOrder = require("../model/purchaseOrder");
const Trip = require("../model/trip");
const router = express.Router();

const guard = [isAuthenticated, requireCompany, requireModule("crossBorder")];

const toDate = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const text = (v, max = 200) => String(v === undefined || v === null ? "" : v).trim().slice(0, max);

const handle = (fn) =>
  catchAsyncErrors(async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      if (error && error.code === 11000) {
        return next(new ErrorHandler("That client already has a purchase order with this number", 409));
      }
      return next(error instanceof ErrorHandler ? error : new ErrorHandler(error.message, 400));
    }
  });

// Only the client and the date are needed. Everything else can be added later.
function cleanPo(body) {
  const date = toDate(body.date);
  if (!date) throw new ErrorHandler("A valid date is required", 400);
  const customerName = text(body.customerName, 120);
  if (!customerName) throw new ErrorHandler("Client is required", 400);

  const stops = (Array.isArray(body.stops) ? body.stops : [])
    .map((s) => ({ place: text(s && s.place, 80), country: text(s && s.country, 40) }))
    .filter((s) => s.place)
    .slice(0, 12);

  const doc = {
    poNumber: text(body.poNumber, 60) || undefined,
    customerName,
    date,
    status: body.status === "done" ? "done" : "open",
    description: text(body.description, 500),
    stops,
    currency: PurchaseOrder.CURRENCIES.includes(body.currency) ? body.currency : "USD",
    notes: text(body.notes, 1000),
  };
  if (body.price !== undefined && body.price !== "" && body.price !== null) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) throw new ErrorHandler("Price must be a number of 0 or more", 400);
    doc.price = round2(price);
  }
  return doc;
}

const findMine = async (req) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ErrorHandler("Invalid id", 400);
  const po = await PurchaseOrder.findOne({ _id: req.params.id, tenantId: req.user.companyId });
  if (!po) throw new ErrorHandler("Purchase order not found", 404);
  return po;
};

// Trips started from a PO carry its client, route, goods and agreed price. A blank price is 0
// until it is known.
async function makeTrips(po, count, userId) {
  const n = Math.min(Math.max(parseInt(count, 10) || 0, 0), 50);
  if (!n) return [];
  const docs = Array.from({ length: n }, () => ({
    tenantId: po.tenantId,
    date: po.date,
    customerName: po.customerName,
    purchaseOrderId: po._id,
    stops: po.stops,
    isCrossBorder: detectCrossBorder(po.stops),
    cargoDescription: (po.description || "").slice(0, 300),
    price: po.price || 0,
    currency: po.currency,
    status: "planned",
    source: "purchase-order",
    createdBy: userId,
  }));
  return Trip.insertMany(docs);
}

const hasFile = (po) => Boolean(po.document);
const present = (po, extra = {}) => ({ ...(po.toObject ? po.toObject() : po), hasDocument: hasFile(po), ...extra });

router.post(
  "/create-po",
  ...guard,
  handle(async (req, res) => {
    const doc = cleanPo(req.body);
    const po = await PurchaseOrder.create({ ...doc, tenantId: req.user.companyId, createdBy: req.user._id });
    const trips = await makeTrips(po, req.body.tripCount, req.user._id);
    res.status(201).json({ success: true, purchaseOrder: present(po), tripsCreated: trips.length });
  })
);

router.get(
  "/get-pos",
  ...guard,
  handle(async (req, res) => {
    const { search, status } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 0, 0);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 50, 1), 200);
    const q = { tenantId: req.user.companyId };
    if (status === "open" || status === "done") q.status = status;
    if (search && String(search).trim()) {
      const rx = new RegExp(escapeRegex(String(search).trim().slice(0, 60)), "i");
      q.$or = [{ poNumber: rx }, { customerName: rx }, { description: rx }, { "stops.place": rx }];
    }
    const [pos, total] = await Promise.all([
      PurchaseOrder.find(q).sort({ date: -1, _id: -1 }).skip(page * pageSize).limit(pageSize).lean(),
      PurchaseOrder.countDocuments(q),
    ]);
    const counts = await Trip.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(String(req.user.companyId)), purchaseOrderId: { $in: pos.map((p) => p._id) } } },
      { $group: { _id: "$purchaseOrderId", trips: { $sum: 1 }, delivered: { $sum: { $cond: [{ $in: ["$status", ["delivered", "closed"]] }, 1, 0] } } } },
    ]);
    const byId = new Map(counts.map((c) => [String(c._id), c]));
    res.status(200).json({
      success: true,
      total,
      page,
      pageSize,
      purchaseOrders: pos.map((p) => {
        const c = byId.get(String(p._id)) || { trips: 0, delivered: 0 };
        return { ...p, hasDocument: hasFile(p), tripCount: c.trips, deliveredCount: c.delivered };
      }),
    });
  })
);

router.get(
  "/get-po/:id",
  ...guard,
  handle(async (req, res) => {
    const po = await findMine(req);
    const trips = await Trip.find({ tenantId: req.user.companyId, purchaseOrderId: po._id })
      .sort({ date: 1, _id: 1 }).lean();
    res.status(200).json({ success: true, purchaseOrder: present(po), trips });
  })
);

router.put(
  "/update-po/:id",
  ...guard,
  handle(async (req, res) => {
    const po = await findMine(req);
    const doc = cleanPo({ ...po.toObject(), ...req.body });
    if (!("poNumber" in doc)) po.poNumber = undefined;
    if (!("price" in doc)) po.price = undefined;
    po.set(doc);
    await po.save();
    res.status(200).json({ success: true, purchaseOrder: present(po) });
  })
);

// Adds more trips to an existing order (e.g. "3 trips").
router.post(
  "/add-trips/:id",
  ...guard,
  handle(async (req, res) => {
    const po = await findMine(req);
    const trips = await makeTrips(po, req.body.count, req.user._id);
    if (!trips.length) throw new ErrorHandler("Say how many trips to add", 400);
    res.status(201).json({ success: true, tripsCreated: trips.length });
  })
);

// The trips stay: only their link to the order is removed.
router.delete(
  "/delete-po/:id",
  ...guard,
  handle(async (req, res) => {
    const po = await findMine(req);
    await Trip.updateMany({ tenantId: req.user.companyId, purchaseOrderId: po._id }, { $unset: { purchaseOrderId: "" } });
    await po.deleteOne();
    if (po.document) await deleteFile(po.document);
    res.status(200).json({ success: true, message: "Purchase order deleted. Its trips were kept." });
  })
);

// A photo or PDF of the original order from the client.
router.post(
  "/document/:id",
  ...guard,
  upload.single("document"),
  handle(async (req, res) => {
    const po = await findMine(req);
    if (!req.file) throw new ErrorHandler("Choose a photo or PDF", 400);
    const stored = await saveFile({ tenantId: String(po.tenantId), kind: "purchase-order", buffer: req.file.buffer });
    const old = po.document;
    po.document = stored.key;
    await po.save();
    if (old) await deleteFile(old);
    res.status(200).json({ success: true, purchaseOrder: present(po) });
  })
);

router.get(
  "/pdf/:id",
  ...guard,
  handle(async (req, res) => {
    const po = await findMine(req);
    const qty = await Trip.countDocuments({ tenantId: req.user.companyId, purchaseOrderId: po._id });
    const quantity = qty || 1;
    const unitPrice = po.price || 0;
    const route = (po.stops || []).map((s) => s.place).join(" to ");
    const description = [po.description || "As agreed", route].filter(Boolean).join(" - ");
    const total = round2(quantity * unitPrice);
    const company = await companyForPdf(req.user.companyId);
    streamDocumentPdf(res, {
      kind: "Purchase Order",
      doc: {
        number: po.poNumber ? `PO ${po.poNumber}` : "",
        issueDate: po.date,
        customerName: po.customerName,
        currency: po.currency,
        lines: [{ description, quantity, unitPrice, amount: total }],
        subtotal: total,
        total,
        notes: po.notes,
      },
      company,
      filename: `purchase-order-${po.poNumber || po._id}.pdf`,
    });
  })
);

module.exports = router;

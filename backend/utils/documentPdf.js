const PDFDocument = require("pdfkit");

const money = (n, currency = "USD") =>
  `${currency === "USD" ? "$" : currency + " "}${Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

const left = 48;
const right = 547;

function openPdf(res, filename) {
  const pdf = new PDFDocument({ size: "A4", margin: 48 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  pdf.pipe(res);
  return pdf;
}

// Company letterhead: logo (when there is one), name, address, phone, email, TIN.
// The title block ("INVOICE", number, dates) goes on the right.
function drawHeader(pdf, company, kind, rightLines) {
  const lh = company.letterhead || {};
  const textLeft = company.logoBuffer ? left + 100 : left;
  if (company.logoBuffer) {
    try {
      pdf.image(company.logoBuffer, left, 48, { fit: [90, 70] });
    } catch (error) {
      // a damaged logo must not stop the document
    }
  }
  pdf.fillColor("#000").fontSize(18).font("Helvetica-Bold").text(company.companyName || "", textLeft, 48, { width: 260 });
  pdf.fontSize(9).font("Helvetica").fillColor("#444");
  const lines = [
    [company.address, company.city].filter(Boolean).join(", "),
    [lh.phone && `Tel: ${lh.phone}`, lh.email].filter(Boolean).join("   "),
    lh.tin ? `TIN: ${lh.tin}` : "",
    company.contact ? `Contact: ${company.contact}` : "",
  ].filter(Boolean);
  lines.forEach((l) => pdf.text(l, textLeft, pdf.y, { width: 260 }));
  const afterLeft = pdf.y;

  pdf.fillColor("#000").fontSize(20).font("Helvetica-Bold").text(kind.toUpperCase(), left, 48, { width: right - left, align: "right" });
  pdf.fontSize(10).font("Helvetica");
  rightLines.filter(Boolean).forEach((l) => pdf.text(l, { width: right - left, align: "right" }));
  pdf.y = Math.max(afterLeft, pdf.y, company.logoBuffer ? 125 : 0);
}

// Always at the foot of the page, and can never push a second page.
function footer(pdf, textLine) {
  pdf.font("Helvetica").fontSize(8).fillColor("#666").text(textLine, left, 780, {
    width: right - left,
    align: "center",
    lineBreak: false,
  });
}

// Streams a quotation, purchase order or invoice as a plain, printable PDF.
// `doc` is the presented (dollar) shape; `kind` is "Invoice", "Quotation" or "Purchase Order".
// `company` may carry `letterhead` and `logoBuffer` (see services/letterhead.js).
function streamDocumentPdf(res, { kind, doc, company, filename }) {
  const pdf = openPdf(res, filename);
  const lh = company.letterhead || {};

  drawHeader(pdf, company, kind, [
    doc.number || (kind === "Purchase Order" ? "" : "DRAFT"),
    `Date: ${day(doc.issueDate)}`,
    kind === "Invoice" && doc.dueDate ? `Due: ${day(doc.dueDate)}` : "",
    kind === "Quotation" && doc.validUntil ? `Valid until: ${day(doc.validUntil)}` : "",
  ]);

  pdf.moveDown(2);
  pdf.font("Helvetica-Bold").fontSize(10).text(kind === "Purchase Order" ? "Client" : "Bill to", left);
  pdf.font("Helvetica").text(doc.customerName);
  if (doc.subject) pdf.moveDown(0.5).font("Helvetica-Oblique").text(doc.subject).font("Helvetica");

  // lines table
  pdf.moveDown(1.2);
  const colDesc = left, colQty = 330, colPrice = 385, colAmt = 470;
  let y = pdf.y;
  pdf.font("Helvetica-Bold").fontSize(9);
  pdf.text("Description", colDesc, y).text("Qty", colQty, y).text("Price", colPrice, y).text("Amount", colAmt, y, { width: right - colAmt, align: "right" });
  pdf.moveTo(left, y + 13).lineTo(right, y + 13).strokeColor("#999").stroke();
  y += 20;
  pdf.font("Helvetica").fontSize(9);
  for (const l of doc.lines) {
    const h = pdf.heightOfString(l.description, { width: colQty - colDesc - 10 });
    if (y + h > 740) {
      pdf.addPage();
      y = 60;
    }
    pdf.text(l.description, colDesc, y, { width: colQty - colDesc - 10 });
    pdf.text(String(l.quantity), colQty, y).text(money(l.unitPrice, doc.currency), colPrice, y);
    pdf.text(money(l.amount, doc.currency), colAmt, y, { width: right - colAmt, align: "right" });
    y += Math.max(h, 12) + 6;
  }

  // totals
  pdf.moveTo(left, y).lineTo(right, y).strokeColor("#999").stroke();
  y += 8;
  const row = (label, value, bold = false) => {
    pdf.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10);
    pdf.text(label, 330, y, { width: 135 }).text(value, colAmt, y, { width: right - colAmt, align: "right" });
    y += 16;
  };
  row("Subtotal", money(doc.subtotal, doc.currency));
  if (doc.taxRatePct) row(`Tax (${doc.taxRatePct}%)`, money(doc.tax, doc.currency));
  row("Total", money(doc.total, doc.currency), true);
  if (kind === "Invoice" && doc.status === "issued") {
    if (doc.paid) row("Paid", money(doc.paid, doc.currency));
    if (doc.credits) row("Credit notes", money(doc.credits, doc.currency));
    row("Balance due", money(doc.balance, doc.currency), true);
  }
  if (doc.status === "void") pdf.fillColor("#b00").font("Helvetica-Bold").fontSize(14).text("VOID", left, y + 10).fillColor("#000");

  // notes and payment terms
  pdf.font("Helvetica").fontSize(9).fillColor("#000");
  const hasTerms = lh.paymentTermsDays !== undefined && lh.paymentTermsDays !== null;
  const terms =
    kind === "Invoice" && !doc.terms && hasTerms
      ? `Payment terms: ${lh.paymentTermsDays === 0 ? "due on receipt" : `${lh.paymentTermsDays} days`}`
      : "";
  const tail = [doc.notes, doc.terms, terms].filter(Boolean).join("\n\n");
  let tailY = y + 30;
  if (tail) {
    pdf.text(tail, left, tailY, { width: right - left });
    tailY = pdf.y + 12;
  }

  // where to pay
  if (lh.bankDetails && (kind === "Invoice" || kind === "Quotation")) {
    pdf.font("Helvetica-Bold").fontSize(9).text("Banking details", left, tailY);
    pdf.font("Helvetica").fontSize(9).text(lh.bankDetails, left, pdf.y, { width: 300 });
  }

  footer(
    pdf,
    kind === "Invoice" || kind === "Quotation"
      ? `${kind} prepared with myfleet. This is a business document, not a ZIMRA fiscalised tax invoice.`
      : `${kind} prepared with myfleet.`
  );
  pdf.end();
}

// A delivery note carries no prices: it is the proof the goods arrived. It has a signature
// block for the person who receives the goods; a signed copy can be uploaded afterwards.
// `trip` is the plain trip; `refs` = { purchaseOrder, truck, trailer, driver }.
function streamDeliveryNotePdf(res, { trip, refs = {}, company, filename }) {
  const pdf = openPdf(res, filename);
  drawHeader(pdf, company, "Delivery Note", [
    trip.deliveryNoteNo || "",
    `Date: ${day(trip.deliveryNoteDate || trip.deliveredAt || trip.date)}`,
  ]);

  pdf.moveDown(2);
  pdf.fillColor("#000").font("Helvetica-Bold").fontSize(10).text("Delivered to", left);
  pdf.font("Helvetica").text(trip.customerName);

  pdf.moveDown(1);
  const route = (trip.stops || []).map((s) => (s.country ? `${s.place} (${s.country})` : s.place)).join("  >  ");
  const info = [
    ["Route", route],
    ["Goods", trip.cargoDescription],
    ["Purchase order", refs.purchaseOrder],
    ["Job reference", trip.clientRef],
    ["Container no.", trip.containerNo],
    ["Consignment no.", trip.consignmentNo],
    ["Truck", refs.truck],
    ["Trailer", refs.trailer],
    ["Driver", refs.driver],
    ["Loaded on", day(trip.date)],
  ].filter(([, v]) => v);
  info.forEach(([k, v]) => {
    const y0 = pdf.y;
    pdf.font("Helvetica-Bold").fontSize(10).text(k, left, y0, { width: 120 });
    pdf.font("Helvetica").fontSize(10).text(String(v), left + 130, y0, { width: right - left - 130 });
    pdf.y = Math.max(pdf.y, y0 + 14);
    pdf.moveDown(0.3);
  });

  pdf.moveDown(2);
  pdf.font("Helvetica").fontSize(10).text("Received in good order and condition.", left);
  pdf.moveDown(2.5);
  const lineY = pdf.y;
  const block = (label, x, w, yy) => {
    pdf.moveTo(x, yy).lineTo(x + w, yy).strokeColor("#444").stroke();
    pdf.font("Helvetica").fontSize(9).fillColor("#444").text(label, x, yy + 4, { width: w });
  };
  block("Name of receiver", left, 150, lineY);
  block("Signature", left + 175, 150, lineY);
  block("Date", left + 350, 100, lineY);
  const lineY2 = lineY + 55;
  block("Driver signature", left, 150, lineY2);
  block("Company stamp (optional)", left + 175, 150, lineY2);

  footer(pdf, "Delivery note prepared with myfleet.");
  pdf.end();
}

module.exports = { streamDocumentPdf, streamDeliveryNotePdf };

const PDFDocument = require("pdfkit");

const money = (n, currency = "USD") =>
  `${currency === "USD" ? "$" : currency + " "}${Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

// Streams an invoice or quotation as a plain, printable PDF.
// `doc` is the presented (dollar) shape; `kind` is "Invoice" or "Quotation".
function streamDocumentPdf(res, { kind, doc, company, filename }) {
  const pdf = new PDFDocument({ size: "A4", margin: 48 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  pdf.pipe(res);

  const left = 48;
  const right = 547;

  // header
  pdf.fontSize(18).font("Helvetica-Bold").text(company.companyName || "", left, 48);
  pdf.fontSize(9).font("Helvetica").fillColor("#444")
    .text([company.address, company.city].filter(Boolean).join(", "), left, pdf.y)
    .text(company.contact ? `Contact: ${company.contact}` : "", left, pdf.y);
  pdf.fillColor("#000").fontSize(20).font("Helvetica-Bold").text(kind.toUpperCase(), left, 48, { width: right - left, align: "right" });
  pdf.fontSize(10).font("Helvetica")
    .text(doc.number || "DRAFT", { width: right - left, align: "right" })
    .text(`Date: ${day(doc.issueDate)}`, { width: right - left, align: "right" });
  if (kind === "Invoice" && doc.dueDate) pdf.text(`Due: ${day(doc.dueDate)}`, { width: right - left, align: "right" });
  if (kind === "Quotation" && doc.validUntil) pdf.text(`Valid until: ${day(doc.validUntil)}`, { width: right - left, align: "right" });

  pdf.moveDown(2);
  pdf.font("Helvetica-Bold").fontSize(10).text("Bill to", left);
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

  // notes
  pdf.font("Helvetica").fontSize(9);
  const tail = [doc.notes, doc.terms].filter(Boolean).join("\n\n");
  if (tail) pdf.text(tail, left, y + 30, { width: right - left });

  pdf.end();
}

module.exports = { streamDocumentPdf };

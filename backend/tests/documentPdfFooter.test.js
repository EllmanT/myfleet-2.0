// PDF streams are compressed, so this checks what is drawn rather than searching the bytes.
const drawn = [];
jest.mock("pdfkit", () => {
  return jest.fn().mockImplementation(() => {
    const api = {};
    for (const m of ["pipe", "fontSize", "font", "fillColor", "moveDown", "moveTo", "lineTo", "stroke", "strokeColor", "lineWidth", "rect", "fill", "end"]) {
      api[m] = jest.fn(() => api);
    }
    api.y = 100;
    api.heightOfString = jest.fn(() => 12);
    api.addPage = jest.fn(() => api);
    api.text = jest.fn((t, ...rest) => {
      drawn.push({ t: String(t), rest });
      return api;
    });
    return api;
  });
});
const { streamDocumentPdf } = require("../utils/documentPdf");

const res = () => ({ setHeader: jest.fn() });
const doc = { number: "INV-1", issueDate: "2026-11-01", customerName: "Acme", lines: [{ description: "Haul", quantity: 1, unitPrice: 10, amount: 10 }], currency: "USD", status: "issued", total: 10, subtotal: 10, balance: 10 };

describe("invoice and quotation PDFs", () => {
  beforeEach(() => (drawn.length = 0));

  test.each(["Invoice", "Quotation"])("the %s says it is not a fiscalised tax invoice, at the foot of the page", (kind) => {
    streamDocumentPdf(res(), { kind, doc, company: { companyName: "Co" }, filename: "x.pdf" });
    const note = drawn.find((d) => /not a ZIMRA fiscalised tax invoice/.test(d.t));
    expect(note).toBeTruthy();
    expect(note.t).toContain(kind);
    expect(note.rest[1]).toBe(780); // fixed position near the bottom of an A4 page
    expect(note.rest[2].lineBreak).toBe(false); // can never push a second page
  });
});

const Deliverer = require("../model/deliverer");
const { readFile } = require("./fileStorage");

const streamToBuffer = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });

// Everything a printed document needs about the company, including the logo bytes.
// A missing or unreadable logo never stops a document from printing.
async function companyForPdf(companyId) {
  const company = await Deliverer.findById(companyId).select("companyName address city contact letterhead").lean();
  if (!company) return {};
  const out = { ...company };
  const key = company.letterhead && company.letterhead.logo;
  if (key) {
    try {
      const file = await readFile(key);
      if (file) {
        const buf = await streamToBuffer(file.stream);
        // pdfkit draws JPEG and PNG only
        if (/^image\/(jpeg|png)$/.test(file.contentType || "")) out.logoBuffer = buf;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("[letterhead] could not read logo", error.message);
    }
  }
  return out;
}

module.exports = { companyForPdf };

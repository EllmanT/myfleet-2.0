// Phone photos are often 3-8 MB, but the server accepts at most 4 MB per file. This shrinks a
// photo in the browser before it is sent, so the person never has to think about file size.
//
//   - JPG / PNG / WebP: scaled so the longest side is at most 1600 px and saved as JPEG.
//     That is plenty to read an ID number or a licence, and usually well under 500 KB.
//   - PDF: sent as is, but refused if it is over the limit (a PDF cannot be shrunk here).
//
// Returns a File ready to upload, or throws an Error whose message can be shown to the person.

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.82;

const tooBig = () =>
  new Error("That file is too large. Please use one under 4 MB, or take a clearer, smaller photo.");

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as a picture. Choose a JPG, PNG, WebP or PDF."));
    };
    img.src = url;
  });
}

export async function shrinkForUpload(file) {
  if (!file) return null;

  if (file.type === "application/pdf") {
    if (file.size > MAX_UPLOAD_BYTES) throw tooBig();
    return file;
  }
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error("Choose a JPG, PNG, WebP or PDF file.");
  }

  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  // JPEG has no transparency; paint white first so a transparent PNG does not turn black
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  // keep the original if shrinking somehow made it bigger and it is already small enough
  const best = blob && blob.size < file.size ? blob : file.size <= MAX_UPLOAD_BYTES ? file : blob;
  if (!best || best.size > MAX_UPLOAD_BYTES) throw tooBig();
  if (best === file) return file;

  const baseName = (file.name || "photo").replace(/\.[^.]+$/, "");
  return new File([best], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

export const formatSize = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

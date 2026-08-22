/**
 * Turn a picked image file into a downscaled data URL.
 *
 * Journal photos live on the foster document (Firestore caps a document at 1MB, and
 * LOCAL_MODE keeps the whole foster in localStorage), so a 4MB phone photo can't go in as-is.
 * We redraw it through a canvas at a display-sized bound and re-encode as JPEG, which lands a
 * typical photo around 30–60KB — small enough that a foster can log one most days.
 */
/** ~70KB of base64, so a foster gets a dozen-plus photos inside a 1MB Firestore document. */
const MAX_CHARS = 70_000;

export async function fileToDataUrl(
  file: File,
  maxPx = 560,
  quality = 0.7,
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Every photo shares one document's budget, so step the quality down rather than let a
  // detailed shot eat the room the next few entries need.
  let out = canvas.toDataURL("image/jpeg", quality);
  for (let q = quality - 0.15; out.length > MAX_CHARS && q >= 0.35; q -= 0.15) {
    out = canvas.toDataURL("image/jpeg", q);
  }
  return out;
}

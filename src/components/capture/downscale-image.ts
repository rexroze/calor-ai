/**
 * Client-side photo preparation for the vision model.
 *
 * Analysis pipeline (mirrors the previously proven behavior):
 * - Files ≤300KB go through BIT-EXACT when possible — no canvas re-encode,
 *   preserving the texture detail downscaling destroys (the pork-chop/duck
 *   class of misidentifications).
 * - Larger files are downscaled to longest edge ≤1280px, JPEG q0.82.
 * - Files whose canvas decode fails (HEIC on non-Safari, exotica) fall back
 *   to sending the ORIGINAL bytes with a best-effort sniffed media type so
 *   the model still gets a chance — only a server failure surfaces to users.
 * - JPEGs carrying non-trivial EXIF rotation skip the passthrough so the
 *   orientation is baked in by the re-encode (decoders apply it).
 *
 * A separate small thumbnail (320px, q0.65 — see capture-flow) is produced
 * for meal-photo storage; that path is independent of this module.
 */

const ANALYSIS_MAX_EDGE = 1280;
const ANALYSIS_JPEG_QUALITY = 0.82;
/** Originals at or under this size skip the canvas entirely. */
const PASSTHROUGH_MAX_BYTES = 300 * 1024;

export type PreparedAnalysisImage = {
  /** Data URL with an accurate mime prefix, ready for the vision model. */
  dataUrl: string;
  /** Raw base64 payload without the data-URL prefix. */
  base64: string;
  /** Best-effort detected media type (magic bytes → declared type → octet-stream). */
  mediaType: string;
  /** True when the original file bytes were sent untouched. */
  passthrough: boolean;
};

type DecodedImage = ImageBitmap | HTMLImageElement;

function dimensions(img: DecodedImage): { width: number; height: number } {
  if (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) {
    return { width: img.width, height: img.height };
  }
  const el = img as HTMLImageElement;
  return {
    width: el.naturalWidth || el.width,
    height: el.naturalHeight || el.height,
  };
}

async function decode(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      // Honor EXIF orientation where the browser supports it.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall through to the <img> path below.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("PHOTO_DECODE_FAILED"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function release(img: DecodedImage): void {
  if (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) {
    img.close();
  }
}

/** Canvas re-encode to a JPEG data URL capped at `maxEdge` longest edge. */
function encodeResizedJpeg(
  img: DecodedImage,
  maxEdge: number,
  quality: number,
): string {
  const { width, height } = dimensions(img);
  if (width < 1 || height < 1) {
    throw new Error("PHOTO_DECODE_FAILED");
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("PHOTO_ENCODE_FAILED");
  ctx.drawImage(img, 0, 0, w, h);

  return canvas.toDataURL("image/jpeg", quality);
}

/** Legacy entry point: always decode + resize to the analysis parameters. */
export async function downscaleToJpegDataUrl(file: File): Promise<string> {
  const img = await decode(file);
  try {
    return encodeResizedJpeg(img, ANALYSIS_MAX_EDGE, ANALYSIS_JPEG_QUALITY);
  } finally {
    release(img);
  }
}

// ---------------------------------------------------------------------------
// Magic-byte sniffing — the picked File's `type` is often empty or wrong
// (iOS gallery HEIC, some Android pickers), and the model benefits from an
// honest media type when we ship original bytes.
// ---------------------------------------------------------------------------

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = "";
  for (let i = start; i < Math.min(start + length, bytes.length); i += 1) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

/** Best-effort image media type from magic bytes, falling back to file.type. */
export async function sniffImageMediaType(file: File): Promise<string> {
  try {
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());

    if (
      bytes.length >= 3 &&
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    ) {
      return "image/jpeg";
    }
    if (
      bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e &&
      bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a &&
      bytes[6] === 0x1a && bytes[7] === 0x0a
    ) {
      return "image/png";
    }
    if (bytes.length >= 6 && ascii(bytes, 0, 3) === "GIF") {
      return "image/gif";
    }
    if (
      bytes.length >= 12 &&
      ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP"
    ) {
      return "image/webp";
    }
    if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
      switch (ascii(bytes, 8, 4)) {
        case "heic":
        case "heix":
          return "image/heic";
        case "hevc":
        case "hevx":
        case "msf1":
          return "image/heic-sequence";
        case "mif1":
          return "image/heif";
        case "avif":
        case "avis":
          return "image/avif";
        default:
          break;
      }
    }
  } catch {
    // Slice/arrayBuffer failures are unexpected; fall through to file.type.
  }

  const declared = file.type;
  return declared.startsWith("image/") ? declared : "application/octet-stream";
}

// ---------------------------------------------------------------------------
// EXIF orientation (JPEG only). Passthrough is allowed only when orientation
// is normal (1) or undetectable — a rotated original must be re-encoded so
// the stored/analyzed pixels are upright.
// ---------------------------------------------------------------------------

function readOrientation(view: DataView, tiffStart: number): number | null {
  if (tiffStart + 8 > view.byteLength) return null;
  const byteOrder = view.getUint16(tiffStart);
  const little = byteOrder === 0x4949; // "II"; big-endian is "MM"
  if (!little && byteOrder !== 0x4d4d) return null;

  const ifdOffset = tiffStart + view.getUint32(tiffStart + 4, little);
  if (ifdOffset + 2 > view.byteLength) return null;
  const entries = view.getUint16(ifdOffset, little);

  for (let i = 0; i < entries; i += 1) {
    const entry = ifdOffset + 2 + i * 12;
    if (entry + 12 > view.byteLength) return null;
    if (view.getUint16(entry, little) === 0x0112) {
      const value = view.getUint16(entry + 8, little);
      return value >= 1 && value <= 8 ? value : null;
    }
  }
  return null;
}

/** JPEG APP1/Exif orientation (1–8), or null when absent/unparseable. */
export async function jpegExifOrientation(file: File): Promise<number | null> {
  try {
    // EXIF lives in APP1 right after SOI; 144KB covers every real-world shot.
    const head = new DataView(await file.slice(0, 144 * 1024).arrayBuffer());
    if (head.byteLength < 4 || head.getUint16(0) !== 0xffd8) return null;

    let offset = 2;
    while (offset + 4 <= head.byteLength) {
      if (head.getUint8(offset) !== 0xff) return null;
      const marker = head.getUint8(offset + 1);

      // Standalone markers carry no length field.
      if (
        marker === 0xd8 || marker === 0x01 ||
        (marker >= 0xd0 && marker <= 0xd7)
      ) {
        offset += 2;
        continue;
      }
      if (marker === 0xda) break; // start of scan — EXIF must be behind us

      const segmentLength = head.getUint16(offset + 2);
      if (marker === 0xe1) {
        const sig = offset + 4;
        if (
          sig + 6 <= head.byteLength &&
          head.getUint32(sig) === 0x45786966 && // "Exif"
          head.getUint16(sig + 4) === 0 // trailing NULs
        ) {
          return readOrientation(head, sig + 6);
        }
      }
      offset += 2 + segmentLength;
    }
  } catch {
    // Truncated/partial reads: treat as undetectable (passthrough-friendly).
  }
  return null;
}

// ---------------------------------------------------------------------------
// Analysis preparation
// ---------------------------------------------------------------------------

/** Reads a blob as a data URL, preserving its exact bytes. */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("PHOTO_READ_FAILED"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Ship the ORIGINAL bytes under the sniffed type — used both for small
 * healthy files (bit-exact detail) and undecodable ones (HEIC et al.).
 */
async function passthroughOriginal(
  file: File,
  mediaType: string,
): Promise<PreparedAnalysisImage> {
  const dataUrl = await blobToDataUrl(new Blob([file], { type: mediaType }));
  return {
    dataUrl,
    base64: base64FromDataUrl(dataUrl),
    mediaType,
    passthrough: true,
  };
}

/**
 * Prepare a picked photo for the vision model. Never throws except when the
 * original bytes themselves cannot even be read back for passthrough.
 */
export async function prepareAnalysisImage(
  file: File,
): Promise<PreparedAnalysisImage> {
  const mediaType = await sniffImageMediaType(file);

  // Rotated JPEGs must go through the canvas so orientation gets baked in.
  const orientation =
    mediaType === "image/jpeg" ? await jpegExifOrientation(file) : null;
  const needsRotation = orientation !== null && orientation !== 1;

  let img: DecodedImage | null = null;
  try {
    img = await decode(file);
  } catch {
    img = null; // handled by the raw-bytes fallback below
  }

  if (img) {
    if (!needsRotation && file.size <= PASSTHROUGH_MAX_BYTES) {
      release(img);
      return passthroughOriginal(file, mediaType);
    }
    try {
      const dataUrl = encodeResizedJpeg(
        img,
        ANALYSIS_MAX_EDGE,
        ANALYSIS_JPEG_QUALITY,
      );
      release(img);
      return {
        dataUrl,
        base64: base64FromDataUrl(dataUrl),
        mediaType: "image/jpeg",
        passthrough: false,
      };
    } catch {
      release(img);
      // Encode failed — degrade to original bytes below.
    }
  }

  return passthroughOriginal(file, mediaType);
}

/** Strips the `data:…;base64,` prefix, leaving raw base64. */
export function base64FromDataUrl(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(",");
  return commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1);
}

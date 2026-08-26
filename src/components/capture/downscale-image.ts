/**
 * Client-side photo preparation for the vision model: decode a picked file,
 * downscale so the longest edge is ~1024px, and re-encode as JPEG. Smaller
 * uploads mean faster analysis and no server-side image work.
 */

const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.82;

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

/** Returns a JPEG data URL whose longest edge is at most ~1024px. */
export async function downscaleToJpegDataUrl(file: File): Promise<string> {
  const img = await decode(file);
  const { width, height } = dimensions(img);
  if (width < 1 || height < 1) {
    throw new Error("PHOTO_DECODE_FAILED");
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("PHOTO_DECODE_FAILED");
  ctx.drawImage(img, 0, 0, w, h);

  if (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) {
    img.close();
  }

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

/** Strips the `data:image/jpeg;base64,` prefix, leaving raw base64. */
export function base64FromDataUrl(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(",");
  return commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1);
}

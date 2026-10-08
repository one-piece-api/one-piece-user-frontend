/**
 * The checks an image file must pass before it is sent - the backend's own (plan D6), in
 * its order and with its error codes and numbers, so a refusal reads the same whether the
 * browser or the backend found it. The cheap ones first; only a file that passes them is
 * decoded, to count its transparent pixels. The backend stays the authority.
 */
import type { ImageProfile } from './entity-definition';

/** Why an image is refused: the backend's `errorCode`s for its `422` on `image`. */
export const IMAGE_REFUSALS = [
  'CONTENT_IMAGE_FORMAT_UNSUPPORTED',
  'CONTENT_IMAGE_NOT_TRANSPARENT',
  'CONTENT_IMAGE_WRONG_RATIO',
  'CONTENT_IMAGE_TOO_SMALL',
  'CONTENT_IMAGE_TOO_LARGE',
] as const;

export type ImageRefusalCode = (typeof IMAGE_REFUSALS)[number];

/** A refusal and the numbers that explain it, named as in the backend's error details. */
export interface ImageRefusal {
  readonly code: ImageRefusalCode;
  readonly numbers: Readonly<Record<string, number>>;
}

/** The pixels of an image, four bytes each (red, green, blue, alpha). */
export type PixelReader = (file: File) => Promise<Uint8ClampedArray>;

/** The eight bytes every PNG starts with. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** Signature, then the first chunk (`IHDR`): its width and height end at byte 24. */
const PNG_HEADER_BYTES = 24;
const WIDTH_OFFSET = 16;
const HEIGHT_OFFSET = 20;
const BYTES_PER_PIXEL = 4;
const ALPHA_OFFSET = 3;

/**
 * Why `file` is refused under `profile`, or `null` when it may be sent. `readPixels` decodes
 * the image - the browser's own by default, a stand-in in the specs.
 */
export async function checkImage(
  file: File,
  profile: ImageProfile,
  readPixels: PixelReader = browserPixels,
): Promise<ImageRefusal | null> {
  const tooLarge = sizeRefusal(file.size, profile);
  if (tooLarge) {
    return tooLarge;
  }
  const size = pngSizeOf(new Uint8Array(await file.slice(0, PNG_HEADER_BYTES).arrayBuffer()));
  if (!size) {
    return { code: 'CONTENT_IMAGE_FORMAT_UNSUPPORTED', numbers: {} };
  }
  const wrongSize = dimensionRefusal(size.width, size.height, profile);
  if (wrongSize) {
    return wrongSize;
  }
  try {
    return transparencyRefusal(await readPixels(file), profile);
  } catch {
    return { code: 'CONTENT_IMAGE_FORMAT_UNSUPPORTED', numbers: {} };
  }
}

export function sizeRefusal(sizeBytes: number, profile: ImageProfile): ImageRefusal | null {
  return sizeBytes > profile.maxBytes
    ? { code: 'CONTENT_IMAGE_TOO_LARGE', numbers: { sizeBytes, maxBytes: profile.maxBytes } }
    : null;
}

/** The width and height a PNG's header declares - `null` for a file that is not a PNG. */
export function pngSizeOf(header: Uint8Array): { width: number; height: number } | null {
  if (
    header.length < PNG_HEADER_BYTES ||
    PNG_SIGNATURE.some((byte, index) => header[index] !== byte)
  ) {
    return null;
  }
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  return { width: view.getUint32(WIDTH_OFFSET), height: view.getUint32(HEIGHT_OFFSET) };
}

/** Too many pixels, too small, then too far from the canvas' ratio - read before decoding. */
export function dimensionRefusal(
  width: number,
  height: number,
  profile: ImageProfile,
): ImageRefusal | null {
  if (width * height > profile.maxPixels) {
    return {
      code: 'CONTENT_IMAGE_TOO_LARGE',
      numbers: { width, height, maxPixels: profile.maxPixels },
    };
  }
  if (width < profile.width || height < profile.height) {
    return {
      code: 'CONTENT_IMAGE_TOO_SMALL',
      numbers: { width, height, minWidth: profile.width, minHeight: profile.height },
    };
  }
  const offBy = Math.abs(width / height / (profile.width / profile.height) - 1);
  if (offBy > profile.ratioTolerance) {
    const divisor = greatestCommonDivisor(profile.width, profile.height);
    return {
      code: 'CONTENT_IMAGE_WRONG_RATIO',
      numbers: {
        width,
        height,
        ratioWidth: profile.width / divisor,
        ratioHeight: profile.height / divisor,
        tolerancePercent: Math.round(profile.ratioTolerance * 100),
      },
    };
  }
  return null;
}

/** Refused when less than the profile's share of the pixels is fully transparent. */
export function transparencyRefusal(
  pixels: Uint8ClampedArray,
  profile: ImageProfile,
): ImageRefusal | null {
  const total = pixels.length / BYTES_PER_PIXEL;
  let transparent = 0;
  for (let alpha = ALPHA_OFFSET; alpha < pixels.length; alpha += BYTES_PER_PIXEL) {
    if (pixels[alpha] === 0) {
      transparent++;
    }
  }
  return total === 0 || transparent * 100 < total * profile.minTransparentPercent
    ? {
        code: 'CONTENT_IMAGE_NOT_TRANSPARENT',
        numbers: {
          transparentPercent: total === 0 ? 0 : Math.floor((transparent * 100) / total),
          minPercent: profile.minTransparentPercent,
        },
      }
    : null;
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

/** Decodes the file in the browser and reads its pixels from a canvas of its own size. */
async function browserPixels(file: File): Promise<Uint8ClampedArray> {
  const bitmap = await createImageBitmap(file, { premultiplyAlpha: 'none' });
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('No 2D context');
    }
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
  } finally {
    bitmap.close();
  }
}

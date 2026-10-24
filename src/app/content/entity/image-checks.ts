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
/** RIFF header (12 bytes), first chunk header (8), then the image's own header: sizes end at byte 30. */
const WEBP_HEADER_BYTES = 30;
/** Where the first chunk's data starts. */
const WEBP_DATA = 20;
/** `VP8X`: its flags byte holds the animation bit. */
const WEBP_ANIMATION_FLAG = 0x02;
/** `VP8L`: one signature byte, then the sizes in 14 bits each, minus one. */
const VP8L_SIGNATURE = 0x2f;
const FOURTEEN_BITS = 0x3fff;
/** `VP8 `: the key frame's start code, then the sizes in 14 bits (the top two are a scale). */
const VP8_START_CODE = [0x9d, 0x01, 0x2a];
/** The longest header the checks read before decoding. */
const HEADER_BYTES = Math.max(PNG_HEADER_BYTES, WEBP_HEADER_BYTES);
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
  const size = imageSizeOf(new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer()));
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

/**
 * The width and height a static PNG or WebP declares (the backend's formats) - `null` for
 * any other file, an animated WebP included.
 */
export function imageSizeOf(header: Uint8Array): { width: number; height: number } | null {
  return pngSizeOf(header) ?? webpSizeOf(header);
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

/**
 * The width and height a static WebP declares (RFC 9649): the first chunk is the lossy
 * (`VP8 `) or lossless (`VP8L`) image, or the extended header (`VP8X`) without its
 * animation flag. `null` for anything else.
 */
export function webpSizeOf(header: Uint8Array): { width: number; height: number } | null {
  if (
    header.length < WEBP_HEADER_BYTES ||
    ascii(header, 0, 4) !== 'RIFF' ||
    ascii(header, 8, 4) !== 'WEBP'
  ) {
    return null;
  }
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  switch (ascii(header, 12, 4)) {
    case 'VP8 ':
      return VP8_START_CODE.every((byte, index) => header[WEBP_DATA + 3 + index] === byte)
        ? {
            width: view.getUint16(WEBP_DATA + 6, true) & FOURTEEN_BITS,
            height: view.getUint16(WEBP_DATA + 8, true) & FOURTEEN_BITS,
          }
        : null;
    case 'VP8L': {
      if (header[WEBP_DATA] !== VP8L_SIGNATURE) {
        return null;
      }
      const sizes = view.getUint32(WEBP_DATA + 1, true);
      return { width: (sizes & FOURTEEN_BITS) + 1, height: ((sizes >>> 14) & FOURTEEN_BITS) + 1 };
    }
    case 'VP8X':
      return header[WEBP_DATA] & WEBP_ANIMATION_FLAG
        ? null
        : { width: uint24(header, WEBP_DATA + 4) + 1, height: uint24(header, WEBP_DATA + 7) + 1 };
    default:
      return null;
  }
}

/** Too many pixels, too small (the profile's minimum, else its canvas), then too far from the canvas' ratio - read before decoding. */
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
  const minWidth = profile.minWidth ?? profile.width;
  const minHeight = profile.minHeight ?? profile.height;
  if (width < minWidth || height < minHeight) {
    return { code: 'CONTENT_IMAGE_TOO_SMALL', numbers: { width, height, minWidth, minHeight } };
  }
  const offBy = Math.abs(width / height / (profile.width / profile.height) - 1);
  if (offBy > profile.ratioTolerance) {
    const { ratioWidth, ratioHeight } = simplestRatio(profile);
    return {
      code: 'CONTENT_IMAGE_WRONG_RATIO',
      numbers: {
        width,
        height,
        ratioWidth,
        ratioHeight,
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

/** The profile's ratio in its smallest whole numbers: 420 × 600 is 7:10. */
export function simplestRatio(profile: ImageProfile): { ratioWidth: number; ratioHeight: number } {
  const divisor = greatestCommonDivisor(profile.width, profile.height);
  return { ratioWidth: profile.width / divisor, ratioHeight: profile.height / divisor };
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

/** A little-endian 24-bit number. */
function uint24(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
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

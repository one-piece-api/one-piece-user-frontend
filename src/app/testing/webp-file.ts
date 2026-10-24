/**
 * WebP files for the specs, like `png-file.ts`: only the start of the file - the RIFF header,
 * the first chunk and the image's own header declaring a size - which is all the checks read
 * before decoding. Layouts from RFC 9649.
 */

/** Lossy (`VP8 `), lossless (`VP8L`), extended (`VP8X`) or extended and animated. */
export type WebpKind = 'lossy' | 'lossless' | 'extended' | 'animated';

const HEADER_BYTES = 30;
const DATA = 20;

/** The first 30 bytes of a WebP declaring `width` × `height`, then `extra` bytes of nothing. */
export function webpHeader(kind: WebpKind, width: number, height: number, extra = 0): Uint8Array {
  const bytes = new Uint8Array(HEADER_BYTES + extra);
  const view = new DataView(bytes.buffer);
  ascii(bytes, 0, 'RIFF');
  view.setUint32(4, bytes.length - 8, true);
  ascii(bytes, 8, 'WEBP');
  switch (kind) {
    case 'lossy':
      ascii(bytes, 12, 'VP8 ');
      bytes.set([0x9d, 0x01, 0x2a], DATA + 3);
      view.setUint16(DATA + 6, width, true);
      view.setUint16(DATA + 8, height, true);
      break;
    case 'lossless':
      ascii(bytes, 12, 'VP8L');
      bytes[DATA] = 0x2f;
      view.setUint32(DATA + 1, (width - 1) | ((height - 1) << 14), true);
      break;
    case 'extended':
    case 'animated':
      ascii(bytes, 12, 'VP8X');
      bytes[DATA] = kind === 'animated' ? 0x02 : 0x10;
      setUint24(bytes, DATA + 4, width - 1);
      setUint24(bytes, DATA + 7, height - 1);
      break;
  }
  return bytes;
}

export function webpFile(
  width: number,
  height: number,
  kind: WebpKind = 'lossy',
  name = 'fruit.webp',
): File {
  return new File([webpHeader(kind, width, height) as BlobPart], name, { type: 'image/webp' });
}

function ascii(bytes: Uint8Array, offset: number, text: string): void {
  bytes.set(
    Array.from(text, (char) => char.charCodeAt(0)),
    offset,
  );
}

function setUint24(bytes: Uint8Array, offset: number, value: number): void {
  bytes.set([value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff], offset);
}

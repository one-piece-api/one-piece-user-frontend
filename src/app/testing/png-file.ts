/**
 * Image files for the specs: only the start of a PNG - its signature and a header declaring
 * a size - which is all the checks read before decoding. The pixels come from a stand-in.
 */

/** The first 24 bytes of a PNG declaring `width` × `height`, then `extra` bytes of nothing. */
export function pngHeader(width: number, height: number, extra = 0): Uint8Array {
  const bytes = new Uint8Array(24 + extra);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

export function pngFile(width: number, height: number, name = 'fruit.png', extra = 0): File {
  return new File([pngHeader(width, height, extra) as BlobPart], name, { type: 'image/png' });
}

/** `count` pixels, of which `transparent` have alpha 0 and the others are opaque. */
export function pixels(count: number, transparent: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(count * 4);
  for (let pixel = 0; pixel < count; pixel++) {
    data[pixel * 4 + 3] = pixel < transparent ? 0 : 255;
  }
  return data;
}

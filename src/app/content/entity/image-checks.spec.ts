import type { ImageProfile } from './entity-definition';
import {
  checkImage,
  dimensionRefusal,
  pngSizeOf,
  sizeRefusal,
  transparencyRefusal,
} from './image-checks';
import { pixels, pngFile, pngHeader } from '../../testing/png-file';

/** The Devil Fruit's profile, as the backend configures it. */
const PROFILE: ImageProfile = {
  width: 640,
  height: 800,
  ratioTolerance: 0.1,
  maxBytes: 5 * 1024 * 1024,
  maxPixels: 25_000_000,
  minTransparentPercent: 5,
};

describe('the checks of an image before it is sent', () => {
  it('refuses a file larger than the profile allows, with both sizes', () => {
    expect(sizeRefusal(PROFILE.maxBytes + 1, PROFILE)).toEqual({
      code: 'CONTENT_IMAGE_TOO_LARGE',
      numbers: { sizeBytes: PROFILE.maxBytes + 1, maxBytes: PROFILE.maxBytes },
    });
    expect(sizeRefusal(PROFILE.maxBytes, PROFILE)).toBeNull();
  });

  it('reads the size a PNG declares, and nothing from another file', () => {
    expect(pngSizeOf(pngHeader(640, 800))).toEqual({ width: 640, height: 800 });
    const jpeg = pngHeader(640, 800);
    jpeg.set([0xff, 0xd8, 0xff]);
    expect(pngSizeOf(jpeg)).toBeNull();
    expect(pngSizeOf(new Uint8Array(8))).toBeNull();
  });

  it('refuses too many pixels before anything else about the size', () => {
    expect(dimensionRefusal(5000, 6000, PROFILE)).toEqual({
      code: 'CONTENT_IMAGE_TOO_LARGE',
      numbers: { width: 5000, height: 6000, maxPixels: 25_000_000 },
    });
  });

  it('refuses an image smaller than the canvas - it is never enlarged', () => {
    expect(dimensionRefusal(600, 750, PROFILE)).toEqual({
      code: 'CONTENT_IMAGE_TOO_SMALL',
      numbers: { width: 600, height: 750, minWidth: 640, minHeight: 800 },
    });
  });

  it('accepts a ratio within the tolerance and refuses one beyond, as the smallest ratio', () => {
    expect(dimensionRefusal(1280, 1600, PROFILE)).toBeNull();
    expect(dimensionRefusal(700, 800, PROFILE)).toBeNull();
    expect(dimensionRefusal(1000, 1000, PROFILE)).toEqual({
      code: 'CONTENT_IMAGE_WRONG_RATIO',
      numbers: { width: 1000, height: 1000, ratioWidth: 4, ratioHeight: 5, tolerancePercent: 10 },
    });
  });

  it('asks for the share of fully transparent pixels the profile sets', () => {
    expect(transparencyRefusal(pixels(100, 5), PROFILE)).toBeNull();
    expect(transparencyRefusal(pixels(100, 4), PROFILE)).toEqual({
      code: 'CONTENT_IMAGE_NOT_TRANSPARENT',
      numbers: { transparentPercent: 4, minPercent: 5 },
    });
  });

  describe('on a file', () => {
    it('lets through a transparent PNG of the right size', async () => {
      const readPixels = vi.fn(async () => pixels(10, 5));

      expect(await checkImage(pngFile(640, 800), PROFILE, readPixels)).toBeNull();
      expect(readPixels).toHaveBeenCalledOnce();
    });

    it('refuses a file that is not a PNG whatever its name says, without decoding it', async () => {
      const readPixels = vi.fn(async () => pixels(10, 5));
      const notPng = new File(['<svg/>'.padEnd(30)], 'fruit.png', { type: 'image/png' });

      expect(await checkImage(notPng, PROFILE, readPixels)).toEqual({
        code: 'CONTENT_IMAGE_FORMAT_UNSUPPORTED',
        numbers: {},
      });
      expect(readPixels).not.toHaveBeenCalled();
    });

    it('refuses a wrong size from the header, without decoding it', async () => {
      const readPixels = vi.fn(async () => pixels(10, 5));

      expect((await checkImage(pngFile(800, 800), PROFILE, readPixels))?.code).toBe(
        'CONTENT_IMAGE_WRONG_RATIO',
      );
      expect(readPixels).not.toHaveBeenCalled();
    });

    it('refuses a file too heavy before reading it', async () => {
      const small = { ...PROFILE, maxBytes: 10 };

      expect((await checkImage(pngFile(640, 800), small))?.code).toBe('CONTENT_IMAGE_TOO_LARGE');
    });

    it('refuses an opaque image, and one the browser cannot decode', async () => {
      expect((await checkImage(pngFile(640, 800), PROFILE, async () => pixels(10, 0)))?.code).toBe(
        'CONTENT_IMAGE_NOT_TRANSPARENT',
      );
      expect(
        (await checkImage(pngFile(640, 800), PROFILE, () => Promise.reject(new Error('broken'))))
          ?.code,
      ).toBe('CONTENT_IMAGE_FORMAT_UNSUPPORTED');
    });
  });
});

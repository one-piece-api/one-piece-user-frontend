import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { imageProblemOf, imageProblemWords } from './image-words';

function refused(status: number, body: object): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body });
}

describe('the words for a refused image', () => {
  let transloco: TranslocoService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [provideTranslocoTesting()] });
    transloco = TestBed.inject(TranslocoService);
  });

  it('reads a refusal of the backend with the numbers of its details', () => {
    const error = refused(422, {
      status: 422,
      errorCode: 'CONTENT_IMAGE_TOO_SMALL',
      detail: 'The image is too small',
      field: 'image',
      width: 600,
      height: 750,
      minWidth: 640,
      minHeight: 800,
    });

    expect(imageProblemOf(error)).toEqual({
      code: 'CONTENT_IMAGE_TOO_SMALL',
      numbers: { width: 600, height: 750, minWidth: 640, minHeight: 800 },
    });
  });

  it('reads the cut-off of an upload beyond the limit as a refused image', () => {
    const error = refused(413, { status: 413, errorCode: 'CONTENT_TOO_LARGE', maxBytes: 10485760 });

    expect(imageProblemOf(error)).toEqual({
      code: 'CONTENT_TOO_LARGE',
      numbers: { maxBytes: 10485760 },
    });
  });

  it('leaves out every other failure', () => {
    expect(imageProblemOf(refused(422, { errorCode: 'CONTENT_VALUE_INVALID' }))).toBeNull();
    expect(imageProblemOf(new Error('offline'))).toBeNull();
  });

  it('says what is wrong with the numbers, in the language on screen', () => {
    const small = {
      code: 'CONTENT_IMAGE_TOO_SMALL',
      numbers: { width: 600, height: 750, minWidth: 640, minHeight: 800 },
    } as const;

    expect(imageProblemWords(transloco, small)).toBe(
      'The image is 600 × 750: it must be at least 640 × 800.',
    );
    transloco.setActiveLang('it');
    expect(imageProblemWords(transloco, small)).toBe(
      "L'immagine è 600 × 750: ne serve una di almeno 640 × 800.",
    );
  });

  it('gives sizes in megabytes and tells too many pixels from too many bytes', () => {
    expect(
      imageProblemWords(transloco, {
        code: 'CONTENT_IMAGE_TOO_LARGE',
        numbers: { sizeBytes: 6 * 1024 * 1024, maxBytes: 5 * 1024 * 1024 },
      }),
    ).toBe('The file is 6 MB: the most is 5 MB.');
    expect(
      imageProblemWords(transloco, {
        code: 'CONTENT_IMAGE_TOO_LARGE',
        numbers: { width: 5000, height: 6000, maxPixels: 25_000_000 },
      }),
    ).toBe('The image is 5000 × 6000: too many pixels, the most is 25 megapixels.');
  });
});

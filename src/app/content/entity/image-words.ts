import { HttpErrorResponse } from '@angular/common/http';
import type { TranslocoService } from '@jsverse/transloco';
import { apiErrorOf } from '../../shared/http/api-error';
import { IMAGE_REFUSALS, type ImageRefusalCode } from './image-checks';

/** What the backend answers to an upload beyond its multipart limit, before any check. */
const UPLOAD_TOO_LARGE = 'CONTENT_TOO_LARGE';

/** A refusal of an image, from the browser's checks or from the backend - worded the same. */
export interface ImageProblem {
  readonly code: ImageRefusalCode | typeof UPLOAD_TOO_LARGE;
  readonly numbers: Readonly<Record<string, number>>;
}

const BYTES_PER_MEGABYTE = 1024 * 1024;
const PIXELS_PER_MEGAPIXEL = 1_000_000;

/**
 * The refusal of an image a failed save carries - a `422` on `image`, or the `413` of a file
 * beyond the upload limit - with the numbers of its details; `null` for any other failure.
 */
export function imageProblemOf(error: unknown): ImageProblem | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const code = apiErrorOf(error)?.errorCode;
  if (code !== UPLOAD_TOO_LARGE && !IMAGE_REFUSALS.includes(code as ImageRefusalCode)) {
    return null;
  }
  const details = error.error as Record<string, unknown>;
  const numbers = Object.fromEntries(
    Object.entries(details).filter(([, value]) => typeof value === 'number'),
  ) as Record<string, number>;
  delete numbers['status'];
  return { code: code as ImageProblem['code'], numbers };
}

/**
 * What to tell the uploader, with the numbers: "600 × 750: it must be at least 640 × 800".
 * The bytes in megabytes, the pixels in megapixels. An Adapter between the backend's
 * details and the page, as `block-words.ts` is for the workflow.
 */
export function imageProblemWords(transloco: TranslocoService, problem: ImageProblem): string {
  const { numbers } = problem;
  const megabytes = (bytes: number | undefined) =>
    bytes === undefined
      ? ''
      : (bytes / BYTES_PER_MEGABYTE).toLocaleString(transloco.getActiveLang(), {
          maximumFractionDigits: 1,
        });
  const variant =
    problem.code === 'CONTENT_IMAGE_TOO_LARGE' && 'maxPixels' in numbers ? 'PIXELS' : problem.code;
  return transloco.translate(`content.image.refused.${variant}`, {
    ...numbers,
    sizeMegabytes: megabytes(numbers['sizeBytes']),
    maxMegabytes: megabytes(numbers['maxBytes']),
    maxMegapixels: (numbers['maxPixels'] ?? 0) / PIXELS_PER_MEGAPIXEL,
  });
}

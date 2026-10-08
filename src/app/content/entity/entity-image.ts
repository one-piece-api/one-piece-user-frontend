/**
 * The image of a version, as the API shows it and as the editor holds it. No Angular in
 * here, so each function is testable on its own.
 */

/** An image saved with a version: its id is the SHA-256 of its bytes, its URL where to show it. */
export interface ImageReference {
  readonly id: string;
  readonly url: string;
}

/**
 * The image of a draft being written: the one already saved, kept as it is, or a file just
 * chosen - with `preview`, an object URL the browser shows it from until it is sent. `null`
 * in the draft means no image.
 */
export type ImageDraft =
  { readonly saved: ImageReference } | { readonly chosen: File; readonly preview: string };

/** Whether a value read from the API is a saved image, not an absent one. */
export function isImageReference(value: unknown): value is ImageReference {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { url?: unknown }).url === 'string'
  );
}

/** Whether a value held by the editor is an image, saved or chosen. */
export function isImageDraft(value: unknown): value is ImageDraft {
  return (
    typeof value === 'object' &&
    value !== null &&
    (isImageReference((value as { saved?: unknown }).saved) ||
      (value as { chosen?: unknown }).chosen instanceof File)
  );
}

/** The file chosen in the editor and not sent yet - `null` when the image is kept or absent. */
export function chosenFileOf(value: unknown): File | null {
  return isImageDraft(value) && 'chosen' in value ? value.chosen : null;
}

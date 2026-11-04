/**
 * The preview of a version at a reader position (reveals plan R6 and R9; UF-CNT-23): the shapes
 * the backend answers and the choices the Preview tab keeps in the URL. No Angular in here.
 */
import type { ImageReference } from './entity-image';

/** The two axes of the reader: the manga counts in chapters, the anime in episodes. */
export const AXES = ['chapter', 'episode'] as const;
export type Axis = (typeof AXES)[number];

/** A position on the reader axis: chapter or episode `number`. */
export interface ReaderPosition {
  readonly axis: Axis;
  readonly number: number;
}

/** Why the backend hides an entry the editor may expect (`HiddenReason`). */
export type HiddenReason = 'TARGET_NOT_VISIBLE' | 'TARGET_NOT_ONLINE' | 'NOT_ON_AXIS';

/** An entry the preview hides for a reason the editor may not expect. */
export interface HiddenEntry {
  readonly path: string;
  readonly reason: HiddenReason;
  readonly visibleFrom: number | null;
}

/** What `GET .../versions/{n}/preview` answers: the version body resolved at the position. */
export interface Preview<B> {
  readonly asOf: { readonly axis: 'CHAPTER' | 'EPISODE'; readonly number: number };
  readonly visible: boolean;
  readonly body: B | null;
  readonly mainPortrait: ImageReference | null;
  readonly hiddenEntries: readonly HiddenEntry[];
}

/** The query parameter the backend reads for each axis. */
const QUERY_PARAMETER: Record<Axis, string> = {
  chapter: 'asOfChapter',
  episode: 'asOfEpisode',
};

/** The axis the URL names, `null` for anything else. */
export function axisOf(value: string | null | undefined): Axis | null {
  return AXES.find((axis) => axis === value) ?? null;
}

/** The whole number the text holds, 1 or more - as the backend asks - else `null`. */
export function positionNumberOf(value: string | number | null | undefined): number | null {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) {
    return null;
  }
  const number = Number(text);
  return Number.isSafeInteger(number) && number >= 1 ? number : null;
}

/** The position the URL holds, `null` unless both parts are valid. */
export function positionOf(
  axis: string | null | undefined,
  number: string | number | null | undefined,
): ReaderPosition | null {
  const validAxis = axisOf(axis);
  const validNumber = positionNumberOf(number);
  return validAxis && validNumber ? { axis: validAxis, number: validNumber } : null;
}

/** The URL of the preview of a version at a position: exactly one query parameter. */
export function previewUrl(versionUrl: string, position: ReaderPosition): string {
  return `${versionUrl}/preview?${QUERY_PARAMETER[position.axis]}=${position.number}`;
}

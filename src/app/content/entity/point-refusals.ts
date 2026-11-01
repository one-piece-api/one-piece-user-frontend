/**
 * The words for a point of the reader axis the backend refused (workflow 3.7.4): on save
 * (`422`, under the picker) and going online (`409 STORY_POINT_OUT_OF_RANGE`). The backend
 * says why only in English, without a code (`ReaderAxisRules`), so its texts are matched here
 * as `ENTRY_REFUSAL_BY_MESSAGE` does (reveals plan R8, decision 6); a text not known falls back
 * to a generic one, never to English. No Angular in here.
 */

/** The i18n keys of the refusals, by the backend's text. */
const POINT_REFUSAL_BY_MESSAGE: Readonly<Record<string, string>> = {
  'must be on an axis of the first appearance': 'content.storyPoint.refused.offAxis',
  'must not be before the first appearance': 'content.storyPoint.refused.beforeFirstAppearance',
  'must be on an axis where discovered has a part': 'content.storyPoint.refused.endedOffAxis',
  'must not be before discovered': 'content.storyPoint.refused.endedBeforeDiscovered',
  'must not start before a previous period': 'content.storyPoint.refused.periodOutOfOrder',
  'must not overlap a previous period': 'content.storyPoint.refused.periodOverlapping',
  'must have an end: only the last period may have none': 'content.storyPoint.refused.periodOpen',
  'must be a Chapter with an approved version': 'content.storyPoint.refused.notLinkable',
  'must be an Episode with an approved version': 'content.storyPoint.refused.notLinkable',
  // A point of a Saga or an Arc needs only to be a chapter or an episode on save.
  'must be a Chapter': 'content.storyPoint.refused.unknown',
  'must be an Episode': 'content.storyPoint.refused.unknown',
};

/** What is said for a refusal whose text is not known. */
export const POINT_REFUSED_KEY = 'content.storyPoint.refused.invalid';

/** Every key a point refusal may have: the Lumacofono has one message for all of them. */
export const POINT_REFUSAL_KEYS: readonly string[] = [
  ...new Set([...Object.values(POINT_REFUSAL_BY_MESSAGE), POINT_REFUSED_KEY]),
];

/** The backend adds the axis to a rule on periods: "must not overlap ... on the chapter axis". */
const ON_AXIS = / on the (chapter|episode) axis$/;

/** The i18n key of a point refusal, by the backend's text. */
export function pointRefusalKey(message: string | null | undefined): string {
  return POINT_REFUSAL_BY_MESSAGE[(message ?? '').replace(ON_AXIS, '')] ?? POINT_REFUSED_KEY;
}

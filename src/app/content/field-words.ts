import type { TranslocoService } from '@jsverse/transloco';
import { draftFieldKey, openingRule } from './entity/entity-body';
import {
  labelKeyOf,
  naturalKeyParts,
  type EntityDefinition,
  type PartListField,
} from './entity/entity-definition';
import { isWindowPart, partsOf } from './entity/entity-part-list';

/** Where the words for a field the backend names live. */
const FIELD_WORDS = 'content.workflow.refused.field';

/** Between the steps of a path in words: "appartenenza 1 · periodo 2 · scoperta, capitolo". */
const STEP_SEPARATOR = ' · ';

/**
 * A field named as the backend names it, in words: "romaji", "nome EN", "epiteto 2 EN",
 * "appartenenza 1 · periodo 2 · scoperta, capitolo". A refusal of a transition and a block
 * name their fields so.
 */
export function refusedFieldWords(
  transloco: TranslocoService,
  entity: EntityDefinition,
  field: string,
): string {
  const reveal = entity.reveals ? revealWords(transloco, entity, field) : null;
  if (reveal) {
    return reveal;
  }
  const [first, name, ...rest] = (draftFieldKey(entity, field) ?? field).split('.');
  const list = entity.fields.find(
    (candidate): candidate is PartListField =>
      candidate.key === first && candidate.kind === 'partList',
  );
  if (list) {
    const words = `${FIELD_WORDS}.${labelKeyOf(list)}`;
    if (name !== undefined) {
      return entryWords(transloco, list, words, name, rest);
    }
    // A section of paragraphs or a gallery is named by what review asks of it (3.7.3, 3.5.1).
    return transloco.translate(
      list.opensAtFirstAppearance ? `${words}.${openingRule(entity)}` : `${words}.list`,
    );
  }
  if (name) {
    return transloco.translate(`${FIELD_WORDS}.${name}`, { language: first.toUpperCase() });
  }
  // A field shared by every language has words of its own where the catalog has them.
  const shared = `${FIELD_WORDS}.${first}`;
  const worded = transloco.translate(shared);
  return worded !== shared
    ? worded
    : naturalKeyParts(entity)
        .map((key) => transloco.translate(`${FIELD_WORDS}.${key}`))
        .join(', ');
}

/**
 * A field of the reveals in words (3.7.1): "conoscenza iniziale · nome EN",
 * "rivelazione 2 · titolo IT", "rivelazione 2 · nome EN"; `null` for any other field.
 */
function revealWords(
  transloco: TranslocoService,
  entity: EntityDefinition,
  field: string,
): string | null {
  const words = `${FIELD_WORDS}.reveals`;
  const initial = /^initialKnowledge\.(.+)$/.exec(field);
  if (initial) {
    return [
      transloco.translate(`${words}.initial`),
      refusedFieldWords(transloco, entity, initial[1]),
    ].join(STEP_SEPARATOR);
  }
  const reveal = /^reveals\[(\d+)\](?:\.titles\[([^\]]+)\]|\.(.+))?$/.exec(field);
  if (!reveal) {
    return null;
  }
  const [, index, titleLanguage, value] = reveal;
  const entry = transloco.translate(`${words}.entry`, { position: Number(index) + 1 });
  const part = titleLanguage
    ? transloco.translate(`${words}.title`, { language: titleLanguage.toUpperCase() })
    : value
      ? refusedFieldWords(transloco, entity, value)
      : null;
  return [entry, part].filter(Boolean).join(STEP_SEPARATOR);
}

/**
 * An entry of a list in words, by its position - "epiteto 2 EN" with the language of a
 * localized part - then the part at fault where it is a nested list or a point of the window.
 */
function entryWords(
  transloco: TranslocoService,
  list: PartListField,
  words: string,
  index: string,
  [partKey, ...tail]: readonly string[],
): string {
  const part = partsOf(list).find(({ key }) => key === partKey);
  const language = part?.kind === 'localizedText' ? (tail[0]?.toUpperCase() ?? '') : '';
  const entry = transloco
    .translate(`${words}.entry`, { position: Number(index) + 1, language })
    .trim();
  if (part?.kind === 'partList') {
    const [nestedIndex, ...nestedTail] = tail;
    const nestedWords = `${words}.${part.key}`;
    const nested =
      nestedIndex === undefined
        ? transloco.translate(`${nestedWords}.list`)
        : entryWords(transloco, part, nestedWords, nestedIndex, nestedTail);
    return [entry, nested].join(STEP_SEPARATOR);
  }
  if (part && isWindowPart(part)) {
    const point = transloco.translate(`${FIELD_WORDS}.window.${part.key}`);
    const axis = tail[0] ? transloco.translate(`${FIELD_WORDS}.window.axis.${tail[0]}`) : '';
    return [entry, axis ? `${point}, ${axis}` : point].join(STEP_SEPARATOR);
  }
  return entry;
}

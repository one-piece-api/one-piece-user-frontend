/**
 * The reveals of a content (plan timeline, T13; workflow 3.6), read and written forward as
 * the API keeps them: the main fields are the truth, the initial knowledge says what the
 * reader knows at the first appearance, and each reveal names the fields the reader learns
 * at its chapter - with the value learned only where a later reveal changes the field again.
 * The last reveal of a field holds no value: it reveals the truth.
 *
 * Every value is held and saved by its field's kind (`field-kinds.ts`), so a belief has the
 * shape of a draft: the shared fields at the top level, the translated ones per language. A
 * subcategory goes with the relation it belongs to (`type` stands for the subcategory too).
 * No Angular in here.
 */
import type { EntityBody } from './entity-body';
import type { EntityDefinition, EntityField } from './entity-definition';
import { isReference, type EntityReference } from './entity-reference';
import { chapterOf } from './entity-story-point';
import { kindOf, textOf } from './field-kinds';

/** The values of a belief - initial or learned at a reveal - as the editor holds them. */
export interface Belief {
  [field: string]: unknown;
  translations: Record<string, Record<string, unknown>>;
}

/** One reveal while it is written; `key` tells it apart on screen while chapters change. */
export interface RevealDraft {
  readonly key: string;
  readonly chapter: EntityReference | null;
  readonly titles: Record<string, string>;
  /** The keys of the fields the reader learns there, in the definition's order. */
  readonly fields: readonly string[];
  /**
   * The values learned. A value of a field that is the last mention is kept here - the
   * editor may move the reveal back - but never sent (`revealsSaved`).
   */
  readonly values: Belief;
}

/** What the editor holds for the reveals of a version. */
export interface RevealsDraft {
  readonly initial: Belief;
  readonly reveals: readonly RevealDraft[];
}

/** Where the draft of the reveals lives inside the draft of a version. */
export const REVEALS_DRAFT_KEY = 'reveals';

/** Where the API keeps the initial knowledge and the reveals of a version. */
const INITIAL_KNOWLEDGE = 'initialKnowledge';
const REVEALS = 'reveals';

let nextKey = 0;

/** A key for a reveal of the editor, unique while the page lives. */
export function newRevealKey(): string {
  return `reveal-${nextKey++}`;
}

/** The fields a reveal may name, in the definition's order: none without the capability. */
export function revealableFields(definition: EntityDefinition): EntityField[] {
  const keys = definition.reveals?.fields ?? [];
  return definition.fields.filter(({ key }) => keys.includes(key));
}

/** The fields a revealed one carries: itself, and a subcategory of it. */
function valueFieldsOf(definition: EntityDefinition, key: string): EntityField[] {
  return definition.fields.filter(
    (field) => field.key === key || (field.kind === 'subcategory' && field.of === key),
  );
}

/** A belief whose fields are those of `keys`, read from what the API shows (`saved`). */
function beliefOf(
  definition: EntityDefinition,
  saved: unknown,
  languages: readonly string[],
): Belief {
  const source = (saved ?? {}) as Record<string, unknown>;
  const translations = (source['translations'] ?? {}) as Record<string, Record<string, unknown>>;
  const fields = revealableFields(definition).flatMap(({ key }) => valueFieldsOf(definition, key));
  const belief: Belief = { translations: {} };
  for (const field of fields.filter((candidate) => !kindOf(candidate).localized)) {
    belief[field.key] = kindOf(field).draftValue(source[field.key]);
  }
  const localized = fields.filter((candidate) => kindOf(candidate).localized);
  for (const language of languages) {
    belief.translations[language] = Object.fromEntries(
      localized.map((field) => [
        field.key,
        kindOf(field).draftValue(translations[language]?.[field.key]),
      ]),
    );
  }
  return belief;
}

/** What the editor starts from: the reveals of the version, as they are kept. */
export function revealsDraftOf(
  definition: EntityDefinition,
  body: Readonly<Record<string, unknown>> | null,
  languages: readonly string[],
): RevealsDraft {
  const keys = revealableFields(definition).map(({ key }) => key);
  const saved = Array.isArray(body?.[REVEALS]) ? (body[REVEALS] as Record<string, unknown>[]) : [];
  return {
    initial: beliefOf(definition, body?.[INITIAL_KNOWLEDGE], languages),
    reveals: saved.map((reveal) => {
      const named = Array.isArray(reveal['fields']) ? (reveal['fields'] as unknown[]) : [];
      const titles = (reveal['titles'] ?? {}) as Record<string, unknown>;
      return {
        key: newRevealKey(),
        chapter: chapterOf(reveal['revealedAt']),
        titles: Object.fromEntries(
          languages.map((language) => [language, textOf(titles[language])]),
        ),
        fields: keys.filter((key) => named.includes(key)),
        values: beliefOf(definition, reveal, languages),
      };
    }),
  };
}

/** The draft of the reveals held inside the draft of a version; none where it has none. */
export function revealsOfDraft(draft: Readonly<Record<string, unknown>>): RevealsDraft {
  const held = draft[REVEALS_DRAFT_KEY] as RevealsDraft | undefined;
  return held ?? { initial: { translations: {} }, reveals: [] };
}

/**
 * The reveals in the order the reader meets them: by chapter number, those without a chapter
 * last in the order they were added. The order they are shown, saved and refused in.
 */
export function orderedReveals(reveals: readonly RevealDraft[]): RevealDraft[] {
  const numberOf = ({ chapter }: RevealDraft) =>
    typeof chapter?.number === 'number' ? chapter.number : Number.POSITIVE_INFINITY;
  return [...reveals].sort((a, b) => numberOf(a) - numberOf(b));
}

/** Whether the reveal at `index` of the ordered ones is the last to name `field`. */
export function isLastMention(
  ordered: readonly RevealDraft[],
  index: number,
  field: string,
): boolean {
  return !ordered.slice(index + 1).some(({ fields }) => fields.includes(field));
}

/** The fields some reveal names: those the initial knowledge holds a value for. */
export function revealedFields(
  definition: EntityDefinition,
  reveals: readonly RevealDraft[],
): string[] {
  return revealableFields(definition)
    .map(({ key }) => key)
    .filter((key) => reveals.some(({ fields }) => fields.includes(key)));
}

/** What a belief is saved as: only the values of `keys`, each as its kind saves it. */
function beliefSaved(
  definition: EntityDefinition,
  belief: Belief,
  keys: readonly string[],
): Record<string, unknown> {
  const fields = keys.flatMap((key) => valueFieldsOf(definition, key));
  const saved: Record<string, unknown> = {};
  for (const field of fields.filter((candidate) => !kindOf(candidate).localized)) {
    saved[field.key] = kindOf(field).savedValue(belief[field.key]);
  }
  const localized = fields.filter((candidate) => kindOf(candidate).localized);
  const translations: Record<string, Record<string, unknown>> = {};
  if (localized.length) {
    for (const [language, values] of Object.entries(belief.translations)) {
      translations[language] = Object.fromEntries(
        localized.map((field) => [field.key, kindOf(field).savedValue(values[field.key])]),
      );
    }
  }
  return { ...saved, translations };
}

/**
 * What the reveals are saved as, in the order the reader meets them: the initial values of
 * the fields some reveal names, and at each reveal the values of the fields it names that a
 * later reveal changes again - a last mention reveals the truth and sends no value.
 */
export function revealsSaved(
  definition: EntityDefinition,
  draft: RevealsDraft,
): Record<string, unknown> {
  const ordered = orderedReveals(draft.reveals);
  return {
    [INITIAL_KNOWLEDGE]: beliefSaved(
      definition,
      draft.initial,
      revealedFields(definition, ordered),
    ),
    [REVEALS]: ordered.map((reveal, index) => ({
      revealedAt: reveal.chapter ? { chapter: reveal.chapter.id } : null,
      fields: reveal.fields,
      titles: Object.fromEntries(
        Object.entries(reveal.titles)
          .map(([language, title]) => [language, title.trim()])
          .filter(([, title]) => title),
      ),
      ...beliefSaved(
        definition,
        reveal.values,
        reveal.fields.filter((field) => !isLastMention(ordered, index, field)),
      ),
    })),
  };
}

/** One field of a reveal on the timeline: what the reader knew, and what they learn. */
export interface TimelineRow {
  readonly field: string;
  /** Where the value known just before is read - empty there means not revealed yet. */
  readonly before: Belief;
  /** Where the value learned is read: the truth on the last mention. */
  readonly after: Belief;
  /** The last mention of the field: it reveals the truth, edited in the main fields. */
  readonly last: boolean;
}

/** One point of the timeline read forward. */
export type TimelineNode =
  | {
      readonly kind: 'firstAppearance';
      readonly chapter: EntityReference | null;
      /** The fields some reveal names: their initial values are asked here. */
      readonly fields: readonly string[];
      readonly values: Belief;
    }
  | {
      readonly kind: 'reveal';
      readonly reveal: RevealDraft;
      readonly rows: readonly TimelineRow[];
    };

/**
 * The reveals read forward (T11, T13): the first appearance with the initial knowledge,
 * then each reveal with what the reader knew before and learns there - the last mention
 * of a field reaching the truth.
 * Values are not copied: each row says where its values are read (`truth` for the main
 * fields), so the screens show them with the field's own kind.
 */
export function forwardTimeline(
  definition: EntityDefinition,
  truth: Belief,
  draft: RevealsDraft,
  firstAppearance: unknown,
): TimelineNode[] {
  const ordered = orderedReveals(draft.reveals);
  const nodes: TimelineNode[] = [
    {
      kind: 'firstAppearance',
      chapter: isReference(firstAppearance) ? firstAppearance : chapterOf(firstAppearance),
      fields: revealedFields(definition, ordered),
      values: draft.initial,
    },
  ];
  ordered.forEach((reveal, index) => {
    nodes.push({
      kind: 'reveal',
      reveal,
      rows: reveal.fields.map((field) => {
        const previous = ordered
          .slice(0, index)
          .reverse()
          .find(({ fields }) => fields.includes(field));
        const last = isLastMention(ordered, index, field);
        return {
          field,
          before: previous?.values ?? draft.initial,
          after: last ? truth : reveal.values,
          last,
        };
      }),
    });
  });
  return nodes;
}

/** Where on the timeline the backend says a value is at fault. */
export interface RevealRefusal {
  /** `initial` for the initial knowledge, else the key of the reveal. */
  readonly node: string;
  /**
   * What is at fault: `node` (the whole reveal), `chapter`, `fields`, `title.<language>`,
   * `<language>.<field>` for a translated value, or the key of a shared one.
   */
  readonly target: string;
}

/** The node the initial knowledge is refused on. */
export const INITIAL_NODE = 'initial';

/**
 * Where a field the backend refused sits on the timeline: `initialKnowledge.romaji`,
 * `reveals[1].titles[it]`, `reveals[0].revealedAt.chapter`… A reveal is named by its
 * position in the JSON sent - `sentKeys`, the keys in the order they were saved; anything
 * else, or a position no longer sent, is `null`.
 */
export function revealRefusalOf(field: string, sentKeys: readonly string[]): RevealRefusal | null {
  const [, initial, position, rest] =
    /^(?:(initialKnowledge)|reveals\[(\d+)\])(?:\.(.+))?$/.exec(field) ?? [];
  const node = initial ? INITIAL_NODE : position === undefined ? null : sentKeys[Number(position)];
  if (!node) {
    return null;
  }
  if (rest === undefined) {
    return { node, target: 'node' };
  }
  if (rest === 'revealedAt' || rest === 'revealedAt.chapter') {
    return { node, target: 'chapter' };
  }
  const title = /^titles\[([^\]]+)\]$/.exec(rest);
  if (title) {
    return { node, target: `title.${title[1]}` };
  }
  const translated = /^translations\[([^\]]+)\]\.(\w+)$/.exec(rest);
  return { node, target: translated ? `${translated[1]}.${translated[2]}` : rest };
}

/** The belief with one value changed: a shared one, or a translated one in `language`. */
export function withValue(
  belief: Belief,
  key: string,
  language: string | null,
  value: unknown,
): Belief {
  if (language === null) {
    return { ...belief, [key]: value };
  }
  return {
    ...belief,
    translations: {
      ...belief.translations,
      [language]: { ...belief.translations[language], [key]: value },
    },
  };
}

/** The reveals with the reveal of `key` changed by `change`. */
export function withReveal(
  draft: RevealsDraft,
  key: string,
  change: (reveal: RevealDraft) => RevealDraft,
): RevealsDraft {
  return {
    ...draft,
    reveals: draft.reveals.map((reveal) => (reveal.key === key ? change(reveal) : reveal)),
  };
}

/** A reveal just added: no chapter, no title, no field yet. */
export function newReveal(languages: readonly string[]): RevealDraft {
  return {
    key: newRevealKey(),
    chapter: null,
    titles: Object.fromEntries(languages.map((language) => [language, ''])),
    fields: [],
    values: { translations: Object.fromEntries(languages.map((language) => [language, {}])) },
  };
}

/** The reveal naming `field` too, kept in the definition's order. */
export function withField(
  definition: EntityDefinition,
  reveal: RevealDraft,
  field: string,
): RevealDraft {
  const named = [...reveal.fields, field];
  return {
    ...reveal,
    fields: revealableFields(definition)
      .map(({ key }) => key)
      .filter((key) => named.includes(key)),
  };
}

/** What is said on the timeline where the backend refused a reveal, by what is at fault. */
export function revealRefusalKey(refusal: RevealRefusal, tooLong: boolean): string {
  const key = (name: string) => `content.reveals.error.${name}`;
  if (tooLong) {
    return key('tooLong');
  }
  switch (refusal.target) {
    case 'chapter':
    case 'fields':
      return key(refusal.target);
    case 'node':
      return key(refusal.node === INITIAL_NODE ? 'initial' : 'node');
    default:
      return key('value');
  }
}

/** Whether a belief holds some value of `field` (or of its subcategory), in any language. */
function knows(definition: EntityDefinition, belief: Belief, field: string): boolean {
  return valueFieldsOf(definition, field).some((value) =>
    kindOf(value).localized
      ? Object.values(belief.translations).some((texts) => textOf(texts?.[value.key]).trim())
      : value.kind === 'relation' || value.kind === 'subcategory'
        ? belief[value.key] != null
        : textOf(belief[value.key]).trim() !== '',
  );
}

/** The belief with the values of `field` (and of its subcategory) taken from `source`. */
function withValuesOf(
  definition: EntityDefinition,
  belief: Belief,
  source: Belief,
  field: string,
): Belief {
  return valueFieldsOf(definition, field).reduce((changed, value) => {
    if (!kindOf(value).localized) {
      return withValue(changed, value.key, null, source[value.key] ?? null);
    }
    return Object.keys(source.translations).reduce(
      (written, language) =>
        withValue(written, value.key, language, source.translations[language]?.[value.key] ?? ''),
      changed,
    );
  }, belief);
}

/**
 * The reveal of `key` naming `field` too. When it becomes the field's last mention, what the
 * reader knew before - the earlier mention, else the first appearance - is the truth so far,
 * if nothing was written there yet: the truth is then written as the value revealed.
 */
export function withRevealedField(
  definition: EntityDefinition,
  draft: RevealsDraft,
  key: string,
  field: string,
  truth: Belief,
): RevealsDraft {
  const named = withReveal(draft, key, (reveal) => withField(definition, reveal, field));
  const ordered = orderedReveals(named.reveals);
  const index = ordered.findIndex((reveal) => reveal.key === key);
  if (!isLastMention(ordered, index, field)) {
    return named;
  }
  const previous = ordered
    .slice(0, index)
    .reverse()
    .find(({ fields }) => fields.includes(field));
  const before = previous?.values ?? named.initial;
  if (knows(definition, before, field)) {
    return named;
  }
  const seeded = withValuesOf(definition, before, truth, field);
  return previous
    ? withReveal(named, previous.key, (reveal) => ({ ...reveal, values: seeded }))
    : { ...named, initial: seeded };
}

/** What the reader knows at a point of the timeline, as the card shows it. */
export interface ReaderView {
  /** The body of the version with the values the reader knows there. */
  readonly body: EntityBody;
  /** The fields the reader does not know yet there: no value to show. */
  readonly unrevealed: readonly string[];
}

/**
 * The version as the reader sees it at a point of the timeline (T13): `0` at the first
 * appearance, `n` after the n-th reveal in chapter order - after the last one, the truth.
 * A field no reveal names is the truth; before its first reveal, the initial knowledge;
 * after a reveal that is not its last, the value learned there; after its last, the truth.
 * Only the revealed fields change: relations not revealed yet are not hidden (public API, TL6).
 */
export function readerViewAt(
  definition: EntityDefinition,
  body: EntityBody,
  truth: Belief,
  draft: RevealsDraft,
  point: number,
): ReaderView {
  const ordered = orderedReveals(draft.reveals);
  const seen = ordered.slice(0, point);
  let belief: Belief = truth;
  const unrevealed: string[] = [];
  for (const field of revealedFields(definition, ordered)) {
    const latest = seen.map(({ fields }) => fields.includes(field)).lastIndexOf(true);
    if (latest >= 0 && isLastMention(ordered, latest, field)) {
      continue;
    }
    const source = latest >= 0 ? seen[latest].values : draft.initial;
    belief = withValuesOf(definition, belief, source, field);
    if (!knows(definition, source, field)) {
      unrevealed.push(field);
    }
  }
  return { body: bodyWith(definition, body, belief), unrevealed };
}

/** The body with the values of the revealable fields taken from `belief`. */
function bodyWith(definition: EntityDefinition, body: EntityBody, belief: Belief): EntityBody {
  const fields = revealableFields(definition).flatMap(({ key }) => valueFieldsOf(definition, key));
  const shared = fields.filter((field) => !kindOf(field).localized);
  const localized = fields.filter((field) => kindOf(field).localized);
  return {
    ...body,
    ...Object.fromEntries(shared.map(({ key }) => [key, belief[key] ?? null])),
    translations: Object.fromEntries(
      Object.entries(body.translations).map(([language, translation]) => [
        language,
        {
          ...translation,
          ...Object.fromEntries(
            localized.map(({ key }) => [key, belief.translations[language]?.[key] ?? null]),
          ),
        },
      ]),
    ),
  };
}

/** The number of a reveal's chapter as the timeline shows it: `?` where it has none. */
export function chapterNumberOf(chapter: EntityReference): string {
  return typeof chapter.number === 'number' ? String(chapter.number) : '?';
}

/** A reveal's title in `language`; while a draft lacks it, "Reveal at ch. N" or "New reveal". */
export function revealTitleOf(
  translate: (key: string, params?: Record<string, string>) => string,
  reveal: RevealDraft,
  language: string,
): string {
  const title = reveal.titles[language]?.trim();
  if (title) {
    return title;
  }
  return reveal.chapter
    ? translate('content.reveals.untitled', { chapter: chapterNumberOf(reveal.chapter) })
    : translate('content.reveals.new');
}

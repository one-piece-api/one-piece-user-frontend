/**
 * The reveals of a content (workflow 3.7.1, ADR-0012 of the backend), read and written forward
 * as the API keeps them: the main fields are the current value, the initial knowledge says what
 * the reader believes at the first appearance, and each reveal names what the reader learns at
 * its point - with a value only where a later reveal changes it again. The last reveal of a
 * choice holds no value: it reveals the current one.
 *
 * A reveal names choices (`RevealGroup`: `NAME`, `IDENTITY`...), each carried by fields of the
 * definition; every value is held and saved by its field's kind (`field-kinds.ts`), so a belief
 * has the shape of a draft: the shared fields at the top level, the translated ones per language.
 * Ported from the `timeline` branch (frontend ADR-0007 there); no reader preview here, it comes
 * from the backend in R9. No Angular in here.
 */
import type { EntityFieldRef } from './entity-body';
import { diffField, type FieldDiff } from '../version-comparison';
import type { EntityDefinition, EntityField, RevealGroup } from './entity-definition';
import {
  comparedStoryPoint,
  isStoryPointFilled,
  storyPointOf,
  storyPointShortLabel,
  type StoryPointDraft,
  type Translate,
} from './entity-story-point';
import { FIELD_KINDS, textOf } from './field-kinds';
import { pointRefusalKey } from './point-refusals';

/** The values of a belief - initial or learned at a reveal - as the editor holds them. */
export interface Belief {
  [field: string]: unknown;
  translations: Record<string, Record<string, unknown>>;
}

/** One reveal while it is written; `key` tells it apart on screen while points change. */
export interface RevealDraft {
  readonly key: string;
  readonly point: StoryPointDraft;
  readonly titles: Readonly<Record<string, string>>;
  /** The choices the reader learns there (`RevealGroup.key`), in the definition's order. */
  readonly groups: readonly string[];
  /**
   * The values learned. A value of a choice that is its last mention is kept here - the editor
   * may move the reveal back - but never sent (`revealsSaved`).
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

/** The node of the timeline the initial knowledge is written and refused on. */
export const INITIAL_NODE = 'initial';

/** Where the value of a choice's last mention is written: the main fields. */
export const TRUTH_NODE = 'truth';

const EMPTY_POINT: StoryPointDraft = { chapter: null, episode: null };

let nextKey = 0;

/** A key for a reveal of the editor, unique while the page lives. */
export function newRevealKey(): string {
  return `reveal-${nextKey++}`;
}

function kindOf(field: EntityField) {
  return FIELD_KINDS[field.kind];
}

/** The choices a reveal may name, in the definition's order: none without the capability. */
export function revealGroups(definition: EntityDefinition): readonly RevealGroup[] {
  return definition.reveals?.groups ?? [];
}

/** The fields that carry the values of a choice, in the definition's order. */
export function groupFields(definition: EntityDefinition, group: string): EntityField[] {
  const keys = revealGroups(definition).find(({ key }) => key === group)?.fields ?? [];
  return definition.fields.filter(({ key }) => keys.includes(key));
}

/** The fields that carry the values of `groups`. */
function fieldsOf(definition: EntityDefinition, groups: readonly string[]): EntityField[] {
  return groups.flatMap((group) => groupFields(definition, group));
}

function allGroups(definition: EntityDefinition): string[] {
  return revealGroups(definition).map(({ key }) => key);
}

/** An empty belief, a translation per language. */
function emptyBelief(languages: readonly string[]): Belief {
  return { translations: Object.fromEntries(languages.map((language) => [language, {}])) };
}

/** A belief read from what the API shows (`saved`), with every revealable field. */
function beliefOf(
  definition: EntityDefinition,
  saved: unknown,
  languages: readonly string[],
): Belief {
  const source = (saved ?? {}) as Record<string, unknown>;
  const translations = (source['translations'] ?? {}) as Record<string, Record<string, unknown>>;
  const fields = fieldsOf(definition, allGroups(definition));
  const belief = emptyBelief(languages);
  for (const field of fields.filter((candidate) => !kindOf(candidate).localized)) {
    belief[field.key] = kindOf(field).draftValue(source[field.key], field);
  }
  const localized = fields.filter((candidate) => kindOf(candidate).localized);
  for (const language of languages) {
    belief.translations[language] = Object.fromEntries(
      localized.map((field) => [
        field.key,
        kindOf(field).draftValue(translations[language]?.[field.key], field),
      ]),
    );
  }
  return belief;
}

/** The main fields of a version as a belief: what a choice's last mention reveals. */
export function truthOf(
  definition: EntityDefinition,
  body: Readonly<Record<string, unknown>>,
  languages: readonly string[],
): Belief {
  return beliefOf(definition, body, languages);
}

/** What the editor starts from: the reveals of the version, as they are kept. */
export function revealsDraftOf(
  definition: EntityDefinition,
  body: Readonly<Record<string, unknown>> | null,
  languages: readonly string[],
): RevealsDraft {
  const groups = allGroups(definition);
  const saved = Array.isArray(body?.[REVEALS]) ? (body[REVEALS] as Record<string, unknown>[]) : [];
  return {
    initial: beliefOf(definition, body?.[INITIAL_KNOWLEDGE], languages),
    reveals: saved.map((reveal) => {
      const named = Array.isArray(reveal['fields']) ? (reveal['fields'] as unknown[]) : [];
      const titles = (reveal['titles'] ?? {}) as Record<string, unknown>;
      return {
        key: newRevealKey(),
        point: storyPointOf(reveal['revealedAt']),
        titles: Object.fromEntries(
          languages.map((language) => [language, textOf(titles[language])]),
        ),
        groups: groups.filter((group) => named.includes(group)),
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
 * Where a reveal stands for the reader: by chapter where it has one, then by episode, those
 * without a point last. The backend resolves each axis on its own (3.7.1); this order only
 * lays out the timeline and says which mention of a choice is the last one.
 */
function orderKey({ point }: RevealDraft): [number, number] {
  const numberOf = (part: 'chapter' | 'episode') => {
    const number = point[part]?.number;
    return typeof number === 'number' ? number : Number.POSITIVE_INFINITY;
  };
  if (point.chapter) {
    return [0, numberOf('chapter')];
  }
  return point.episode ? [1, numberOf('episode')] : [2, 0];
}

/** The reveals in the order the reader meets them (`orderKey`), ties in the order added. */
export function orderedReveals(reveals: readonly RevealDraft[]): RevealDraft[] {
  return [...reveals].sort((a, b) => {
    const [groupA, numberA] = orderKey(a);
    const [groupB, numberB] = orderKey(b);
    return groupA - groupB || numberA - numberB;
  });
}

/** Whether the reveal at `index` of the ordered ones is the last to name `group`. */
export function isLastMention(
  ordered: readonly RevealDraft[],
  index: number,
  group: string,
): boolean {
  return !ordered.slice(index + 1).some(({ groups }) => groups.includes(group));
}

/** The choices some reveal names: those the initial knowledge holds a value for. */
export function revealedGroups(
  definition: EntityDefinition,
  reveals: readonly RevealDraft[],
): string[] {
  return allGroups(definition).filter((group) =>
    reveals.some(({ groups }) => groups.includes(group)),
  );
}

/** What a belief is saved as: only the values of `groups`, each as its kind saves it. */
function beliefSaved(
  definition: EntityDefinition,
  belief: Belief,
  groups: readonly string[],
): Record<string, unknown> {
  const fields = fieldsOf(definition, groups);
  const saved: Record<string, unknown> = {};
  for (const field of fields.filter((candidate) => !kindOf(candidate).localized)) {
    saved[field.key] = kindOf(field).savedValue(belief[field.key], field);
  }
  const localized = fields.filter((candidate) => kindOf(candidate).localized);
  if (localized.length) {
    saved['translations'] = Object.fromEntries(
      Object.entries(belief.translations).map(([language, values]) => [
        language,
        Object.fromEntries(
          localized.map((field) => [field.key, kindOf(field).savedValue(values[field.key], field)]),
        ),
      ]),
    );
  }
  return saved;
}

/**
 * What the reveals are saved as, in the order the reader meets them: the initial values of the
 * choices some reveal names, and at each reveal the values of the choices it names that a later
 * reveal changes again - a last mention reveals the current value and sends none.
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
      revealedGroups(definition, ordered),
    ),
    [REVEALS]: ordered.map((reveal, index) => ({
      revealedAt: FIELD_KINDS.storyPoint.savedValue(reveal.point),
      fields: reveal.groups,
      titles: Object.fromEntries(
        Object.entries(reveal.titles)
          .map(([language, title]) => [language, title.trim()])
          .filter(([, title]) => title),
      ),
      ...beliefSaved(
        definition,
        reveal.values,
        reveal.groups.filter((group) => !isLastMention(ordered, index, group)),
      ),
    })),
  };
}

/** The keys of the reveals in the order a save sends them: how the backend names them. */
export function sentRevealKeys(draft: RevealsDraft): string[] {
  return orderedReveals(draft.reveals).map(({ key }) => key);
}

/** One choice of a reveal on the timeline: what the reader knew, and what they learn. */
export interface TimelineRow {
  readonly group: string;
  /** Where the value known just before is read - empty there means not known yet. */
  readonly before: Belief;
  /** The node that value is written on: the first appearance or an earlier reveal. */
  readonly beforeNode: string;
  /** Where the value learned is read: the main fields on the last mention. */
  readonly after: Belief;
  /** The node that value is written on: the reveal, or the main fields (`TRUTH_NODE`). */
  readonly afterNode: string;
  /** The last mention of the choice: it reveals the current value, kept in the main fields. */
  readonly last: boolean;
}

/** One point of the timeline read forward. */
export type TimelineNode =
  | {
      readonly kind: 'firstAppearance';
      readonly point: StoryPointDraft;
      /** The choices some reveal names: their initial values are written here. */
      readonly groups: readonly string[];
      readonly values: Belief;
    }
  | {
      readonly kind: 'reveal';
      readonly reveal: RevealDraft;
      readonly rows: readonly TimelineRow[];
    };

/**
 * The reveals read forward: the first appearance with the initial knowledge, then each reveal
 * with what the reader knew before and learns there - the last mention of a choice reaching the
 * main fields. Values are not copied: each row says where its values are read and written.
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
      point: storyPointOf(firstAppearance),
      groups: revealedGroups(definition, ordered),
      values: draft.initial,
    },
  ];
  ordered.forEach((reveal, index) => {
    nodes.push({
      kind: 'reveal',
      reveal,
      rows: reveal.groups.map((group) => {
        const previous = ordered
          .slice(0, index)
          .reverse()
          .find(({ groups }) => groups.includes(group));
        const last = isLastMention(ordered, index, group);
        return {
          group,
          before: previous?.values ?? draft.initial,
          beforeNode: previous?.key ?? INITIAL_NODE,
          after: last ? truth : reveal.values,
          afterNode: last ? TRUTH_NODE : reveal.key,
          last,
        };
      }),
    });
  });
  return nodes;
}

/** Where on the timeline the backend says a value is at fault. */
export interface RevealRefusal {
  /** `INITIAL_NODE` for the initial knowledge, else the key of the reveal. */
  readonly node: string;
  /**
   * What is at fault: `node` (the whole reveal), `point`, `fields`, `title.<language>`,
   * `<language>.<field>` for a translated value, or the key of a shared one.
   */
  readonly target: string;
}

/**
 * Where a field the backend refused sits on the timeline: `initialKnowledge.romaji`,
 * `reveals[1].titles[it]`, `reveals[0].revealedAt.episode`... A reveal is named by its position
 * in the JSON sent - `sentKeys`, the keys in the order they were saved; anything else, or a
 * position no longer sent, is `null`.
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
  if (/^revealedAt(?:\.(?:chapter|episode))?$/.test(rest)) {
    return { node, target: 'point' };
  }
  const title = /^titles\[([^\]]+)\]$/.exec(rest);
  if (title) {
    return { node, target: `title.${title[1]}` };
  }
  const translated = /^translations\[([^\]]+)\]\.(\w+)$/.exec(rest);
  return { node, target: translated ? `${translated[1]}.${translated[2]}` : rest };
}

/** The backend's words for a refused reveal (`FieldRevealRules`, `ReaderAxisRules`), as i18n keys. */
const REVEAL_REFUSAL_BY_PREFIX: readonly (readonly [string, string])[] = [
  ['must name at least one field', 'content.reveals.error.fields'],
  ['is not among the fields the reveal names', 'content.reveals.error.notNamed'],
  ['must be left out: no reveal names', 'content.reveals.error.notNamed'],
  ['must be known at the first appearance', 'content.reveals.error.alwaysKnown'],
  ['is required with the other values of', 'content.reveals.error.keyMissing'],
  ['must not share its point with an earlier reveal', 'content.reveals.error.sharedPoint'],
];

/**
 * What is said on the timeline where the backend refused a value, by its words: a point by the
 * reader axis' rules (`pointRefusalKey`), the rest by the reveal rules; a text not known falls
 * back to a generic one, never to English.
 */
export function revealRefusalKey(refusal: RevealRefusal, message: string | undefined): string {
  const text = message ?? '';
  const known = REVEAL_REFUSAL_BY_PREFIX.find(([prefix]) => text.startsWith(prefix));
  if (known) {
    return known[1];
  }
  if (refusal.target === 'point') {
    return text === 'is required' ? 'content.reveals.error.point' : pointRefusalKey(text);
  }
  return 'content.reveals.error.value';
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

/** A belief of the reveals changed: the initial knowledge (`INITIAL_NODE`) or a reveal's. */
export function withBelief(
  draft: RevealsDraft,
  node: string,
  change: (belief: Belief) => Belief,
): RevealsDraft {
  return node === INITIAL_NODE
    ? { ...draft, initial: change(draft.initial) }
    : withReveal(draft, node, (reveal) => ({ ...reveal, values: change(reveal.values) }));
}

/** A reveal just added: no point, no title, no choice yet. */
export function newReveal(languages: readonly string[]): RevealDraft {
  return {
    key: newRevealKey(),
    point: EMPTY_POINT,
    titles: Object.fromEntries(languages.map((language) => [language, ''])),
    groups: [],
    values: emptyBelief(languages),
  };
}

/** Whether a belief holds some value of `group`, in any language. */
function knows(definition: EntityDefinition, belief: Belief, group: string): boolean {
  return groupFields(definition, group).some((field) =>
    kindOf(field).localized
      ? Object.values(belief.translations).some((texts) => textOf(texts?.[field.key]).trim())
      : field.kind === 'relation' || field.kind === 'subcategory'
        ? belief[field.key] != null
        : field.kind === 'boolean'
          ? typeof belief[field.key] === 'boolean'
          : textOf(belief[field.key]).trim() !== '',
  );
}

/** The belief with the values of `group` taken from `source`. */
function withValuesOf(
  definition: EntityDefinition,
  belief: Belief,
  source: Belief,
  group: string,
): Belief {
  return groupFields(definition, group).reduce((changed, field) => {
    if (!kindOf(field).localized) {
      return withValue(changed, field.key, null, source[field.key] ?? null);
    }
    return Object.keys(source.translations).reduce(
      (written, language) =>
        withValue(written, field.key, language, source.translations[language]?.[field.key] ?? ''),
      changed,
    );
  }, belief);
}

/**
 * The reveal of `key` naming `group` too, kept in the definition's order. When it becomes the
 * choice's last mention, what the reader knew before - the earlier mention, else the first
 * appearance - starts from the current value, if nothing was written there yet: the editor then
 * changes what the reader believed, not the current value.
 */
export function withRevealedGroup(
  definition: EntityDefinition,
  draft: RevealsDraft,
  key: string,
  group: string,
  truth: Belief,
): RevealsDraft {
  const order = allGroups(definition);
  const named = withReveal(draft, key, (reveal) => ({
    ...reveal,
    groups: order.filter((candidate) => candidate === group || reveal.groups.includes(candidate)),
  }));
  const ordered = orderedReveals(named.reveals);
  const index = ordered.findIndex((reveal) => reveal.key === key);
  if (!isLastMention(ordered, index, group)) {
    return named;
  }
  const previous = ordered
    .slice(0, index)
    .reverse()
    .find(({ groups }) => groups.includes(group));
  const before = previous?.values ?? named.initial;
  if (knows(definition, before, group)) {
    return named;
  }
  return withBelief(named, previous?.key ?? INITIAL_NODE, (belief) =>
    withValuesOf(definition, belief, truth, group),
  );
}

/** The reveal of `key` no longer naming `group`. */
export function withoutGroup(draft: RevealsDraft, key: string, group: string): RevealsDraft {
  return withReveal(draft, key, (reveal) => ({
    ...reveal,
    groups: reveal.groups.filter((named) => named !== group),
  }));
}

/** A reveal's title in `language`; while a draft lacks it, "Reveal at ch. 100" or "New reveal". */
export function revealTitleOf(translate: Translate, reveal: RevealDraft, language: string): string {
  const title = reveal.titles[language]?.trim();
  if (title) {
    return title;
  }
  const point = storyPointShortLabel(translate, reveal.point);
  return point
    ? translate('content.reveals.untitled', { point })
    : translate('content.reveals.new', {});
}

/**
 * The languages a reveal still lacks a title or a learned name in, as submitting asks
 * (3.7.1): every title, and every translated value held, initial or learned.
 */
export function incompleteLanguages(
  definition: EntityDefinition,
  draft: RevealsDraft,
  languages: readonly string[],
): string[] {
  const ordered = orderedReveals(draft.reveals);
  const localizedOf = (groups: readonly string[]) =>
    fieldsOf(definition, groups).filter((field) => kindOf(field).localized);
  const holds = (belief: Belief, field: EntityField) =>
    languages.some((language) => textOf(belief.translations[language]?.[field.key]).trim());
  const missing = (belief: Belief, groups: readonly string[], language: string) =>
    localizedOf(groups).some(
      (field) => holds(belief, field) && !textOf(belief.translations[language]?.[field.key]).trim(),
    );
  return languages.filter(
    (language) =>
      missing(draft.initial, revealedGroups(definition, ordered), language) ||
      ordered.some(
        (reveal, index) =>
          !reveal.titles[language]?.trim() ||
          missing(
            reveal.values,
            reveal.groups.filter((group) => !isLastMention(ordered, index, group)),
            language,
          ),
      ),
  );
}

// --- Comparison (reveals plan R8, reveals decision 2) ---

/** How a reveal changed between two versions. */
export type RevealChange = 'ADDED' | 'REMOVED' | 'MODIFIED';

/** One reveal of the comparison, with what changed in it. */
export interface RevealDiff {
  readonly change: RevealChange;
  /** Its place in the order the reader meets them, from 1. */
  readonly position: number;
  /** The reveal as the version compared shows it - as the base did, where it was removed. */
  readonly reveal: RevealDraft;
  /** The choices it names, where they changed: in the definition's order. */
  readonly named: { readonly before: readonly string[]; readonly after: readonly string[] } | null;
  /** Its point, titles and the values learned there that changed. */
  readonly rows: readonly FieldDiff<EntityFieldRef>[];
}

/** The reveal's point in a comparison row: `revealedAt`, with the story point flag. */
export const REVEALED_AT = 'revealedAt';

/** The reveal's title in a comparison row, per language. */
export const REVEAL_TITLE = 'title';

/**
 * The reveals in the reader's order, each with the values the reader learns there: on the last
 * mention of a choice, the current value - so a value corrected shows on the reveal revealing it.
 */
function revealsLearned(
  definition: EntityDefinition,
  body: Readonly<Record<string, unknown>> | null,
  languages: readonly string[],
): RevealsDraft {
  if (!body) {
    return { initial: emptyBelief(languages), reveals: [] };
  }
  const truth = beliefOf(definition, body, languages);
  const draft = revealsDraftOf(definition, body, languages);
  const ordered = orderedReveals(draft.reveals);
  return {
    initial: draft.initial,
    reveals: ordered.map((reveal, index) => ({
      ...reveal,
      values: reveal.groups
        .filter((group) => isLastMention(ordered, index, group))
        .reduce((values, group) => withValuesOf(definition, values, truth, group), reveal.values),
    })),
  };
}

/** The values of `groups` of two beliefs compared field by field, each by its kind. */
function diffBeliefs(
  definition: EntityDefinition,
  groups: readonly string[],
  before: Belief | null,
  after: Belief | null,
  languages: readonly string[],
): FieldDiff<EntityFieldRef>[] {
  return fieldsOf(definition, groups)
    .flatMap((field) =>
      kindOf(field).localized
        ? languages.map((language) =>
            kindOf(field).diff<EntityFieldRef>(
              { field: field.key, language },
              before?.translations[language]?.[field.key],
              after?.translations[language]?.[field.key],
            ),
          )
        : [
            kindOf(field).diff<EntityFieldRef>(
              { field: field.key, language: null },
              before?.[field.key],
              after?.[field.key],
            ),
          ],
    )
    .filter((diff): diff is FieldDiff<EntityFieldRef> => diff !== null)
    .filter((diff) => diff.change !== 'UNCHANGED');
}

/** One reveal against the one at the same place - `null` for none. */
function diffReveal(
  definition: EntityDefinition,
  position: number,
  before: RevealDraft | null,
  after: RevealDraft | null,
  languages: readonly string[],
): RevealDiff | null {
  const point = diffField<EntityFieldRef>(
    { field: REVEALED_AT, language: null },
    before && isStoryPointFilled(before.point) ? comparedStoryPoint(before.point) : null,
    after && isStoryPointFilled(after.point) ? comparedStoryPoint(after.point) : null,
  );
  const titles = languages.map((language) =>
    diffField<EntityFieldRef>(
      { field: REVEAL_TITLE, language },
      before?.titles[language]?.trim() || null,
      after?.titles[language]?.trim() || null,
    ),
  );
  const groups = [...new Set([...(before?.groups ?? []), ...(after?.groups ?? [])])];
  const rows = [
    ...[point, ...titles].filter(
      (diff): diff is FieldDiff<EntityFieldRef> => diff !== null && diff.change !== 'UNCHANGED',
    ),
    ...diffBeliefs(definition, groups, before?.values ?? null, after?.values ?? null, languages),
  ];
  const was = before?.groups ?? [];
  const is = after?.groups ?? [];
  const named = was.join() === is.join() ? null : { before: was, after: is };
  if (before && after && !named && !rows.length) {
    return null;
  }
  return {
    change: !before ? 'ADDED' : !after ? 'REMOVED' : 'MODIFIED',
    position,
    reveal: (after ?? before) as RevealDraft,
    named,
    rows,
  };
}

/** The reveals of two versions compared: the initial knowledge, then each reveal by its place. */
export interface RevealsComparison {
  /** The initial values that changed, of the choices either version reveals. */
  readonly initial: readonly FieldDiff<EntityFieldRef>[];
  readonly reveals: readonly RevealDiff[];
}

/**
 * The reveals of two versions compared (reveals decision 2): the initial knowledge as a block of
 * fields, then the reveals matched by their place in the reader's order, as the other lists of
 * R8 are - one inserted reads as every later one changed. Reveals have no identity across
 * versions, and a point no longer tells them apart (several may share one, on two axes).
 */
export function diffReveals(
  definition: EntityDefinition,
  base: Readonly<Record<string, unknown>> | null,
  target: Readonly<Record<string, unknown>>,
  languages: readonly string[],
): RevealsComparison {
  const before = revealsLearned(definition, base, languages);
  const after = revealsLearned(definition, target, languages);
  const groups = [
    ...new Set([
      ...revealedGroups(definition, before.reveals),
      ...revealedGroups(definition, after.reveals),
    ]),
  ];
  const count = Math.max(before.reveals.length, after.reveals.length);
  return {
    initial: diffBeliefs(definition, groups, before.initial, after.initial, languages),
    reveals: Array.from({ length: count }, (_, index) =>
      diffReveal(
        definition,
        index + 1,
        before.reveals[index] ?? null,
        after.reveals[index] ?? null,
        languages,
      ),
    ).filter((diff): diff is RevealDiff => diff !== null),
  };
}

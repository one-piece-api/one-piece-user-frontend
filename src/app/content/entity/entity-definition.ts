/**
 * What sets one kind of content apart from the others, as data: where it lives, how it is
 * called and which fields it has. The entity pages are written once and read everything
 * specific from here (frontend ADR-0003).
 */
import type { VersionStatus } from '../content.model';

/** A text shared by every language, such as the romaji. */
export interface TextField {
  readonly kind: 'text';
  readonly key: string;
  /** The longest the text may be - the backend refuses a longer one. */
  readonly maxLength: number;
  /** Never asked for by review, never "missing" - an extra the content may do without. */
  readonly optional?: true;
  /** The language the text is written in (`ja`), where it is not the interface's own. */
  readonly lang?: string;
}

/**
 * An integer >= 0 shared by every language, such as a chapter number. The editor holds it as
 * the string typed; it is saved as a number.
 */
export interface NumberField {
  readonly kind: 'number';
  readonly key: string;
  /** The smallest it may be (the editor's `min`); 0 where absent. */
  readonly min?: number;
  /** Never asked for by review, never "missing" - an extra the content may do without. */
  readonly optional?: true;
}

/**
 * A text written once per language. Without `rows` it is a single line, such as the name;
 * with them, a long text the card shows as a section of its own.
 */
export interface LocalizedTextField {
  readonly kind: 'localizedText';
  readonly key: string;
  readonly maxLength: number;
  readonly rows?: number;
  /** Never asked for by review, never "missing" - an extra the content may do without. */
  readonly optional?: true;
}

/**
 * A pointer to another content - the type of a fruit. `target` is the `entityType` of the
 * content pointed to, looked up in the registry only when a screen needs its section: a
 * definition never imports another, which would make two entities that point to each other
 * (a fruit to its type, a type to its fruits) import in a circle.
 */
export interface RelationField {
  readonly kind: 'relation';
  readonly key: string;
  readonly target: string;
  /** Never asked for by review, never "missing" - an extra the content may do without. */
  readonly optional?: true;
  /** `false`: no column and no filter in the list - its rows do not carry it. */
  readonly listed?: false;
}

/**
 * One value among a closed set, shared by every language - the condition of a bounty. The
 * labels are `<i18n>.options.<key>.<VALUE>`; the JSON sends the value, `null` for none.
 */
export interface ChoiceField {
  readonly kind: 'choice';
  readonly key: string;
  readonly options: readonly string[];
  /** Where it is a part of a `partList` entry: shown only when the entry's other part says so. */
  readonly visibleWhen?: VisibleWhen;
  /** Where it is a part of a `partList` entry: the card words the value after the content chosen. */
  readonly labelBy?: LabelBy;
}

/**
 * The card words a choice after the content chosen in the relation part `part`, by its
 * `field`: a relative's kind by the relative's gender (`PARENT` is "father" for a man). The
 * labels are `<i18n>.<group>.<VALUE>.<FIELD VALUE>`; where the content has no such value the
 * neutral label of the choice stands. The editor always shows the neutral one: the content may
 * not be loaded, and the words would change under the editor's hands.
 */
export interface LabelBy {
  readonly part: string;
  readonly field: string;
  readonly group: string;
}

/**
 * A condition on a sibling part of the same entry: the content chosen in the relation part
 * `part` has `equals` in its `field` - a membership's rank only where the affiliation's kind is
 * `NAVY`. Choosing another content clears the part; a value already there stays on screen,
 * so it can be removed.
 */
export interface VisibleWhen {
  readonly part: string;
  readonly field: string;
  readonly equals: string;
}

/** A yes or no shared by every language - a bounty made inactive. Never missing: false by default. */
export interface BooleanField {
  readonly kind: 'boolean';
  readonly key: string;
  /**
   * `false` leaves the flag out of the card, where a badge already shows what it leads to (a
   * bounty marked withdrawn is "Inactive"); the editor and the comparison still show it.
   */
  readonly inCard?: false;
}

/** What each value of a badge looks like: the colors of an editorial status. */
export type BadgeTone = VersionStatus;

/**
 * A value the backend works out and sends with the version - the validity of a bounty - shown
 * as a pill: never written, never sent, never compared. Labels as for a choice.
 */
export interface BadgeField {
  readonly kind: 'badge';
  readonly key: string;
  readonly options: readonly string[];
  readonly tones: Readonly<Record<string, BadgeTone>>;
}

/**
 * What an uploaded image must be - the entity's image profile of the backend (plan D6),
 * written again here so the browser can refuse a file before sending it. The backend stays
 * the authority: these numbers only spare a round trip.
 */
export interface ImageProfile {
  /** The canvas the backend fits the image into; its ratio is the one an image must have. */
  readonly width: number;
  readonly height: number;
  /** The smallest image it accepts; the canvas' size where absent. */
  readonly minWidth?: number;
  readonly minHeight?: number;
  /** How far the image's ratio may be from the canvas', as a fraction (0.1 = 10 %). */
  readonly ratioTolerance: number;
  readonly maxBytes: number;
  readonly maxPixels: number;
  /** How much of the image must be fully transparent - "an image without background". */
  readonly minTransparentPercent: number;
}

/**
 * The image of a version - optional, not translated, not asked for by review. Saved beside
 * the version's JSON as a file, and removed through `remove<Key>`; one per entity, as the
 * backend's single `image` part allows.
 */
export interface ImageField {
  readonly kind: 'image';
  readonly key: string;
  readonly profile: ImageProfile;
  /** What the image should show, as a translation key - the flag of a group. */
  readonly hint?: string;
}

/**
 * A list of subcategories the content defines, in display order - the Zoan's Ancient,
 * Mythical, Artificial. Each has an id given by the backend and a name and a description per
 * language, both asked for by review; part of the version, so reviewed and published with it.
 */
export interface SubcategoryListField {
  readonly kind: 'subcategoryList';
  readonly key: string;
  readonly nameMaxLength: number;
  readonly descriptionMaxLength: number;
}

/**
 * One subcategory of the content a relation of the same entity points to - the Mythical of a
 * fruit's Zoan. `of` is the key of that relation: its reference carries the choices, and
 * choosing another content clears this one. Optional: most contents have none.
 */
export interface SubcategoryField {
  readonly kind: 'subcategory';
  readonly key: string;
  readonly of: string;
}

/**
 * The dates something came out, one per country - a volume's releases, an episode's
 * broadcasts - sent as `{country, date}` (ISO country code, `YYYY-MM-DD`). Optional, not
 * translated; the editor gives each entry a key of its own (`entity-release.ts`).
 */
export interface ReleaseListField {
  readonly kind: 'releaseList';
  readonly key: string;
}

/**
 * A first appearance: the chapter, the episode, or both where the reader first meets a
 * content - `{ chapter, episode }` in the JSON, filled with either. Shared by every language.
 */
export interface StoryPointField {
  readonly kind: 'storyPoint';
  readonly key: string;
  /** Never asked for by review, never "missing" - an extra the content may do without. */
  readonly optional?: true;
}

/**
 * A day of the year without a year - a birthday - sent as ISO 8601 `--MM-DD` (`--05-05`),
 * `null` for none. Optional, never asked for by review; 29 February is a day like any other.
 */
export interface MonthDayField {
  readonly kind: 'monthDay';
  readonly key: string;
}

/** The kinds a part of a `partList` entry may have: values of one entry, never lists or files. */
export type PartField = TextField | LocalizedTextField | RelationField | ChoiceField | BooleanField;

/**
 * An ordered list of entries inside the version, each made of `parts` - fields of the kinds
 * above: a character's epithets, aliases, species. Each part is read, saved and compared by
 * its own kind (`entity-part-list.ts`). A list of one part that is not localized travels as
 * bare values (`["Sogeking"]`, `[id]`); any other as one object per entry, keyed by part, a
 * localized part being a map of language to text (`{ text: { it, en } }`). Never required.
 */
export interface PartListField {
  readonly kind: 'partList';
  readonly key: string;
  readonly parts: readonly PartField[];
  /** The most entries the backend accepts; the editor offers no more. */
  readonly maxEntries?: number;
  /**
   * The key of the part no two entries may share - the species, the alias. It identifies
   * an entry across versions, so a comparison sees it move; without it, entries are matched
   * by position.
   */
  readonly unique?: string;
  /**
   * The list filter of the backend that narrows the entity's list to the contents naming a
   * given one: its query parameter `key`, and the relation part `part` it is about. For a list
   * of several parts, which the list cannot work out by itself - a membership's affiliation.
   */
  readonly filterBy?: { readonly key: string; readonly part: string };
}

/** One field of an entity: its kind says how it is read, written, checked and compared. */
export type EntityField =
  | TextField
  | NumberField
  | LocalizedTextField
  | RelationField
  | ImageField
  | SubcategoryListField
  | SubcategoryField
  | ReleaseListField
  | StoryPointField
  | ChoiceField
  | BooleanField
  | BadgeField
  | MonthDayField
  | PartListField;

export type FieldKindName = EntityField['kind'];

/**
 * A column of the list that counts the contents of another entity pointing to each row - how
 * many fruits a type has. `field` is where the row carries the number, `of` the entity
 * counted (its `entityType`) and `by` the key of its relation to this one, which is also the
 * filter that narrows its list to those contents.
 */
export interface CountColumn {
  readonly field: string;
  readonly of: string;
  readonly by: string;
}

/**
 * A section of the card of the current version, under its fields: the contents of another
 * entity that point to this one, a few of them and a way to see all. Not part of the version
 * - they change on their own - so an older version does not show it.
 */
export interface RelatedListSection {
  readonly kind: 'relatedList';
  /** The entity listed (its `entityType`). */
  readonly of: string;
  /** The key of its relation to this entity, also the filter that narrows its list. */
  readonly by: string;
}

/**
 * A section of the card listing the contents of the same entity a version is linked with, as
 * the backend sends them under `field` - the chain of a bounty, newest first, itself included.
 * Each entry leads to its content; the one on screen is marked. Hidden when it lists only that one.
 */
export interface ChainSection {
  readonly kind: 'chain';
  readonly field: string;
}

/**
 * A section of the card listing the contents that name this one in a list of theirs, as the
 * backend sends them under `field` - each with the kind of tie seen from this side, worded after
 * the relative's `gender` (`group`). Not part of the version, so shown on the current one only.
 */
export interface RelativeListSection {
  readonly kind: 'relativeList';
  readonly field: string;
  /** The i18n group of the gendered labels of the kind (`<i18n>.<group>.<KIND>.<GENDER>`). */
  readonly group: string;
}

export type EntitySection = RelatedListSection | ChainSection | RelativeListSection;

/** A column of the list showing an amount in Berry, formatted for the reader. */
export interface BerryColumn {
  readonly kind: 'berry';
  readonly field: string;
  /** Whether the backend sorts by it (`sort=<field>`). */
  readonly sortable?: true;
}

/** A column of the list showing a badge field of the row (`BadgeField`). */
export interface BadgeColumn {
  readonly kind: 'badge';
  readonly field: string;
}

export type ListColumn = BerryColumn | BadgeColumn;

/**
 * A filter of the list by one value of a closed set, sent as `<key>=<VALUE>`; titled
 * `content.list.column.<key>`, its values labelled as the field `field` - the key where
 * absent - is (`<i18n>.options.<field>.<VALUE>`): the backend's `characterStatus` filters
 * the field `status`.
 */
export interface ChoiceFilter {
  readonly key: string;
  readonly options: readonly string[];
  readonly field?: string;
}

/** What the list of an entity shows besides what every list shows. */
export interface ListDefinition {
  /** The value of the row its name is: the localized name or the natural key where absent. */
  readonly nameField?: string;
  /**
   * Whether the search box hints with the entity's own words (`<i18n>.searchPlaceholder`):
   * for a search that is neither by name and romaji nor by number - a bounty's name and amount.
   */
  readonly ownSearchPlaceholder?: boolean;
  readonly columns?: readonly ListColumn[];
  readonly filters?: readonly ChoiceFilter[];
}

export interface EntityDefinition {
  /** The kind of content, as the API names it. */
  readonly entityType: string;
  /** Its section in the app, e.g. `/content/devil-fruit-types`. */
  readonly route: string;
  /** Its section in the API, e.g. `/api/content/devil-fruit-types`. */
  readonly api: string;
  /** The prefix of its own translation keys: `title`, `one`… below it. */
  readonly i18n: string;
  readonly icon: string;
  /** The key of the localized text that names a content: `name`, `title`. Absent for one without. */
  readonly labelField?: string;
  /**
   * What a content without a localized name is called - its own body, or a reference to it,
   * which carries the same fields - in the interface's language; `null` while nothing names it.
   */
  readonly label?: (body: Readonly<Record<string, unknown>>, language: string) => string | null;
  /**
   * The key of the field - text or number kind - whose value is unique within the entity and
   * is the source of its public slug: `romaji` for the Devil Fruit and its type. Several keys
   * for a composite one, unique together: the poster name and the amount of a bounty.
   */
  readonly naturalKey: string | readonly string[];
  /** Its fields, in the order they are read. */
  readonly fields: readonly EntityField[];
  /** Counts of other contents that point to it, as columns of its list. */
  readonly counts?: readonly CountColumn[];
  /** What its card shows besides its fields. */
  readonly sections?: readonly EntitySection[];
  /** What its list shows besides what every list shows. */
  readonly list?: ListDefinition;
}

export function textField(key: string, options: Omit<TextField, 'kind' | 'key'>): TextField {
  return { kind: 'text', key, ...options };
}

export function numberField(
  key: string,
  options: Omit<NumberField, 'kind' | 'key'> = {},
): NumberField {
  return { kind: 'number', key, ...options };
}

export function localizedTextField(
  key: string,
  options: Omit<LocalizedTextField, 'kind' | 'key'>,
): LocalizedTextField {
  return { kind: 'localizedText', key, ...options };
}

export function relationField(
  key: string,
  options: Omit<RelationField, 'kind' | 'key'>,
): RelationField {
  return { kind: 'relation', key, ...options };
}

export function imageField(
  key: string,
  profile: ImageProfile,
  options: Pick<ImageField, 'hint'> = {},
): ImageField {
  return { kind: 'image', key, profile, ...options };
}

export function subcategoryListField(
  key: string,
  options: Omit<SubcategoryListField, 'kind' | 'key'>,
): SubcategoryListField {
  return { kind: 'subcategoryList', key, ...options };
}

export function subcategoryField(
  key: string,
  options: Omit<SubcategoryField, 'kind' | 'key'>,
): SubcategoryField {
  return { kind: 'subcategory', key, ...options };
}

export function releaseListField(key: string): ReleaseListField {
  return { kind: 'releaseList', key };
}

export function storyPointField(
  key: string,
  options: Omit<StoryPointField, 'kind' | 'key'> = {},
): StoryPointField {
  return { kind: 'storyPoint', key, ...options };
}

export function choiceField(key: string, options: Omit<ChoiceField, 'kind' | 'key'>): ChoiceField {
  return { kind: 'choice', key, ...options };
}

export function booleanField(
  key: string,
  options: Omit<BooleanField, 'kind' | 'key'> = {},
): BooleanField {
  return { kind: 'boolean', key, ...options };
}

export function badgeField(key: string, options: Omit<BadgeField, 'kind' | 'key'>): BadgeField {
  return { kind: 'badge', key, ...options };
}

export function monthDayField(key: string): MonthDayField {
  return { kind: 'monthDay', key };
}

export function partListField(
  key: string,
  options: Omit<PartListField, 'kind' | 'key'>,
): PartListField {
  return { kind: 'partList', key, ...options };
}

export function countColumn(field: string, options: Omit<CountColumn, 'field'>): CountColumn {
  return { field, ...options };
}

export function relatedList(options: Omit<RelatedListSection, 'kind'>): RelatedListSection {
  return { kind: 'relatedList', ...options };
}

export function relativeListSection(field: string, group: string): RelativeListSection {
  return { kind: 'relativeList', field, group };
}

export function chainSection(field: string): ChainSection {
  return { kind: 'chain', field };
}

export function berryColumn(
  field: string,
  options: Omit<BerryColumn, 'kind' | 'field'> = {},
): BerryColumn {
  return { kind: 'berry', field, ...options };
}

export function badgeColumn(field: string): BadgeColumn {
  return { kind: 'badge', field };
}

export function choiceFilter(
  key: string,
  options: readonly string[],
  extra: Pick<ChoiceFilter, 'field'> = {},
): ChoiceFilter {
  return { key, options, ...extra };
}

/** The keys of the natural key, one for most entities, several for a composite one. */
export function naturalKeyParts(definition: EntityDefinition): readonly string[] {
  return typeof definition.naturalKey === 'string'
    ? [definition.naturalKey]
    : definition.naturalKey;
}

/**
 * Whether the contents are numbered - a saga, a chapter - rather than known by a text key. A
 * composite key is never a number alone, even with a number in it (a bounty's amount).
 */
export function isNumbered(definition: EntityDefinition): boolean {
  const { naturalKey } = definition;
  return (
    typeof naturalKey === 'string' &&
    definition.fields.some((field) => field.key === naturalKey && field.kind === 'number')
  );
}

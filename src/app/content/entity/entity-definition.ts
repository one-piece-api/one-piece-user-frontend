/**
 * What sets one kind of content apart from the others, as data: where it lives, how it is
 * called and which fields it has. The entity pages are written once and read everything
 * specific from here (frontend ADR-0003).
 */

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
 * A point on the reader's axis (plan timeline, T7): the chapter where the reader first meets
 * a content, or learns of an event - `{ chapter }` in the JSON. Shared by every language.
 * The episode is an open door: the editor shows it disabled, "coming soon".
 */
export interface StoryPointField {
  readonly kind: 'storyPoint';
  readonly key: string;
  /** Never asked for by review, never "missing" - an extra the content may do without. */
  readonly optional?: true;
}

/**
 * A point on the world's axis (plan timeline, T3-T4): when an event happens or ends - a
 * chapter, in the story, or a world date, before it. Shared by every language.
 */
export interface EventTimeField {
  readonly kind: 'eventTime';
  readonly key: string;
  /** Never asked for by review, never "missing": an end, only for long events. */
  readonly optional?: true;
  /** The time field this one must not come before: an end, after its start. */
  readonly notBefore?: string;
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
  | EventTimeField;

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

export type EntitySection = RelatedListSection;

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
  /** The key of the localized text that names a content: `name`, `title`. */
  readonly labelField: string;
  /**
   * The key of the field - text or number kind - whose value is unique within the entity and
   * is the source of its public slug: `romaji` for the Devil Fruit and its type.
   */
  readonly naturalKey: string;
  /** Its fields, in the order they are read. */
  readonly fields: readonly EntityField[];
  /** Counts of other contents that point to it, as columns of its list. */
  readonly counts?: readonly CountColumn[];
  /** What its card shows besides its fields. */
  readonly sections?: readonly EntitySection[];
  /**
   * Where it is written: a page of its own (the default), or a dialog over the page it is
   * opened from - an event, created from its list or from a fruit (`EditorDialogs`).
   */
  readonly editor?: 'page' | 'dialog';
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

export function imageField(key: string, profile: ImageProfile): ImageField {
  return { kind: 'image', key, profile };
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

export function eventTimeField(
  key: string,
  options: Omit<EventTimeField, 'kind' | 'key'> = {},
): EventTimeField {
  return { kind: 'eventTime', key, ...options };
}

export function countColumn(field: string, options: Omit<CountColumn, 'field'>): CountColumn {
  return { field, ...options };
}

export function relatedList(options: Omit<RelatedListSection, 'kind'>): RelatedListSection {
  return { kind: 'relatedList', ...options };
}

/** Whether the contents are numbered - a saga, a chapter - rather than known by a text key. */
export function isNumbered(definition: EntityDefinition): boolean {
  return definition.fields.some(
    (field) => field.key === definition.naturalKey && field.kind === 'number',
  );
}

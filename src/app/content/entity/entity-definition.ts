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
}

/**
 * A text written once per language. Without `rows` it is a single line, such as the name;
 * with them, a long text the card lays out `wide` (across the card) or as a `pair` (side by
 * side with the next one).
 */
export interface LocalizedTextField {
  readonly kind: 'localizedText';
  readonly key: string;
  readonly maxLength: number;
  readonly rows?: number;
  readonly layout?: 'wide' | 'pair';
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
}

/** One field of an entity: its kind says how it is read, written, checked and compared. */
export type EntityField = TextField | LocalizedTextField | RelationField;

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
  /** Its fields, in the order they are read. */
  readonly fields: readonly EntityField[];
  /** Counts of other contents that point to it, as columns of its list. */
  readonly counts?: readonly CountColumn[];
  /** What its card shows besides its fields. */
  readonly sections?: readonly EntitySection[];
}

export function textField(key: string, options: Omit<TextField, 'kind' | 'key'>): TextField {
  return { kind: 'text', key, ...options };
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

export function countColumn(field: string, options: Omit<CountColumn, 'field'>): CountColumn {
  return { field, ...options };
}

export function relatedList(options: Omit<RelatedListSection, 'kind'>): RelatedListSection {
  return { kind: 'relatedList', ...options };
}

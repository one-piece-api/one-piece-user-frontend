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

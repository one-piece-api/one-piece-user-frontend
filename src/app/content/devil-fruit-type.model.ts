/**
 * Mirrors one-piece-content-service's DTOs (Step 1, UF-CNT-01/02). Languages are hardcoded
 * here rather than fetched: the catalog is read-only until Step 10 adds ADMIN CRUD for it,
 * so there is nothing to fetch yet.
 */
export const LANGUAGES = ['it', 'en'] as const;
export type LanguageCode = (typeof LANGUAGES)[number];

export interface Translation {
  name: string | null;
  description: string | null;
}

export type TranslationMap = Partial<Record<LanguageCode, Translation>>;

export interface WorkingRevisionDetail {
  id: string;
  itemId: string;
  romaji: string | null;
  status: string;
  translations: TranslationMap;
  updatedAt: string;
  authorEmail: string | null;
  claimedByEmail: string | null;
  rejectionReason: string | null;
  /** UF-CNT-11: "Elimina bozza" is shown only while this is false. */
  everPublished: boolean;
}

export interface WorkingRevisionSummary {
  id: string;
  itemId: string;
  entityType: string;
  romaji: string | null;
  displayName: string | null;
  status: string;
  updatedAt: string;
  rejectionReason: string | null;
}

/** One row of the shared "In Revisione" queue (Step 3) - every author's `IN_REVIEW` work. */
export interface ReviewQueueItem {
  id: string;
  itemId: string;
  entityType: string;
  romaji: string | null;
  displayName: string | null;
  authorEmail: string | null;
  claimedByEmail: string | null;
  updatedAt: string;
}

/**
 * One row of "Enciclopedia" (Step 5) - item-keyed, not working-revision-keyed, unlike
 * every other list in this module: once published there's no single working revision
 * left representing "the" item. `workingRevisionId` is non-null only for a `REVIEWED`
 * row - it's the id Publish actually acts on.
 */
export interface EncyclopediaItem {
  itemId: string;
  workingRevisionId: string | null;
  entityType: string;
  romaji: string | null;
  displayName: string | null;
  status: string;
  updatedAt: string;
}

/**
 * `sequenceNumber`/`publisherEmail` are set once `status` is `PUBLISHED` or `RETIRED`
 * (Step 8) - for a retired item they describe its last live version.
 */
export interface EncyclopediaItemDetail {
  itemId: string;
  workingRevisionId: string | null;
  romaji: string | null;
  status: string;
  translations: TranslationMap;
  updatedAt: string;
  sequenceNumber: number | null;
  publisherEmail: string | null;
}

export interface UpdateDraftRequest {
  romaji: string;
  translations: TranslationMap;
}

/**
 * One row of Step 7's "Storico versioni" - a published snapshot, `content:publish` only.
 * No content fields: the panel is a list to pick a rollback target from, not a diff
 * viewer - see {@link EncyclopediaItemDetail} for the currently-shown content.
 */
export interface ContentVersion {
  id: string;
  sequenceNumber: number;
  publisherEmail: string | null;
  publishedAt: string;
  live: boolean;
}

export const EMPTY_TRANSLATION: Translation = { name: '', description: '' };

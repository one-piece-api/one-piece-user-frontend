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

export interface UpdateDraftRequest {
  romaji: string;
  translations: TranslationMap;
}

export const EMPTY_TRANSLATION: Translation = { name: '', description: '' };

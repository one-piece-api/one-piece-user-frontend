import { httpResource } from '@angular/common/http';
import { Injectable } from '@angular/core';

const LANGUAGES_ENDPOINT = '/api/content/languages';

/** One row of the ADMIN-managed language catalog - a code and its full display name. */
export interface LanguageEntry {
  code: string;
  name: string;
}

/**
 * The ADMIN-managed language catalog (docs/user-flows/authentication-and-user-management.md
 * 3.2, Step 10) - shared by every content screen that renders per-language tabs (Le mie
 * bozze, In Revisione, Enciclopedia) and by the admin management screen itself. One request
 * per app session rather than one per page (`providedIn: 'root'`, same singleton pattern as
 * `CurrentUserService`), since the endpoint is reachable by any authenticated caller and its
 * data is identical for all of them.
 */
@Injectable({ providedIn: 'root' })
export class LanguageCatalogService {
  readonly languages = httpResource<LanguageEntry[]>(() => LANGUAGES_ENDPOINT);
}

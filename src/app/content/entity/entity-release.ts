/**
 * The dates a content came out, one per country - a volume's releases, an episode's
 * broadcasts - as the API shows them and as the editor holds them. No Angular in here.
 */

/** A release of a saved version: an ISO 3166-1 country code and a `YYYY-MM-DD` date. */
export interface SavedRelease {
  readonly country: string;
  readonly date: string;
}

/** A release while it is written: `key` tells the rows apart on screen, either part may be empty. */
export interface ReleaseDraft {
  readonly key: string;
  country: string;
  date: string;
}

/** The ISO 3166-1 alpha-2 codes, the official list, sorted. */
export const COUNTRY_CODES: readonly string[] = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS ' +
  'BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE ' +
  'EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM ' +
  'HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC ' +
  'LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA ' +
  'NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
  'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO ' +
  'TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(' ');

let nextKey = 0;

/** A key for a row of the editor, unique while the page lives. */
export function newReleaseKey(): string {
  return `release-${nextKey++}`;
}

/** The releases of a value read from the API, in order; none for anything else. */
export function releasesOf(value: unknown): SavedRelease[] {
  return Array.isArray(value)
    ? value.filter(
        (entry): entry is SavedRelease =>
          typeof entry?.country === 'string' && typeof entry?.date === 'string',
      )
    : [];
}

/** The releases by date, then country - the order a card lists them in. */
export function releasesInOrder(value: unknown): SavedRelease[] {
  return releasesOf(value).sort(
    (a, b) => a.date.localeCompare(b.date) || a.country.localeCompare(b.country),
  );
}

/** The day written out in `language` ("20 October 1997"); the `YYYY-MM-DD` text where it is no date. */
export function releaseDateLabel(date: string, language: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(day.getTime())
    ? date
    : new Intl.DateTimeFormat(language, { dateStyle: 'long', timeZone: 'UTC' }).format(day);
}

/** The country in `language` (`Japan`, `Giappone`); the code itself where the browser has no name. */
export function countryName(code: string, language: string): string {
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

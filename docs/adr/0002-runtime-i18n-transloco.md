# ADR-0002: Internazionalizzazione runtime con Transloco (italiano/inglese)

## Contesto

L'intera UI (frontend Angular e tema Keycloak) era in una sola lingua fissa
per componente: inglese nel codice del frontend (copy statica nei template),
italiano nel tema di login Keycloak (`one-piece-keycloak-theme`,
`messages_it.properties`, ADR-0010 in quel repo). Serviva invece una UI
bilingue (italiano/inglese) con switch esplicito dall'utente, di default sul
locale del chiamante (italiano se il browser è in italiano, altrimenti
inglese).

Il meccanismo nativo di Angular (`@angular/localize`) traduce a build-time:
genera un bundle JS separato per lingua, servito su path diversi - lo switch
lato utente richiederebbe un reload su un altro bundle, non un cambio
istantaneo nella stessa sessione. Non è la primitiva giusta per uno switch
in-app.

## Decisione

**`@jsverse/transloco`** (successore mantenuto di `ngx-translate`, l'altra
libreria diffusa per questo esatto caso d'uso - i18n Angular runtime via
dizionari JSON) invece di un servizio custom scritto a mano.

- `public/i18n/it.json` / `en.json`: due dizionari piatti, namespace per
  feature (`shell`, `mascot`, `users`, `roles`, `audit`, ecc.), serviti come
  asset statici (`public/` è già mappato alla root, vedi `angular.json`).
- `src/app/i18n/transloco-loader.ts`: `TranslocoLoader` che fetcha
  `/i18n/{lang}.json` via `HttpClient` - nessuna scope/lazy-loading, i due
  cataloghi sono piccoli abbastanza da non giustificarla.
- `src/app/i18n/locale.ts`: `resolveInitialLocale()` - una scelta salvata in
  `localStorage` vince sempre; altrimenti `detectBrowserLocale()` (tramite
  l'utility `getBrowserCultureLang()` di Transloco, che legge
  `navigator.language`) decide italiano se il browser è `it-*`, altrimenti
  inglese. Stessa negoziazione che userà nativamente il tema Keycloak una
  volta con due `supportedLocales` (vedi ADR-0010 in
  `one-piece-keycloak-theme`) - stesso criterio su entrambe le superfici,
  senza introdurre geolocalizzazione IP (servizio esterno a pagamento, in
  conflitto con il vincolo Oracle Always Free, latenza e falsi positivi con
  VPN/viaggiatori).
- `src/app/i18n/language.service.ts`: sincronizza `<html lang>` e la
  preferenza salvata con `TranslocoService.activeLang` (signal); lo switcher
  IT/EN in `AppShell` chiama solo `setLanguage()`.
- Ogni stringa di copy statica nei template passa dal pipe `| transloco`;
  quelle costruite in TypeScript (messaggi del Den Den Mushi, validatori dei
  form firmati Signal Forms, `formatAuditMessage`) leggono
  `TranslocoService.translate()`/`activeLang()` esplicitamente, non tramite
  hook nascosti - vedi i commenti in `mascot.ts`, `audit.model.ts`,
  `invite-user-form.ts`.

## Alternative considerate

- **Servizio custom leggero** (signal + dizionari JSON, senza libreria):
  zero nuove dipendenze, ma richiede scrivere a mano interpolazione
  parametri, plurali e le utility di test (`TranslocoTestingModule` usata in
  ogni spec via `src/app/testing/i18n-testing.ts`). Per un catalogo di
  centinaia di chiavi con parametri (`{{username}}`, conteggi, ecc.) la
  libreria copre casi che altrimenti si sarebbero dovuti reinventare.
- **Geolocalizzazione IP** per il locale di default: scartata, vedi sopra -
  nessun bisogno concreto di sapere la posizione fisica reale quando la
  lingua del browser è già il segnale standard, gratuito e coerente con
  Keycloak.

## Conseguenze

- Nuova dipendenza di produzione (`@jsverse/transloco`, ~19 pacchetti
  transitivi); bundle iniziale cresciuto di circa 14 kB (budget
  `angular.json` alzato da 500 kB a 550 kB di warning).
- Ogni nuova stringa UI va aggiunta a **entrambi** `it.json` ed `en.json` -
  nessun controllo automatico di parità chiavi tra i due file oggi; una
  chiave mancante in un catalogo si vede a runtime come chiave grezza
  mostrata invece del testo tradotto (comportamento di default del
  "missing handler" di Transloco).
- La formattazione di date (`Intl.DateTimeFormat`, date-picker e diario di
  bordo) segue ora la lingua scelta nell'app, non più il locale del sistema
  operativo del browser - scelta deliberata per coerenza percepita (vedi
  `date-picker.ts`/`audit.model.ts`), diversa dal comportamento Angular di
  default.

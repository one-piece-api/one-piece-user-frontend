# ADR-0008: Finestre sulle voci delle liste e liste annidate

## Contesto

Con l'asse del lettore (ADR-0011 di content-service) ogni voce delle liste del Personaggio ha
una finestra: `discovered` (dove il lettore la scopre, chiesta in revisione) ed `ended`
(facoltativa, la rende "ex"). Un'appartenenza diventa `{ affiliation, periods: [...] }`, con
ruolo, grado e finestra per periodo. `former` sparisce: si deduce. Il backend rifiuta i punti
con messaggi solo in inglese, senza codice (piano reveals, R8, decisioni 1-6).

## Decisione

Due aggiunte a `partList` (ADR-0007), dichiarative:

| Aggiunta                  | Definizione                                       | Editor → JSON                                                                                         |
| ------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `windowed: true`          | sul `partList`                                    | ogni voce ha anche `discovered`/`ended` (`storyPoint`); una lista di una parte non è più "nuda"       |
| `partList` come **parte** | un livello solo (`periods` dentro `affiliations`) | lo stesso componente in modo ricorsivo; `visibleWhen` legge anche i valori della voce che lo contiene |

- **Editor:** `discovered` sempre visibile, `ended` dietro "+ Fine" (✕ per toglierla). I selettori
  seguono gli assi della prima apparizione: senza prima apparizione non ce ne sono, un asse
  mancante è disattivato, un punto già scritto su un asse sparito resta segnalato. Le regole
  d'ordine restano al backend.
- **Revisione:** `discovered` per ogni voce inviata; ogni appartenenza chiede almeno un periodo
  (`periods.count`) e `discovered` di ogni periodo (`subPosition`).
- **Scheda:** riga "Scoperta: Cap. 1 — Fine: Cap. 8" e badge "Ex…" dedotto (`isFormer`): una
  voce con `ended`; un'appartenenza quando tutti i periodi sono finiti.
- **Confronto:** anche finestre e periodi; i periodi si abbinano per posizione.
- **Errori:** percorsi annidati (`affiliations[0].periods[1].discovered.episode` →
  `affiliations.0.periods.1.discovered.episode`), indici riportati alla bozza a ogni livello. I
  messaggi dei punti passano da una tabella messaggio → chiave (`point-refusals.ts`) con un testo
  generico se il messaggio è nuovo; uno spec fissa i nove testi.
- **Blocchi 409:** `STORY_POINT_OUT_OF_RANGE` e il capitolo/episodio di un punto non online
  (`RELATED_NOT_ONLINE` con `field`) nominano il campo a parole (`field-words.ts`), con
  l'entità presa dal token `ENTITY` della rotta.

## Alternative considerate

- **Un tipo di campo `periodList` apposta:** duplica editor, revisione e confronto di `partList`.
- **Finestra come parti scritte nella definizione:** sei copie di `discovered`/`ended`, e nessun
  punto unico per badge e assi.
- **Mostrare il messaggio inglese del backend:** viola IT/EN ovunque; serve un codice per regola,
  che oggi il backend non dà (se arriva, la tabella si sostituisce).

## Conseguenze

- Una lista con finestra è una riga di definizione; i test id del sotto-editor hanno il prefisso
  `sub-` per non coprire quelli esterni.
- La tabella dei messaggi va aggiornata quando `ReaderAxisRules` cambia un testo; lo spec lo
  segnala.

## Addendum: sezioni di paragrafi (R8, 2026-11-01)

**Contesto.** Con R3 (ADR-0011 di content-service, addendum paragrafi) ogni testo lungo diventa una
sezione di paragrafi: `description: [{ text: {lang}, discovered, ended }]` (Frutto e Tipo anche
`advantages`/`disadvantages`), max 50 paragrafi da 2000 caratteri. Le traduzioni tengono solo il
nome. In revisione una sezione chiede un paragrafo scoperto alla prima apparizione (Saga e Arco,
senza prima apparizione: almeno un paragrafo).

**Decisione.** Una sezione è un `partList` con finestra e i flag `paragraphs: true` e `opensAtFirstAppearance: true`, costruito da
`paragraphListField(key, { rows })`: nessun nuovo tipo di campo.

- **Etichette:** `labelKeyOf` mette le sezioni sotto `paragraphs.<key>`, perché Capitolo ed Episodio
  tengono una `description` localizzata semplice con le stesse chiavi i18n.
- **Editor:** testo in `textarea` (righe da `rows`), una lingua alla volta (vedi addendum switch di lingua).
- **Revisione:** `openingRule` (prima `paragraphSectionRule`) sceglie `atFirstAppearance` (paragrafo con `discovered`
  sugli stessi assi della prima apparizione, `isAtStoryPoint`) o `count`; la stessa regola dà le
  parole dell'errore `description` del backend.
- **Scheda:** tutti i paragrafi in ordine; quelli con `ended` attenuati, con badge "Superato" e la
  riga della finestra.

**Alternative.** Un tipo `paragraphList`: duplica editor, revisione e confronto. Regola di revisione
lasciata solo al backend: la checklist non saprebbe dire cosa manca prima dell'invio.

**Conseguenze.** Una sezione è una riga di definizione; la regola della prima apparizione vive in
due posti (backend e checklist): se cambia nel workflow, vanno cambiati entrambi.

## Addendum: galleria del personaggio (R8, 2026-11-02)

**Contesto.** Con R5 (ADR-0011 di content-service, addendum galleria) il ritratto singolo del
personaggio diventa `gallery: [{ image, kind: ASPETTO|FORMA, caption: {lang} ≤100, discovered,
ended }]`, max 20. Il salvataggio è multipart: JSON nella parte `version`, file nella parte
ripetuta `images`; ogni voce nomina `upload: n` (n-esimo file) o `imageId` (immagine già della
bozza). In revisione serve un ASPETTO scoperto alla prima apparizione. Il ritratto principale senza
filtro è l'ultimo ASPETTO senza fine, altrimenti l'ultimo ASPETTO (`Gallery.mainPortrait`).

**Decisione.** La galleria è un `partList` con finestra, costruito da `galleryField(key, profile)`,
con un nuovo tipo di parte `image` e due impostazioni della lista:

- **`opensAtFirstAppearance: true | { part, equals }`:** generalizza la regola di apertura delle
  sezioni (`openingRule`); la condizione filtra le voci contate (solo gli ASPETTO).
- **`mainPortrait: { part, equals }`:** `mainPortraitIndex` (`entity-gallery.ts`) replica la regola
  della libreria; badge "Ritratto principale" su editor e scheda, e la scheda usa quel ritratto come
  immagine dell'entità quando non ha un campo immagine.
- **Salvataggio:** `uploadOf` toglie la parte immagine dal JSON e numera i file scelti nell'ordine
  delle voci inviate; `Upload.files` ne porta più d'uno.
- **Errori:** un'immagine rifiutata con `field: gallery[i].image` è mostrata sulla sua voce.
- **Confronto:** voci per posizione, l'immagine confrontata per id e mostrata in miniatura.

**Alternative.** Un tipo di campo `gallery` dedicato: duplica editor, finestre, revisione e
confronto delle liste. Regola del ritratto solo nel backend: editor e scheda non potrebbero dire
quale immagine vedrà il lettore prima della pubblicazione.

**Conseguenze.** La regola del ritratto principale vive in tre posti (libreria, vista
`published.character`, frontend), tenuti uguali dagli stessi casi nei test; quella a una posizione
del lettore resta solo nel backend.

## Addendum: switch di lingua nelle liste (R8, 2026-11-02)

**Contesto.** Le parti localizzate delle liste (epiteti, ruoli dei periodi, paragrafi, didascalie)
mostravano un campo per lingua insieme, mentre i campi tradotti dell'editor usano le linguette
IT/EN con un campo alla volta. Il proprietario vuole lo stesso schema ovunque.

**Decisione.** Ogni lista con testo per lingua (proprio o di una lista annidata) ha uno switch IT/EN
nell'intestazione: uno per sezione, non per voce. Parte dalla lingua delle linguette dell'editor e
la segue quando cambia (`defaultLanguage`, `linkedSignal`), ma si cambia anche da solo. Una lista
annidata non ha switch: segue quella che la contiene (`language`). Ogni lingua mostra "incompleta"
se una voce inviata manca di un testo chiesto in revisione, "da correggere" se il backend ne ha
rifiutato uno. Bottoni con `aria-pressed` in un `role="group"`, non `role="tab"`: lo switch non
apre pannelli, cambia i campi sul posto.

**Alternative.** Uno switch per voce: più flessibile, più clic per scrivere tutte le didascalie in
una lingua. Le linguette dell'editor come unico switch: la lingua dei campi tradotti e quella delle
liste non si potrebbero guardare separatamente.

**Conseguenze.** Gli e2e scrivono le lingue passando dallo switch (`inEachLanguage`); un rifiuto
in una lingua nascosta resta visibile come segno sullo switch.

# ADR-0007: Campi della timeline e rivelazioni lette in avanti

## Contesto

Il piano timeline di `one-piece-api` (TL4) porta nel back-office due assi: quello del lettore
(capitolo in cui un contenuto appare o un evento viene rivelato) e quello del mondo (quando un
evento accade, nella storia o prima). Il Frutto del Diavolo ha anche delle **rivelazioni**: ciò
che il lettore crede all'inizio e ciò che impara capitolo dopo capitolo. Il content-service le
salva **in avanti** (T13, TL3c, ADR-0010 del backend): i campi principali sono la verità,
`initialKnowledge` dice cosa sa il lettore alla prima apparizione, `reveals[]` cosa impara a
ogni capitolo; l'ultima rivelazione di un campo non ha valore, rivela la verità.

## Decisione

**Tre tipi di campo** in `EntityDefinition`, ognuno con la sua strategia in `field-kinds.ts`
(ADR-0003):

| Tipo           | Valore JSON                                        | Usato da                                        |
| -------------- | -------------------------------------------------- | ----------------------------------------------- |
| `storyPoint`   | `{ chapter }`; episodio disabilitato, "in arrivo"  | prima apparizione, `revealedAt` di un evento    |
| `eventTime`    | `{ chapter }` oppure `{ worldDate }` (anni, circa) | `occursAt` / `endsAt` (`notBefore`) dell'Evento |
| `relationList` | `{ devilFruits: [id…] }`, riletto come riferimenti | partecipanti di un evento                       |

**Capability `reveals`** su `EntityDefinition` (come il descrittore del backend): elenca i
campi che una rivelazione può nominare. Editor e scheda generici mostrano le schede "Campi
principali / Rivelazioni" e ospitano `reveals-panel`. Tutta la logica è nel modulo puro
`entity/entity-reveals.ts` (niente Angular), che legge e scrive i dati così come l'API li tiene,
senza conversioni:

- `forwardTimeline`: prima apparizione (conoscenza iniziale), una tappa per rivelazione con
  `prima → dopo` dei soli campi nominati, verità attuale.
- `readerViewAt`: la versione come la vede il lettore dopo la n-esima rivelazione.
- `revealsSaved`: cosa si invia; l'ultima menzione di un campo non manda valore (la verità resta
  nei campi principali, modificabile solo lì).
- `diffReveals` e `firstAppearanceBody`: il confronto tra versioni.

**Anteprima del lettore:** solo nella scheda **Panoramica** del dettaglio, con un selettore
(prima apparizione, ogni rivelazione, verità attuale). Cambia solo i campi rivelati: le relazioni
non ancora rivelate non sono nascoste, è compito della public API (TL6).

**Confronto:** i campi principali sono confrontati come il lettore li incontra alla prima
apparizione; le rivelazioni stanno in un blocco a parte, abbinate **per capitolo** (un capitolo
ha al massimo una rivelazione per versione; una spostata si legge rimossa + aggiunta; quelle
senza capitolo per posizione). La verità di un campo rivelato appare sulla sua ultima
rivelazione.

**Lumacofono:** il consiglio dipende dalla scheda aperta tramite `MascotService.tipTopic`
(eventi, rivelazioni), impostato dal componente all'apertura e azzerato alla chiusura.

## Alternative considerate

- **Endpoint backend per le viste risolte** (timeline, vista del lettore, confronto): una sola
  risoluzione, ma un'API in più solo per il back-office e una richiesta a ogni cambio della
  bozza non salvata. Scartata: la risoluzione lavora sulla bozza in memoria.
- **Modificare il valore "dopo"** di ogni tappa (modello all'indietro, piano prima di T13): ogni
  modifica alla verità andava ricopiata nelle tappe. Scartata con T13: la verità sta in un posto.
- **Identità stabile delle rivelazioni** (id persistito) per il confronto: abbinamento esatto
  anche se il capitolo cambia, ma un id in più nel contratto e nel database. Scartata: il
  capitolo è già unico per versione; la `key` di `RevealDraft` vale solo sullo schermo.

## Conseguenze

- La risoluzione "valore di un campo al capitolo N" esiste due volte: qui e nella public API
  (TL6, in SQL). Va tenuta piccola e testata sulla stessa fixture Gomu Gomu del backend
  (`entity-reveals.spec.ts`); un cambio di regola tocca entrambe.
- Ogni entità con la capability `reveals` ottiene schede, anteprima e confronto senza codice suo.
- L'anteprima non è la vista pubblica: è etichettata come anteprima delle sole rivelazioni.

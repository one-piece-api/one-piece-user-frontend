# ADR-0004: Campi relazione, sezioni dell'entità e azioni che il contenuto rifiuta

## Contesto

Il Frutto del Diavolo è il primo contenuto che punta a un altro: appartiene a un Tipo
(`docs/implementation-plan-devil-fruit.md` in `one-piece-api`, D1-D5, D10). Questo porta tre cose
che le pagine generiche dell'ADR-0003 non sapevano dire:

- un campo il cui valore è un altro contenuto, che l'API legge come `{id, romaji, names}` e
  riceve come `id`;
- ciò che sta "dall'altra parte": quanti Frutti ha un Tipo e quali;
- azioni che l'utente ha il diritto di fare ma che i dati non permettono (ripubblicare un Frutto
  il cui Tipo non è online, ritirare un Tipo con Frutti online): il backend le elenca in
  `blockedActions` e le rifiuta con `409 CONTENT_VERSION_ACTION_BLOCKED` (content-service ADR-0005).

## Decisione

- **Tipo di campo `relation`**, dichiarato come dato: `relationField('type', { target:
  'DEVIL_FRUIT_TYPE' })`. `target` è il nome dell'entità, risolto con `entityOf` solo quando
  serve (rotta della chip, sezione da interrogare): le definizioni non si importano l'una
  con l'altra, perché Frutto verso Tipo e Tipo verso Frutti farebbero un giro.
- **La bozza tiene il riferimento intero**, così l'editor mostra il Tipo scelto senza una
  richiesta in più; `savedValue` restituisce solo l'id. È l'unico punto in cui le due forme si
  incontrano (Strategy con un Adapter dentro). Il confronto guarda gli id: un Tipo
  rinominato non cambia il Frutto (D1). Nei due lati del confronto il nome è il romaji, perché
  la strategia non conosce la lingua.
- **Scelta nell'editor con un combobox** (`RelationPicker`, WAI-ARIA) che legge
  `{sezione}/linkable?q=&size=20` dopo 300 ms dall'ultimo tasto; non conosce i Tipi, riceve la
  sezione da interrogare e restituisce la scelta. Una `<select>` nativa non regge un elenco
  paginato e ricercabile. Si può svuotare: una bozza può non averlo, la revisione lo chiede.
- **Un `422` sul campo `type`** si dice come un Tipo non collegabile, non come un romaji senza
  lettere (stesso codice, `CONTENT_VALUE_INVALID`): lo decide il campo, se è una relazione.
- **Lista:** una colonna per il primo campo relazione (nome, link) e il filtro dall'URL, con
  una chip che lo toglie; il nome del Tipo si legge da una riga, altrimenti si mostra il codice
  breve. Una colonna di conteggio (`counts` nella definizione) mostra quanti contenuti di
  un'altra entità puntano alla riga, e rimanda alla loro lista già filtrata.
- **Sezioni della scheda** (`sections` nella definizione, `relatedList`): "Frutti di questo
  Tipo", al massimo 12, interrogati alla lista dei Frutti con lo stesso filtro, più "Vedi tutti
  (N)". Solo sulla versione più recente e nella scheda: i Frutti non sono parte di una versione.
- **Azioni bloccate:** `blockedActions` sta sulla versione completa (non sulle righe di lista né
  sulla catena). `blockOf` è l'unico punto che lo legge; la mappa mostra lo stato come bloccato
  (non cliccabile, con il motivo), un riquadro sopra la rotta lo dice a parole con i link ai
  contenuti di mezzo, il pannello dei permessi distingue "non puoi" da "potresti, ma il
  contenuto non lo consente". Il motivo è una chiave chiusa tradotta in `block-words.ts`; uno
  che l'app non conosce non ha parole proprie. Un `409` che arriva comunque è detto con
  quel motivo e la schermata si rilegge, come per ogni rifiuto. L'amministratore vede lo stesso.

## Alternative considerate

- **Solo l'id nella bozza e il nome cercato a parte:** una richiesta in più all'apertura e il
  campo vuoto finché non arriva.
- **Il nome del Tipo con il suo stato sulla chip:** costerebbe una modifica al riferimento del
  backend per un'informazione che il Tipo stesso mostra; il motivo di un blocco arriva già da
  `blockedActions`.
- **Il Tipo che porta i suoi Frutti nel dettaglio:** due strade per la stessa lista, con le
  regole di visibilità applicate due volte (content-service ADR-0005).
- **Un `<button disabled>` per l'azione bloccata:** non si legge da tastiera né da lettore di
  schermo; la mappa usa un elemento con la sua etichetta e il motivo.
- **Nascondere le azioni bloccate:** chi guarda non saprebbe cosa non va.

## Conseguenze

- Una nuova relazione è una riga nella definizione, più i suoi testi; lista, scheda, editor e
  confronto la mostrano senza codice nuovo, se la sezione puntata ha `linkable` e un filtro
  con la chiave della relazione.
- `block-words.ts` nomina l'entità dei Frutti per i link dei Frutti che bloccano un Tipo: finché
  i motivi sono due va bene, un terzo motivo dovrebbe portare con sé la sua rotta.
- Le righe delle liste e della dashboard non sanno quali azioni sono bloccate (il backend non
  lo manda lì): il blocco si vede nella scheda e, se si prova comunque, nel messaggio del `409`.
- Il confronto delle relazioni mostra il romaji e non il nome nella lingua.

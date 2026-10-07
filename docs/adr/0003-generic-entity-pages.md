# ADR-0003: Pagine generiche per entità, guidate da un `EntityDefinition`

## Contesto

La sezione dei Tipi di Frutto del Diavolo (lista, dettaglio, editor, confronto, scheda) era
scritta per il Tipo soltanto: circa 2.750 righe in `content/devil-fruit-types/`, con percorsi,
campi, testi e icona dentro il codice. Il Tipo era citato a mano anche nel menu, nella
dashboard e nelle azioni del workflow. Il Frutto del Diavolo è la seconda entità
(`docs/implementation-plan-devil-fruit.md` in `one-piece-api`, D9) e il mockup elenca già le
successive; il backend ha fatto lo stesso passo (content-service ADR-0004).

## Decisione

Le pagine sono scritte una volta, in `content/entity/`, e leggono tutto ciò che è specifico
da un **`EntityDefinition`**: un oggetto di soli dati con `entityType`, `route`, `api`,
prefisso delle traduzioni (`i18n`), icona e campi.

| Parte | Generica, una volta | Per entità |
|---|---|---|
| Modello | `entity-body.ts`: `draftOf`, `toBody`, `readinessChecks`, `draftFieldKey`, `diffBodies`, `namesOf`, completezza | la definizione (`devil-fruit-type.model.ts`) |
| Tipi di campo | `field-kinds.ts`: una strategia per tipo (`text`, `localizedText`) | quali campi, in che ordine, con che limiti e disposizione |
| Pagine | `EntityList`, `EntityDetail`, `EntityEditor`, `EntityComparison`, `EntityCard` | i testi sotto il prefisso: `title`, `one`, `lead`, `kicker`, `new`, `newTitle`, `placeholder.<campo>` |
| Navigazione | `ENTITIES` (registro), `entityRoutes`, `entityNavItem`, `entityOf` | una riga nel registro e una nel menu |

- **Pattern Strategy:** ogni tipo di campo sa come si prepara per l'editor, come si salva,
  quando è compilato e come si confronta; le funzioni generiche scorrono i campi e delegano.
  Dove vive il valore (sulla versione o in `translations`) lo dice il tipo (`localized`).
- **Injection token `ENTITY`:** `entityRoutes(definition)` crea le quattro rotte (lista,
  `new`, `:id/edit`, `:id`) con gli stessi permessi e caricamento su richiesta, e fornisce la
  definizione; ogni pagina, e i suoi figli, la ottengono con `inject(ENTITY)`.
- **Resa per tipo di campo:** `@switch (field.kind)` in scheda, editor e confronto. Un tipo
  nuovo si aggiunge in `field-kinds.ts` più quei tre template.
- **Convenzioni condivise col backend:** ogni entità ha un `romaji`; i campi tradotti stanno
  in `translations`, e quello che dà il nome si chiama `name`.
- **Entità sconosciuta:** la dashboard mostra una riga di un'entità che il backend ha e
  l'app non ancora (tra il rilascio di DF4 e quello di DF5) per nome, come "Altro contenuto",
  senza link né azioni.
- I tipi di campo si costruiscono con la prima entità che li usa: `relation` con il Frutto
  (DF5, vedi ADR-0004), `image` con le immagini (DF7).

## Alternative considerate

- **Copiare le pagine per entità.** Nessun rischio oggi, ma ogni correzione e ogni regola
  della UI scritta una volta per entità.
- **Un componente per tipo di campo caricato con `NgComponentOutlet`.** Più estendibile, ma
  con due tipi di campo è complessità senza beneficio.
- **Annunci "in arrivo" nel registro.** Tutto in un posto, ma definizioni senza campi né API;
  restano scritti nel menu.
- **Un form engine configurabile** (validazioni, layout, condizioni nella definizione). La
  definizione dice solo ciò che il mockup mostra.

## Conseguenze

- Una nuova entità aggiunge la sua definizione, i suoi testi sotto il prefisso, una riga in
  `ENTITIES` e una nel menu; rotte, dashboard e azioni seguono.
- Leggere una pagina richiede di conoscere la definizione e le strategie dei campi: un
  ingresso più ripido di un componente per entità.
- Introdotte senza cambiamenti visibili: le spec del Tipo verificano le stesse cose (cambiano
  solo import, nomi e il provider di `ENTITY`); le parti generiche hanno le loro spec, su
  un'entità che esiste solo nei test (`testing/note-entity.ts`).

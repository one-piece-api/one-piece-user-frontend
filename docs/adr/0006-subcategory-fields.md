# ADR-0006: Sottocategorie come due tipi di campo

## Contesto

Un Tipo di Frutto del Diavolo può definire delle sottocategorie (Zoan → Antico, Mitologico,
Artificiale) e un Frutto può sceglierne una del proprio Tipo (`docs/implementation-plan-devil-fruit-subcategories.md`
in `one-piece-api`, S1–S9, step SC2). Nessuno dei tipi di campo esistenti va bene: sul Tipo
c'è una lista di elementi con id e testi per lingua, sul Frutto una scelta che dipende da un
altro campo.

## Decisione

Due nuovi tipi di campo in `EntityDefinition`, ognuno con la sua strategia in `field-kinds.ts`
(ADR-0003) e un `@case` in scheda, editor e confronto:

| Tipo | Sul | Valore nell'editor → JSON | Revisione | Confronto |
|---|---|---|---|---|
| `subcategoryList` | Tipo | `[{ id \| null, key, translations }]` → `[{ id?, translations }]`; senza `id` per una nuova, l'id lo assegna il backend | nome e descrizione di ogni sottocategoria in ogni lingua, ognuno un controllo (`entry` in `EntityFieldRef`) | abbinate per id: aggiunte, rimosse, rinominate, per testo e lingua |
| `subcategory` | Frutto | il riferimento `{ id, names }` → `id` | non richiesta | per id, mostrata con i nomi |

- **`of`:** il campo `subcategory` nomina la relazione (`type`) da cui prende le scelte, cioè
  `subcategories` del `TypeReferenceResponse` già caricato (nessuna richiesta in più). Il select
  appare solo se il Tipo scelto ha sottocategorie; cambiando Tipo, la scelta si azzera.
- **Errori del backend:** `subcategories[i].translations[it].name` → `it.subcategories.i.name`,
  `subcategories[i].id` → `subcategories.i`; un `CONTENT_VALUE_INVALID` su questi campi ha un
  messaggio suo (nome ripetuto, id sconosciuto, sottocategoria non del Tipo).
- **Completezza di una lingua:** `isLanguageComplete` considera anche le sottocategorie (tab
  dell'editor e della scheda).
- **Blocchi:** `SUBCATEGORY_NOT_ONLINE` (nomina la sottocategoria) e `SUBCATEGORY_IN_USE`
  (elenca i Frutti online, come `ONLINE_FRUITS_LINKED`).

## Alternative considerate

- **Componenti specifici per il Frutto del Diavolo** agganciati come sezione: meno generalità,
  ma completezza, confronto ed errori fuori dal modello generico, quindi duplicati.
- **Un tipo generico "lista di elementi annidati"** (mini form engine): è il form engine già
  scartato dall'ADR-0003.

## Conseguenze

- Nessun codice nomina "Zoan" o il Frutto: ogni entità può avere una lista di sottocategorie,
  e un'altra può sceglierne una tramite una relazione.
- `readinessChecks` e `diffBodies` producono più voci da un solo campo lista: è l'unico punto in
  cui le funzioni generiche distinguono un tipo di campo (`subcategoryList`).

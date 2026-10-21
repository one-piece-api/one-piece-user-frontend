# ADR-0007: Liste di parti e giorno dell'anno come tipi di campo

## Contesto

Il Personaggio ha tre liste ordinate dentro la versione: specie (riferimenti), epiteti (un
testo per lingua), alias (un testo uguale in ogni lingua), e i piani successivi ne aggiungono
altre (affiliazioni, frutti, parenti), fatte di più parti: un riferimento, un ruolo tradotto,
una scelta, un sì/no. Ha anche un compleanno senza anno (`--MM-DD`). Nessun tipo di campo
esistente va bene, e `subcategoryList` (ADR-0006) è legato a id del backend e a
`translations[lang]` (piano del Personaggio, D15, D16; step C3).

## Decisione

Due nuovi tipi di campo in `EntityDefinition`, con la loro strategia in `field-kinds.ts`
(ADR-0003):

| Tipo       | Definizione                                                                                                    | Editor → JSON                                                                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `partList` | `parts` (campi `text`, `localizedText`, `relation`, `choice`, `boolean`), `maxEntries?`, `unique?` (una parte) | voci con chiave locale → valori nudi se c'è una sola parte non tradotta (`["s1"]`, `["Sogeking"]`), altrimenti un oggetto per voce; una parte tradotta è una mappa lingua → testo |
| `monthDay` | solo la chiave                                                                                                 | `{ month, day }` scelti da due select (i giorni del mese scelto, 29 a febbraio) → `--MM-DD` o `null`                                                                              |

- **Editor:** `app-part-list-editor` aggiunge, toglie e sposta le voci; ogni parte si disegna
  come il suo tipo, e una parte tradotta ha una casella per lingua dentro la voce (non nei tab
  delle lingue). Una voce lasciata vuota non si salva.
- **Revisione:** ogni voce salvata chiede ogni parte tradotta e non facoltativa, in ogni lingua
  (`entry` in `EntityFieldRef`), come fa il backend.
- **Confronto:** le voci si abbinano per la parte `unique` (id di un riferimento, testo senza
  maiuscole e spazi), altrimenti per posizione; uno spostamento è una riga "posizione 2 → 1".
- **Errori del backend:** `epithets[1].text[en]` → `epithets.1.text.en`; gli indici del JSON
  inviato si riportano a quelli della bozza, saltando le voci vuote non inviate.
- **Lista:** un `partList` di un solo riferimento è anche un filtro della lista (`?species=`),
  senza colonna: le righe non lo portano. È il filtro a cui porta un `relatedList`.

## Alternative considerate

- **Un componente per lista** (epiteti, alias, specie, …): sei copie quasi uguali (D15).
- **Generalizzare `subcategoryList` in `partList`:** le sottocategorie hanno id assegnati dal
  backend, testi sotto `translations[lang]` e una prima apparizione per voce; tenerle a parte
  costa un tipo in più, migrarle è un lavoro a sé.
- **Un input `date` per il compleanno:** chiede un anno che non esiste.

## Conseguenze

- Una nuova lista di un'entità è una definizione, non codice: il Personaggio non ha
  componenti propri.
- `readinessChecks`, `diffBodies` e `languagesOf` distinguono ora due tipi lista
  (`subcategoryList`, `partList`).

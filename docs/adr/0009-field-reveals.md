# ADR-0009: Rivelazioni dei campi

## Contesto

Con R4 (ADR-0012 di content-service) Frutto, Personaggio e Taglia hanno rivelazioni: i campi
principali sono il valore attuale, `initialKnowledge` dice cosa crede il lettore alla prima
apparizione, ogni voce di `reveals` ha un punto (`revealedAt`, capitolo e/o episodio), un titolo
per lingua e i campi che rivela (`fields`, un enum per entità). Un valore va inviato solo dove
una rivelazione successiva lo cambia di nuovo; l'ultima menzione rivela il valore attuale. Il
ramo `timeline` aveva già una scheda Rivelazioni (ADR-0007 lì), con il solo asse dei capitoli
(piano reveals, R8, decisioni della sezione rivelazioni 1-4).

## Decisione

Una capacità dichiarativa di `EntityDefinition`, non un tipo di campo:

```ts
reveals: { groups: [{ key: 'TYPE', fields: ['type', 'subcategory'] }, ...] }
```

Un **gruppo** è una scelta dell'enum del backend (`NAME`, `IDENTITY`, `INACTIVE`...) con i campi
della definizione che ne portano i valori. Ogni valore si legge, salva e confronta col suo
`FIELD_KINDS` (Strategy): una "credenza" ha la forma di una bozza (campi condivisi in cima,
tradotti per lingua). Logica pura in `entity-reveals.ts`, vista in `reveals-panel`.

- **Editor:** due sezioni, "Campi principali / Rivelazioni" (bottoni `aria-pressed`, non tab: gli
  e2e contano i tab di lingua). Linea del tempo in avanti: prima apparizione (valori iniziali) →
  rivelazioni → verità. Ogni riga "prima → dopo" scrive dove il valore vive: il nodo precedente,
  la rivelazione, o i campi principali sull'ultima menzione. Una lingua alla volta.
- **Ordine:** per capitolo, poi solo episodio, poi senza punto; serve solo a disegnare e a dire
  qual è l'ultima menzione. Le regole d'ordine per asse restano al backend.
- **Salvataggio:** `revealsSaved` invia i valori iniziali dei gruppi rivelati e, per ogni
  rivelazione, solo quelli dei gruppi che non sono ultima menzione.
- **Revisione:** un controllo per lingua (titoli e nomi tradotti); i percorsi di
  `CONTENT_VERSION_INCOMPLETE` diventano parole (`field-words.ts`: "rivelazione 2 · titolo EN").
- **Errori:** `reveals[i]` si riporta alla rivelazione per le chiavi nell'ordine inviato; i
  messaggi inglesi passano da una tabella prefisso → chiave, come per i punti (ADR-0008).
- **Scheda:** tab "Rivelazioni" in sola lettura, solo per le entità con la capacità.
- **Confronto:** conoscenza iniziale come blocco di campi; rivelazioni abbinate per posizione
  nell'ordine del lettore (punto, campi nominati, titoli, valori appresi).

## Alternative considerate

- **Un tipo di campo `reveals`:** non è un campo ma un'altra vista degli stessi campi; dovrebbe
  rifare editor e confronto di ogni tipo di valore.
- **Copiare il ramo così com'è:** un solo asse, conoscenza iniziale non modificabile, gruppi di un
  campo solo (niente identità del Personaggio).
- **Abbinare le rivelazioni per punto nel confronto:** più rivelazioni possono condividere un
  punto su due assi; la posizione è prevedibile, come per le altre liste.

## Conseguenze

- Un'entità con rivelazioni è una riga di definizione più le parole dei gruppi (`content.reveals.field.*`).
- L'anteprima "come la vede il lettore" arriva dal backend in R9, non qui.
- Un inserimento in mezzo appare nel confronto come modifica di tutte le rivelazioni successive.
- La tabella dei messaggi va aggiornata se `FieldRevealRules` cambia un testo.

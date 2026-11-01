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

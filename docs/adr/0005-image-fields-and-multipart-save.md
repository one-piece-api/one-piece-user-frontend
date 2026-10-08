# ADR-0005: Campo immagine, controlli nel browser e salvataggio multipart

## Contesto

Il Frutto del Diavolo ha un'immagine facoltativa (`docs/implementation-plan-devil-fruit.md` in
`one-piece-api`, D5, D6, DF7). Il backend (content-service ADR-0006) la salva con la versione:
la versione la mostra come `image: { id, url }` (`id` = SHA-256 dei byte normalizzati) e la
riceve come parte `image` di una richiesta `multipart/form-data`, accanto alla parte `version`
(il JSON). Senza parte la tiene; `removeImage: true` la toglie. Un file rifiutato risponde
`422` con un codice per motivo e i numeri nel dettaglio; oltre il limite di upload, `413`.
Finora ogni campo aveva un valore che finiva nel JSON: l'immagine no.

## Decisione

- **Quarto tipo di campo, `image`**, con il suo profilo come dato:
  `imageField('image', { width, height, ratioTolerance, maxBytes, maxPixels,
  minTransparentPercent })`, come `maxLength` per i testi. Un'entità futura avrà il suo.
- **Nella bozza** il valore è `{ saved }` (l'immagine salvata), `{ chosen: File, preview }` (un
  file scelto, mostrato da un object URL) o `null`. L'intenzione si ricava confrontando la bozza
  con la versione da cui è partita, in un solo punto, `uploadOf`: file scelto → parte `image`;
  `null` dove la versione l'aveva → `remove<Key>: true`; altrimenti nulla. L'editor generico
  riceve `{ body, file }` e non sa nulla di immagini.
- **Multipart solo con un file da inviare:** altrimenti il JSON di sempre. La parte `version`
  è un `Blob` `application/json`, perché Spring la validi con `@RequestPart`.
- **Facoltativa:** i tipi di campo dichiarano `forReview`; l'immagine non entra nella checklist.
- **Controlli nel browser = quelli del backend**, nello stesso ordine e con gli stessi codici
  (`image-checks.ts`): peso, firma PNG, megapixel, minimo, proporzione, trasparenza. Larghezza e
  altezza si leggono dall'intestazione PNG senza decodificare; si decodifica (canvas) solo per
  contare i pixel trasparenti, e solo se il resto è passato. Un solo traduttore
  (`image-words.ts`) per un rifiuto del browser, un `422` e un `413`. Il backend resta l'autorità.
- **Area "Media"** (`ImagePicker`): trascina o scegli, anteprima 4:5, "Rimuovi"; un file
  rifiutato non entra nella bozza. Un salvataggio fallito lascia il file nella bozza per
  riprovare. Gli object URL si rilasciano quando il file cambia e quando si esce.
- **Scheda e confronto** (`EntityImageFrame`): un `<img>` sull'URL del backend (stessa origine,
  cookie di sessione, cache `immutable`), con il segnaposto "Immagine di *nome*" se manca o non
  si carica. Nel confronto le due immagini affiancate; cambiata o no si decide per id.

## Alternative scartate

- **Sempre multipart** per le entità con immagine: ogni salvataggio di solo testo lo sarebbe
  senza motivo, e il Frutto si comporterebbe diversamente dal Tipo nello stesso editor.
- **`File | id | null` più un flag "rimossa"**: sparge la regola tieni / sostituisci / rimuovi
  tra editor e salvataggio.
- **Un endpoint "profilo"** per non riscrivere i numeri: una chiamata in più per sei numeri che
  cambiano di rado.
- **Immagini caricate come blob con `HttpClient`**: servirebbe solo con un token in un header.

## Conseguenze

- I numeri del profilo stanno sia nel backend sia nella definizione: se divergono, il browser è
  più severo o più permissivo del dovuto, ma il `422` del backend viene comunque tradotto.
- Un'entità ha al più un campo immagine, quanto la parte `image` del backend.
- Il formato d'ingresso oggi è solo PNG (content-service, DF6): il WebP tornerà come nuovo
  controllo di firma, senza toccare il resto.

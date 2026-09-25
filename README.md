# UserFrontend

Frontend Angular di One Piece API: account/profilo, gestione utenti e ruoli, e il workflow
editoriale dei contenuti (bozze, revisione, enciclopedia). Vive dietro `oauth2-proxy` in ogni
ambiente — vedi `docs/adr/` per le decisioni specifiche di questo repo e
`onepiece-infrastructure/docs/adr/0001-local-auth-stack.md` per lo stack di autenticazione.

## Sviluppo locale

Ci sono due modi di lavorarci in locale, a seconda di cosa serve verificare.

### Iterazione rapida sulla UI (`ng serve`)

```bash
npm ci
npm start   # ng serve, apre http://localhost:4200 con reload automatico
```

`proxy.conf.json` instrada già `/api` e `/api/content` verso `localhost:8081`/`8082`
(le porte di `one-piece-user-service`/`one-piece-content-service` eseguiti in locale — vedi
i rispettivi README per come avviarli da IntelliJ). **Limite noto:** a questa porta l'app
non è dietro `oauth2-proxy`, quindi login/logout (che passano sempre da `/oauth2/start` e
`/oauth2/sign_out`, vedi `docs/adr/0001-runtime-config-injection.md`) non funzionano — utile
per lavorare su layout/stile/componenti, non per verificare un flow autenticato reale.

### Flow autenticato reale (stack completo)

```bash
./scripts/deploy-local.sh   # build immagine + kind load + rollout restart
```

poi, con `kubectl port-forward svc/oauth2-proxy -n auth 4180:4180` attivo (vedi
`onepiece-infrastructure/README.md`), apri `http://localhost:4180`. Questo è l'unico modo
di testare login/logout/permessi/i18n end-to-end così come li vede davvero un utente.

## Test e qualità

```bash
npm test              # unit test (Vitest)
npm run lint           # ESLint
npm run format:check   # Prettier (la CI verifica entrambi lint e format, vedi sotto)
npm run e2e             # Playwright, contro l'app già in esecuzione
```

La CI (`lint`) esegue sia ESLint che il check di Prettier: verificare entrambi localmente
prima di considerare una modifica pronta.

## Build

```bash
npm run build   # dist/, build di produzione
```

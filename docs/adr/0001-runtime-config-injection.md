# ADR-0001: Config runtime iniettata a startup del container

## Contesto

`src/app/identity/auth-urls.ts` costruiva l'URL di RP-initiated logout di
Keycloak con l'origin hardcoded a `http://localhost:8080` — valore corretto
solo in sviluppo locale (Keycloak raggiunto via `kubectl port-forward` su
quella porta fissa, vedi `onepiece-infrastructure/docs/adr/0001-local-auth-stack.md`).
Sull'ambiente remoto (OKE, `onepiece-infrastructure/docs/adr/0005`) Keycloak
è raggiungibile sulla stessa origin dell'app (routing per path dietro
l'Ingress, `/realms`/`/resources`), non su un host/porta separati: il click
su Log Out reindirizzava il browser dell'utente verso la SUA macchina
locale, non verso il cluster - logout silenziosamente rotto solo in remoto.

Il login non soffriva dello stesso problema: passa sempre da oauth2-proxy
(`/oauth2/start`), il cui `login-url` è già configurato per ambiente lato
Helm (`onepiece-infrastructure/helmfile.yaml.gotmpl`). Il logout era l'unico
punto in cui il frontend costruisce un URL verso Keycloak direttamente,
lato client.

Il commento originale ammetteva il limite esplicitamente: "hardcoded for
now... becoming configurable per environment is an explicitly deferred
trade-off, not an oversight" - non esisteva alcun meccanismo di
configurazione per ambiente in questo repo: l'immagine Docker (nginx +
build Angular statico) è identica e riusata invariata su `default`/`ci`/
`remote` (`onepiece-infrastructure/helmfile.yaml.gotmpl`, `userFrontendImage`).

## Decisione

Runtime config injection, il pattern standard per SPA containerizzate dietro
nginx: un `config.json` generato a startup del container da variabili
d'ambiente del Deployment, fetchato dall'app prima del bootstrap.

- `public/config.json.template` con placeholder `${KEYCLOAK_ORIGIN}`, copiato
  nell'immagine dal build Angular esistente (nessun meccanismo nuovo per
  quella parte).
- `docker-entrypoint.d/40-generate-runtime-config.sh`, eseguito
  automaticamente dall'entrypoint di `nginx:stable-alpine` prima dell'avvio:
  `envsubst` (già incluso in quell'immagine) sul template, genera
  `config.json`. `KEYCLOAK_ORIGIN` ha un default nel `Dockerfile`
  (`http://localhost:8080`, lo stesso valore hardcoded finora) — build/run
  locali senza Helm restano invariati.
- `onepiece-infrastructure` inietta `KEYCLOAK_ORIGIN` come env var del
  Deployment solo nell'ambiente `remote` (stesso schema già in uso per
  `jwtIssuerUri` su `user-service`, entrambi risolti dall'IP pubblico
  riservato via Terraform).
- Lato Angular, `provideAppInitializer` (`app.config.ts`) fetcha
  `config.json` via `HttpClient` e blocca il bootstrap finché non risolve -
  necessario perché `AppShell` legge `logoutUrl()` una sola volta, in modo
  sincrono, alla costruzione del componente. Fallback silenzioso al default
  hardcoded se il fetch fallisce (es. `ng serve` locale senza nginx
  davanti), mai un errore che blocchi l'avvio dell'app.

## Alternative considerate

- **Derivare l'origin di Keycloak da `location.origin`**, con un fallback
  esplicito solo quando l'origin corrente è quella nota di sviluppo locale
  (porta 4180, convenzione fissa di questo stack): zero nuova
  infrastruttura, ma introduce un accoppiamento implicito a quella
  convenzione di porta (un magic number) e non generalizza a nessun altro
  futuro fatto per-ambiente del frontend.
- **`environment.ts` a build-time** (pattern nativo Angular): richiederebbe
  un'immagine Docker diversa per ambiente, in contrasto con lo schema già
  stabilito in questo stack (stessa immagine GHCR riusata su `ci`/`remote`,
  vedi `onepiece-infrastructure/docs/adr/0004-ci-images-from-ghcr.md`) - la
  differenza tra ambienti resta responsabilità di Helm/Kubernetes, non del
  processo di build.

## Conseguenze

- Il bootstrap dell'app attende un round-trip HTTP in più (`config.json`,
  file locale servito da nginx, nessuna chiamata di rete esterna - overhead
  trascurabile).
- Qualunque futuro fatto per-ambiente del frontend ha ora una sede naturale
  (`RuntimeConfig`, `src/app/config/runtime-config.ts`) invece di un nuovo
  hardcode da scoprire in produzione come in questo caso.

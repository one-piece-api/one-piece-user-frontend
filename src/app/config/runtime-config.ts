import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface RuntimeConfig {
  keycloakOrigin: string;
}

// Stesso valore hardcoded finora in auth-urls.ts: locale/ci raggiungono
// Keycloak solo via port-forward su una porta fissa, diversa da quella del
// proxy (vedi README). Resta finché config.json non è caricato, o se il
// fetch fallisce (es. "ng serve" locale senza nginx davanti).
const DEFAULT_CONFIG: RuntimeConfig = {
  keycloakOrigin: 'http://localhost:8080',
};

let runtimeConfig: RuntimeConfig = DEFAULT_CONFIG;

/**
 * config.json è generato a startup del container da KEYCLOAK_ORIGIN (vedi
 * Dockerfile e onepiece-infrastructure helm/charts/user-frontend) - stessa
 * immagine invariata su locale/ci/remote, solo l'origin di Keycloak cambia.
 * Chiamato come provideAppInitializer (app.config.ts): il bootstrap attende
 * il risultato perché AppShell legge l'URL di logout una sola volta, in modo
 * sincrono, alla costruzione - vedi docs/adr/0001-runtime-config-injection.md.
 */
export async function loadRuntimeConfig(http: HttpClient): Promise<void> {
  try {
    runtimeConfig = await firstValueFrom(http.get<RuntimeConfig>('/config.json'));
  } catch {
    // config.json assente: resta il default, comportamento invariato
    // rispetto a prima di questo meccanismo.
  }
}

export function getRuntimeConfig(): RuntimeConfig {
  return runtimeConfig;
}

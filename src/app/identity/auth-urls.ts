import { getRuntimeConfig } from '../config/runtime-config';

// oauth2-proxy client id and paths: fixed across environments (same client,
// same proxy) — see onepiece-infrastructure/docs/adr/0001-local-auth-stack.md.
// Keycloak's browser-facing origin instead varies per environment (separate
// port locally, same origin behind the remote Ingress) — read from
// config.json at runtime, see docs/adr/0001-runtime-config-injection.md.
const KEYCLOAK_REALM_PATH = '/realms/onepiece';
const KEYCLOAK_LOGOUT_PATH = '/protocol/openid-connect/logout';
const KEYCLOAK_AUTH_PATH = '/protocol/openid-connect/auth';
const OAUTH2_PROXY_CLIENT_ID = 'onepiece-proxy';
const OAUTH2_PROXY_SIGN_OUT_PATH = '/oauth2/sign_out';
const OAUTH2_PROXY_SIGN_IN_PATH = '/oauth2/start';

/**
 * Full logout (UF-IDU-08): clearing the oauth2-proxy session alone is not
 * enough, or a fresh visit would silently re-authenticate through the still-
 * active Keycloak SSO session. Chaining "/oauth2/sign_out" with an "rd" that
 * points at Keycloak's own RP-initiated logout endpoint ends both sessions
 * in one redirect chain: proxy session → Keycloak session → back to the app.
 */
export function logoutUrl(
  appOrigin: string = location.origin,
  keycloakOrigin: string = getRuntimeConfig().keycloakOrigin,
): string {
  const postLogoutRedirectUri = `${appOrigin}/`;
  const keycloakLogoutUrl =
    `${keycloakOrigin}${KEYCLOAK_REALM_PATH}${KEYCLOAK_LOGOUT_PATH}` +
    `?client_id=${encodeURIComponent(OAUTH2_PROXY_CLIENT_ID)}` +
    `&post_logout_redirect_uri=${encodeURIComponent(postLogoutRedirectUri)}`;
  return `${OAUTH2_PROXY_SIGN_OUT_PATH}?rd=${encodeURIComponent(keycloakLogoutUrl)}`;
}

/**
 * Re-authentication after a 401 (UF-IDU-09): "/oauth2/start" is oauth2-proxy's
 * own explicit sign-in entrypoint (the same one it redirects unauthenticated
 * browser navigations to automatically) — hitting it directly, with "rd" set
 * to where the user was, sends them through Keycloak login and back to that
 * same page instead of always landing on "/".
 */
export function loginUrl(returnTo: string): string {
  return `${OAUTH2_PROXY_SIGN_IN_PATH}?rd=${encodeURIComponent(returnTo)}`;
}

/**
 * Self-service account deletion: deliberately targets Keycloak's own built-in
 * "account" client directly, never oauth2-proxy's "/oauth2/start" or the
 * "onepiece-proxy" client. Those own the app's OAuth session/CSRF state and
 * have no documented way to forward a "kc_action" through to Keycloak; the
 * "account" client is a separate, already-authorized OIDC flow that reuses
 * the browser's existing Keycloak SSO cookie (no second login). "redirect_uri"
 * points back at this app (declared as a valid redirect URI for "account" in
 * realm-onepiece.json) so a cancelled or already-completed deletion never
 * strands the user on Keycloak's own Account Console - the app never consumes
 * the resulting authorization code, it just needs somewhere real to land on.
 */
export function deleteAccountUrl(
  appOrigin: string = location.origin,
  keycloakOrigin: string = getRuntimeConfig().keycloakOrigin,
): string {
  const redirectUri = `${appOrigin}/`;
  return (
    `${keycloakOrigin}${KEYCLOAK_REALM_PATH}${KEYCLOAK_AUTH_PATH}` +
    `?client_id=account` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=openid` +
    `&kc_action=delete_account`
  );
}

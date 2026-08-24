// Local-dev topology facts (Keycloak's browser-facing host, the oauth2-proxy
// client id): see onepiece-infrastructure/docs/adr/0001-local-auth-stack.md.
// Hardcoded for now, same as elsewhere in this stack — becoming configurable
// per environment is an explicitly deferred trade-off, not an oversight.
const KEYCLOAK_ISSUER = 'http://localhost:8080/realms/onepiece';
const KEYCLOAK_LOGOUT_PATH = '/protocol/openid-connect/logout';
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
export function logoutUrl(origin: string = location.origin): string {
  const postLogoutRedirectUri = `${origin}/`;
  const keycloakLogoutUrl =
    `${KEYCLOAK_ISSUER}${KEYCLOAK_LOGOUT_PATH}` +
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

import { deleteAccountUrl, loginUrl, logoutUrl, startAccountDeletionUrl } from './auth-urls';

describe('logoutUrl', () => {
  it('chains oauth2-proxy sign_out into Keycloak RP-initiated logout, back to the given origin', () => {
    const url = logoutUrl('http://localhost:4180', 'http://localhost:8080');

    expect(url).toBe(
      '/oauth2/sign_out?rd=' +
        encodeURIComponent(
          'http://localhost:8080/realms/onepiece/protocol/openid-connect/logout' +
            '?client_id=onepiece-proxy' +
            '&post_logout_redirect_uri=' +
            encodeURIComponent('http://localhost:4180/'),
        ),
    );
  });

  it('uses the given Keycloak origin, not a hardcoded one (regression: broken logout in remote)', () => {
    const url = logoutUrl('http://84.8.249.65', 'http://84.8.249.65');

    expect(url).toContain(
      encodeURIComponent('http://84.8.249.65/realms/onepiece/protocol/openid-connect/logout'),
    );
  });
});

describe('loginUrl', () => {
  it('points at oauth2-proxy sign-in with the given return path', () => {
    expect(loginUrl('/users')).toBe('/oauth2/start?rd=' + encodeURIComponent('/users'));
  });
});

describe('deleteAccountUrl', () => {
  it('targets the built-in "account" client directly, not onepiece-proxy/oauth2-proxy, and lands back on the app', () => {
    const url = deleteAccountUrl('http://localhost:4180', 'http://localhost:8080');

    expect(url).toBe(
      'http://localhost:8080/realms/onepiece/protocol/openid-connect/auth' +
        '?client_id=account' +
        '&redirect_uri=' +
        encodeURIComponent('http://localhost:4180/') +
        '&response_type=code' +
        '&scope=openid' +
        '&kc_action=delete_account',
    );
  });

  it('uses the given app and Keycloak origins, not hardcoded ones', () => {
    const url = deleteAccountUrl('http://84.8.249.65', 'http://84.8.249.65');

    expect(url).toContain(encodeURIComponent('http://84.8.249.65/'));
    expect(url.startsWith('http://84.8.249.65/realms/onepiece')).toBe(true);
  });
});

describe('startAccountDeletionUrl', () => {
  it('clears the oauth2-proxy session first, then chains into deleteAccountUrl', () => {
    const url = startAccountDeletionUrl('http://localhost:4180', 'http://localhost:8080');

    expect(url).toBe(
      '/oauth2/sign_out?rd=' +
        encodeURIComponent(deleteAccountUrl('http://localhost:4180', 'http://localhost:8080')),
    );
  });

  it('uses the given app and Keycloak origins, not hardcoded ones', () => {
    const url = startAccountDeletionUrl('http://84.8.249.65', 'http://84.8.249.65');

    expect(url.startsWith('/oauth2/sign_out?rd=')).toBe(true);
    expect(url).toContain(encodeURIComponent('http://84.8.249.65/realms/onepiece'));
  });
});

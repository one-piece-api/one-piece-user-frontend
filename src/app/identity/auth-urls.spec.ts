import { loginUrl, logoutUrl } from './auth-urls';

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

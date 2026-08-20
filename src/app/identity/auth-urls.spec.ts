import { logoutUrl } from './auth-urls';

describe('logoutUrl', () => {
  it('chains oauth2-proxy sign_out into Keycloak RP-initiated logout, back to the given origin', () => {
    const url = logoutUrl('http://localhost:4180');

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
});

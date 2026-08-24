import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorOf, hasErrorCode } from './api-error';

function errorResponseWithBody(body: unknown, status = 409): HttpErrorResponse {
  return new HttpErrorResponse({ error: body, status, statusText: 'Error' });
}

describe('apiErrorOf', () => {
  it('extracts the standard contract shape when the body matches', () => {
    const response = errorResponseWithBody({
      status: 409,
      detail: 'An account for usopp@onepiece.local already exists',
      errorCode: 'USER_EMAIL_ALREADY_REGISTERED',
      traceId: 'abc-123',
    });

    expect(apiErrorOf(response)).toEqual(
      expect.objectContaining({ errorCode: 'USER_EMAIL_ALREADY_REGISTERED', traceId: 'abc-123' }),
    );
  });

  it('returns null when the body has no errorCode', () => {
    expect(apiErrorOf(errorResponseWithBody({ detail: 'plain text error' }))).toBeNull();
  });

  it('returns null when the body is not an object (e.g. a network error)', () => {
    expect(apiErrorOf(errorResponseWithBody(null))).toBeNull();
    expect(apiErrorOf(errorResponseWithBody('unexpected'))).toBeNull();
  });
});

describe('hasErrorCode', () => {
  it('matches the exact error code', () => {
    const response = errorResponseWithBody({ errorCode: 'USER_EMAIL_ALREADY_REGISTERED' });

    expect(hasErrorCode(response, 'USER_EMAIL_ALREADY_REGISTERED')).toBe(true);
    expect(hasErrorCode(response, 'SOMETHING_ELSE')).toBe(false);
  });

  it('is false when the response carries no error code at all', () => {
    expect(hasErrorCode(errorResponseWithBody({}), 'USER_EMAIL_ALREADY_REGISTERED')).toBe(false);
  });
});

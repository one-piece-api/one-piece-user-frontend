import { HttpErrorResponse } from '@angular/common/http';

export interface FieldViolation {
  readonly field: string;
  readonly message: string;
}

/**
 * The standard error-response contract every backend service returns
 * (`one-piece-exception`'s `ApplicationExceptionHandler`, an RFC 7807 `ProblemDetail`
 * extended with `errorCode`/`traceId`/`timestamp`). `errorCode` is what components
 * should branch on - HTTP status alone can't tell "email already registered" apart
 * from any other conflict.
 */
export interface ApiError {
  readonly status: number;
  readonly detail?: string;
  readonly errorCode: string;
  readonly traceId?: string;
  readonly timestamp?: string;
  readonly errors?: readonly FieldViolation[];
}

/** Extracts the response body as an {@link ApiError}, or `null` if it doesn't match the contract. */
export function apiErrorOf(error: HttpErrorResponse): ApiError | null {
  const body: unknown = error.error;
  return isApiError(body) ? body : null;
}

/** Convenience for the common case of checking one specific `errorCode`. */
export function hasErrorCode(error: HttpErrorResponse, errorCode: string): boolean {
  return apiErrorOf(error)?.errorCode === errorCode;
}

function isApiError(body: unknown): body is ApiError {
  return (
    typeof body === 'object' &&
    body !== null &&
    'errorCode' in body &&
    typeof (body as { errorCode: unknown }).errorCode === 'string'
  );
}

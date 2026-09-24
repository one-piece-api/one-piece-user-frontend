import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Every request carries the UI's current language as a standard `Accept-Language` header,
 * so a backend that returns a single best-effort name for a list row (rather than the full
 * translation map a detail view gets) can pick the same language the user is reading the
 * rest of the page in, instead of a hardcoded one.
 */
export const contentLanguageInterceptor: HttpInterceptorFn = (request, next) => {
  const transloco = inject(TranslocoService);

  return next(request.clone({ setHeaders: { 'Accept-Language': transloco.getActiveLang() } }));
};

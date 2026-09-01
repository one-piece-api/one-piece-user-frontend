import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { loadRuntimeConfig } from './config/runtime-config';
import { AVAILABLE_LOCALES, resolveInitialLocale } from './i18n/locale';
import { TranslocoHttpLoader } from './i18n/transloco-loader';
import { apiErrorInterceptor } from './shared/http/error-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([apiErrorInterceptor])),
    provideTransloco({
      config: {
        availableLangs: [...AVAILABLE_LOCALES],
        defaultLang: resolveInitialLocale(),
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: TranslocoHttpLoader,
    }),
    // Sequential, not two parallel initializers: the interceptor both requests go through
    // injects MascotService and translates any error toast on the spot, so the language
    // catalog must be fully loaded before the runtime-config request (or any other HTTP
    // call) can possibly fail and race it - not just before the first render.
    provideAppInitializer(async () => {
      // Both injected before the first `await`: `inject()` only works synchronously,
      // within the call's original injection context.
      const transloco = inject(TranslocoService);
      const http = inject(HttpClient);
      await firstValueFrom(transloco.load(transloco.getActiveLang()));
      await loadRuntimeConfig(http);
    }),
  ],
};

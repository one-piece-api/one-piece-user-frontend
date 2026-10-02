import type { TranslocoService } from '@jsverse/transloco';
import { updatedMoment } from './content.model';

/** "today 08:45", "yesterday 19:10" or a short date, in the language the UI is in. */
export function momentLabel(transloco: TranslocoService, instant: string): string {
  const moment = updatedMoment(instant, new Date(), transloco.getActiveLang());
  return transloco.translate(`content.moment.${moment.kind}`, { ...moment });
}

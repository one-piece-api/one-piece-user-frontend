import type { TranslocoService } from '@jsverse/transloco';
import type { Crumb } from '../shared/ui/breadcrumb';
import { DASHBOARD_ROUTE } from './dashboard/dashboard.model';

/** The first step of every content page's trail: back to the dashboard, as in the mockup. */
export function dashboardCrumb(transloco: TranslocoService): Crumb {
  return {
    label: transloco.translate('shell.nav.dashboard'),
    route: DASHBOARD_ROUTE,
  };
}

import type { TranslocoService } from '@jsverse/transloco';
import type { Crumb } from '../shared/ui/breadcrumb';

/**
 * The first step of every content page's trail: the sidebar group the page sits in. Not a
 * link, since the group has no page of its own - like "Administration" on the admin pages.
 */
export function contentsCrumb(transloco: TranslocoService): Crumb {
  return { label: transloco.translate('content.breadcrumb.contents') };
}

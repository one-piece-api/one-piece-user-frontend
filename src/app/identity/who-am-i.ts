import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Badge } from '../shared/ui/badge';
import { Card } from '../shared/ui/card';
import { PageHeader } from '../shared/ui/page-header';
import { CurrentUserService } from './current-user';

@Component({
  selector: 'app-who-am-i',
  templateUrl: './who-am-i.html',
  imports: [Card, Badge, PageHeader, TranslocoPipe],
})
export class WhoAmI {
  protected readonly currentUser = inject(CurrentUserService);
}

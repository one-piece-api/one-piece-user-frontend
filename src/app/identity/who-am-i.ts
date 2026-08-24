import { Component, inject } from '@angular/core';
import { Badge } from '../shared/ui/badge';
import { Card } from '../shared/ui/card';
import { CurrentUserService } from './current-user';

@Component({
  selector: 'app-who-am-i',
  templateUrl: './who-am-i.html',
  imports: [Card, Badge],
})
export class WhoAmI {
  protected readonly currentUser = inject(CurrentUserService);
}

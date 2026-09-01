import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { MascotService } from '../mascot/mascot';
import { buttonClasses } from '../ui/button-variants';
import { Card } from '../ui/card';
import type { ForbiddenState } from './permission.guard';

/** Landed on whenever `permissionGuard` blocks a navigation - see its `ForbiddenState`. */
@Component({
  selector: 'app-forbidden',
  templateUrl: './forbidden.html',
  imports: [Card, RouterLink, TranslocoPipe],
})
export class Forbidden {
  private readonly location = inject(Location);
  private readonly mascotService = inject(MascotService);
  private readonly transloco = inject(TranslocoService);

  protected readonly primaryClasses = buttonClasses('primary');
  protected readonly navClasses = buttonClasses('secondary');

  private readonly state = (this.location.getState() as Partial<ForbiddenState>) ?? {};

  protected readonly route = this.state.route || this.transloco.translate('forbidden.defaultRoute');
  protected readonly permission =
    this.state.permission || this.transloco.translate('forbidden.defaultPermission');
  protected readonly roles = this.state.roles ?? [];

  protected requestAccess(): void {
    this.mascotService.show(this.transloco.translate('forbidden.requestSent'), 'success');
  }
}

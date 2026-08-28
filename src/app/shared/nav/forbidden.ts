import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToastService } from '../toast/toast';
import { buttonClasses } from '../ui/button-variants';
import { Card } from '../ui/card';
import type { ForbiddenState } from './permission.guard';

/** Landed on whenever `permissionGuard` blocks a navigation - see its `ForbiddenState`. */
@Component({
  selector: 'app-forbidden',
  templateUrl: './forbidden.html',
  imports: [Card, RouterLink],
})
export class Forbidden {
  private readonly location = inject(Location);
  private readonly toastService = inject(ToastService);

  protected readonly primaryClasses = buttonClasses('primary');
  protected readonly navClasses = buttonClasses('secondary');

  private readonly state = (this.location.getState() as Partial<ForbiddenState>) ?? {};

  protected readonly route = this.state.route || 'this page';
  protected readonly permission = this.state.permission || 'the required permission';
  protected readonly roles = this.state.roles ?? [];

  protected requestAccess(): void {
    this.toastService.show(
      'Request sent to the ADMINs. It’ll be available next time you sign in.',
      'success',
    );
  }
}

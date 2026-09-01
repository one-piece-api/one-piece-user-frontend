import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, input, output, signal } from '@angular/core';
import { email, form, FormField, required, submit, validate } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { hasErrorCode } from '../shared/http/api-error';
import { MascotService } from '../shared/mascot/mascot';
import { buttonClasses } from '../shared/ui/button-variants';

const INVITE_ENDPOINT = '/api/users';
const EMAIL_ALREADY_REGISTERED_ERROR_CODE = 'USER_EMAIL_ALREADY_REGISTERED';
const EMAIL_DELIVERY_FAILED_ERROR_CODE = 'USER_EMAIL_DELIVERY_FAILED';

interface InviteFormModel {
  email: string;
  roles: string[];
}

interface InvitedUser {
  userId: string;
  email: string;
}

const EMPTY_MODEL: InviteFormModel = { email: '', roles: [] };

/**
 * "Invite User" (Step 4, UF-IDU-01): posts straight to `POST /users`. There is no
 * local invitation record to show here - a successful invite just makes the new PENDING
 * row appear in the Step 3 crew manifest, so this only needs to signal the parent to reload it.
 * Rendered inside `AdminUserList`'s `app-modal`, which already provides the panel chrome
 * and heading - this component is just the form itself. `roles` comes from the parent's
 * own `GET /roles` fetch (ADR-0012: the role set is dynamic, not a fixed enum) rather than
 * being fetched again here.
 */
@Component({
  selector: 'app-invite-user-form',
  templateUrl: './invite-user-form.html',
  imports: [FormField, TranslocoPipe],
})
export class InviteUserForm {
  private readonly http = inject(HttpClient);
  private readonly mascotService = inject(MascotService);
  private readonly transloco = inject(TranslocoService);

  readonly roles = input.required<readonly string[]>();

  readonly invited = output<void>();
  readonly cancelled = output<void>();

  protected readonly model = signal<InviteFormModel>({ ...EMPTY_MODEL });
  protected readonly inviteForm = form(this.model, (path) => {
    required(path.email, { message: () => this.t('users.invite.emailRequired') });
    email(path.email, { message: () => this.t('users.invite.emailInvalid') });
    validate(path, (ctx) =>
      ctx.value().roles.length > 0
        ? null
        : { kind: 'rolesRequired', message: this.t('users.invite.rolesRequired') },
    );
  });

  /** Reads `activeLang` first so signal-forms' reactive graph re-evaluates this message
   * (and any validator using it) when the language changes, not just when the field does. */
  private t(key: string): string {
    this.transloco.activeLang();
    return this.transloco.translate(key);
  }

  protected readonly submitClasses = buttonClasses('primary');
  protected readonly cancelClasses = buttonClasses('secondary');

  protected isRoleSelected(role: string): boolean {
    return this.model().roles.includes(role);
  }

  protected toggleRole(role: string): void {
    this.model.update((current) => {
      const alreadySelected = current.roles.includes(role);
      return {
        ...current,
        roles: alreadySelected
          ? current.roles.filter((selected) => selected !== role)
          : [...current.roles, role],
      };
    });
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void submit(this.inviteForm, async (field) => {
      const value = field().value();
      try {
        const invitedUser = await firstValueFrom(
          this.http.post<InvitedUser>(INVITE_ENDPOINT, {
            email: value.email,
            roles: value.roles,
          }),
        );
        this.mascotService.show(
          this.transloco.translate('users.invite.sent', { email: invitedUser.email }),
          'success',
        );
        this.inviteForm().reset({ ...EMPTY_MODEL });
        this.invited.emit();
        return null;
      } catch (err) {
        if (
          err instanceof HttpErrorResponse &&
          hasErrorCode(err, EMAIL_ALREADY_REGISTERED_ERROR_CODE)
        ) {
          return {
            kind: 'emailAlreadyRegistered',
            message: this.t('users.invite.emailAlreadyRegistered'),
            fieldTree: field.email,
          };
        }
        if (
          err instanceof HttpErrorResponse &&
          hasErrorCode(err, EMAIL_DELIVERY_FAILED_ERROR_CODE)
        ) {
          return {
            kind: 'emailDeliveryFailed',
            message: this.t('users.invite.deliveryFailed'),
          };
        }
        // Authentication/authorization/server failures already get a themed toast from
        // apiErrorInterceptor - this inline message covers the rest (e.g. a validation
        // failure the client-side checks above didn't catch).
        return { kind: 'inviteFailed', message: this.t('users.invite.genericFailed') };
      }
    });
  }
}

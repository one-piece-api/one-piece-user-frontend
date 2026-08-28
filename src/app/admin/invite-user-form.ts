import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, output, signal } from '@angular/core';
import { email, form, FormField, required, submit, validate } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { hasErrorCode } from '../shared/http/api-error';
import { ToastService } from '../shared/toast/toast';
import { buttonClasses } from '../shared/ui/button-variants';

const INVITE_ENDPOINT = '/api/admin/users';
const EMAIL_ALREADY_REGISTERED_ERROR_CODE = 'USER_EMAIL_ALREADY_REGISTERED';
const EMAIL_DELIVERY_FAILED_ERROR_CODE = 'USER_EMAIL_DELIVERY_FAILED';

interface InviteFormModel {
  email: string;
  adminRole: boolean;
  reviewerRole: boolean;
  editorRole: boolean;
}

interface InvitedUser {
  userId: string;
  email: string;
}

const EMPTY_MODEL: InviteFormModel = {
  email: '',
  adminRole: false,
  reviewerRole: false,
  editorRole: false,
};

/** Maps the checkbox trio back onto the `RealmRole` set the BE (UF-IDU-01) accepts. */
function selectedRoles(value: InviteFormModel): string[] {
  return [
    ...(value.adminRole ? ['ADMIN'] : []),
    ...(value.reviewerRole ? ['REVIEWER'] : []),
    ...(value.editorRole ? ['EDITOR'] : []),
  ];
}

/**
 * "Invite User" (Step 4, UF-IDU-01): posts straight to `POST /admin/users`. There is no
 * local invitation record to show here - a successful invite just makes the new PENDING
 * row appear in the Step 3 crew manifest, so this only needs to signal the parent to reload it.
 * Rendered inside `AdminUserList`'s `app-modal`, which already provides the panel chrome
 * and heading - this component is just the form itself.
 */
@Component({
  selector: 'app-invite-user-form',
  templateUrl: './invite-user-form.html',
  imports: [FormField],
})
export class InviteUserForm {
  private readonly http = inject(HttpClient);
  private readonly toastService = inject(ToastService);

  readonly invited = output<void>();
  readonly cancelled = output<void>();

  protected readonly model = signal<InviteFormModel>({ ...EMPTY_MODEL });
  protected readonly inviteForm = form(this.model, (path) => {
    required(path.email, { message: 'An email address be needed, matey.' });
    email(path.email, { message: 'That be no proper email address.' });
    validate(path, (ctx) => {
      const value = ctx.value();
      return value.adminRole || value.reviewerRole || value.editorRole
        ? null
        : { kind: 'rolesRequired', message: 'Pick at least one role for the new crewmate.' };
    });
  });

  protected readonly submitClasses = buttonClasses('primary');
  protected readonly cancelClasses = buttonClasses('secondary');

  protected onSubmit(event: Event): void {
    event.preventDefault();
    void submit(this.inviteForm, async (field) => {
      const value = field().value();
      try {
        const invitedUser = await firstValueFrom(
          this.http.post<InvitedUser>(INVITE_ENDPOINT, {
            email: value.email,
            roles: selectedRoles(value),
          }),
        );
        this.toastService.show(`Invitation sent to ${invitedUser.email}!`, 'success');
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
            message: 'That pirate already sails with the crew - email already registered.',
            fieldTree: field.email,
          };
        }
        if (
          err instanceof HttpErrorResponse &&
          hasErrorCode(err, EMAIL_DELIVERY_FAILED_ERROR_CODE)
        ) {
          return {
            kind: 'emailDeliveryFailed',
            message: "Arrr! The invitation couldn't be delivered - check the ship's mail settings.",
          };
        }
        // Authentication/authorization/server failures already get a themed toast from
        // apiErrorInterceptor - this inline message covers the rest (e.g. a validation
        // failure the client-side checks above didn't catch).
        return { kind: 'inviteFailed', message: 'Arrr! Something went wrong sending the invite.' };
      }
    });
  }
}

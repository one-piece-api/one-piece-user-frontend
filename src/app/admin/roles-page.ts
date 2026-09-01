import { HttpClient, HttpErrorResponse, httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { form, FormField, required, submit, validate } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { hasErrorCode } from '../shared/http/api-error';
import { MascotService } from '../shared/mascot/mascot';
import { buttonClasses } from '../shared/ui/button-variants';
import { Card } from '../shared/ui/card';
import { Modal } from '../shared/ui/modal';
import { PageHeader } from '../shared/ui/page-header';
import type { RolePermissions } from './admin-user.model';
import { groupPermissionsByPrefix, type PermissionDefinition } from './role-catalog.model';

const ROLES_ENDPOINT = '/api/roles';
const PERMISSIONS_ENDPOINT = '/api/permissions';

const ROLE_ALREADY_EXISTS_ERROR_CODE = 'USER_ROLE_ALREADY_EXISTS';
const INVALID_ROLE_NAME_ERROR_CODE = 'USER_INVALID_ROLE_NAME';
const ROLE_IN_USE_ERROR_CODE = 'USER_ROLE_IN_USE';
const LAST_ROLE_MANAGER_ERROR_CODE = 'USER_LAST_ROLE_MANAGER';
const PERMISSION_ALREADY_EXISTS_ERROR_CODE = 'USER_PERMISSION_ALREADY_EXISTS';
const PERMISSION_IN_USE_ERROR_CODE = 'USER_PERMISSION_IN_USE';

/** Selected in the "Resource" dropdown to mean "not one of the existing groups". */
const NEW_RESOURCE_SENTINEL = '__new__';

interface RoleModalModel {
  name: string;
  copyFromRole: string;
}

interface PermissionModalModel {
  resource: string;
  newResource: string;
  action: string;
  description: string;
}

/** Mirrors `RoleManagementService#normalize` (BE) so the newly created role can be selected. */
function normalizeRoleName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * "Ruoli & permessi" (ADR-0012): create/delete roles, create/delete permissions, and
 * toggle which permissions a role holds. Whole-screen gated on `roles:manage`
 * (`app.routes.ts`); listing itself only needs `roles:read`, but nothing here is
 * reachable without the broader permission since the route guard already excludes it
 * from the nav for anyone lacking `roles:manage`.
 */
@Component({
  selector: 'app-roles-page',
  templateUrl: './roles-page.html',
  imports: [Card, PageHeader, Modal, FormField, TranslocoPipe],
})
export class RolesPage {
  private readonly http = inject(HttpClient);
  private readonly mascotService = inject(MascotService);
  private readonly transloco = inject(TranslocoService);

  /** Reads `activeLang` first so signal-forms' reactive graph re-evaluates a validator
   * message (or anything else calling this) when the language changes, not just the field. */
  private t(key: string, params?: Record<string, unknown>): string {
    this.transloco.activeLang();
    return this.transloco.translate(key, params);
  }

  protected readonly newResourceSentinel = NEW_RESOURCE_SENTINEL;

  protected readonly roles = httpResource<RolePermissions[]>(() => ROLES_ENDPOINT);
  protected readonly permissions = httpResource<PermissionDefinition[]>(() => PERMISSIONS_ENDPOINT);

  protected readonly permissionGroups = computed(() =>
    groupPermissionsByPrefix(this.permissions.value() ?? []),
  );
  /** Membership means "explicitly expanded by the user" - groups start collapsed. */
  protected readonly openGroups = signal<ReadonlySet<string>>(new Set());

  protected readonly selectedRole = signal<string | null>(null);
  protected readonly selectedRolePermissions = computed(() => {
    const role = this.selectedRole();
    const entry = this.roles.value()?.find((r) => r.role === role);
    return entry?.permissions ?? [];
  });

  protected readonly togglingPermission = signal<string | null>(null);
  protected readonly deletingRole = signal<string | null>(null);
  protected readonly deletePending = signal(false);
  protected readonly deletingPermission = signal<string | null>(null);
  protected readonly deletePermissionPending = signal(false);

  protected readonly roleModalOpen = signal(false);
  protected readonly roleModalModel = signal<RoleModalModel>({ name: '', copyFromRole: '' });
  protected readonly roleModalForm = form(this.roleModalModel, (path) => {
    required(path.name, { message: () => this.t('roles.newRoleModal.nameRequired') });
  });
  protected readonly roleModalError = signal<string | null>(null);

  protected readonly permModalOpen = signal(false);
  protected readonly permModalModel = signal<PermissionModalModel>(this.emptyPermModel());
  protected readonly permModalForm = form(this.permModalModel, (path) => {
    required(path.action, { message: () => this.t('roles.newPermissionModal.actionRequired') });
    validate(path.action, (ctx) =>
      /^[a-z0-9]+$/.test(ctx.value())
        ? null
        : { kind: 'invalidAction', message: this.t('roles.newPermissionModal.invalidAction') },
    );
    validate(path, (ctx) => {
      const value = ctx.value();
      if (value.resource !== NEW_RESOURCE_SENTINEL) {
        return null;
      }
      return /^[a-z0-9]+$/.test(value.newResource)
        ? null
        : {
            kind: 'invalidResource',
            message: this.t('roles.newPermissionModal.invalidResource'),
          };
    });
    required(path.description, { message: () => this.t('roles.newPermissionModal.labelRequired') });
  });
  protected readonly permModalError = signal<string | null>(null);

  protected readonly primaryClasses = buttonClasses('primary');
  protected readonly secondaryClasses = buttonClasses('secondary');
  protected readonly dangerClasses = buttonClasses('danger');

  constructor() {
    // Default to the first role once the registry loads; re-pick if the selected role
    // disappears (deleted, or not selected yet). Reads `selectedRole` untracked so a
    // manual selection (picking a role, or selecting one just created) isn't immediately
    // overwritten by this same effect re-running before a reload has caught up with it -
    // this effect only reacts to the roles list itself changing.
    effect(() => {
      const roles = this.roles.value();
      if (!roles) {
        return;
      }
      const current = untracked(() => this.selectedRole());
      if (current !== null && roles.some((r) => r.role === current)) {
        return;
      }
      this.selectedRole.set(roles[0]?.role ?? null);
    });
    effect(() => {
      if (this.roles.error() || this.permissions.error()) {
        this.mascotService.show(this.transloco.translate('roles.loadRegistryError'), 'error');
      }
    });
  }

  protected selectRole(role: string): void {
    this.selectedRole.set(role);
  }

  protected isGroupOpen(prefix: string): boolean {
    return this.openGroups().has(prefix);
  }

  protected toggleGroup(prefix: string): void {
    this.openGroups.update((current) => {
      const next = new Set(current);
      if (next.has(prefix)) {
        next.delete(prefix);
      } else {
        next.add(prefix);
      }
      return next;
    });
  }

  protected hasPermission(key: string): boolean {
    return this.selectedRolePermissions().includes(key);
  }

  protected async togglePermission(key: string): Promise<void> {
    const role = this.selectedRole();
    if (!role) {
      return;
    }
    const has = this.hasPermission(key);
    this.togglingPermission.set(key);
    try {
      if (has) {
        await firstValueFrom(
          this.http.delete<void>(`${ROLES_ENDPOINT}/${role}/permissions/${key}`),
        );
        this.mascotService.show(
          this.transloco.translate('roles.permissionRevoked', { key, role }),
          'success',
        );
      } else {
        await firstValueFrom(
          this.http.put<void>(`${ROLES_ENDPOINT}/${role}/permissions/${key}`, {}),
        );
        this.mascotService.show(
          this.transloco.translate('roles.permissionGranted', { key, role }),
          'success',
        );
      }
      // Updated in place rather than `this.roles.reload()`: the server already confirmed
      // this exact change, so a full re-fetch would only add a round trip - and would
      // briefly blank the whole section back to the loading placeholder while it's in
      // flight (`isLoading()` covers reloads too), which is exactly the flash a single
      // toggle shouldn't cause.
      this.setRolePermissionLocally(role, key, !has);
    } catch (err) {
      if (err instanceof HttpErrorResponse && hasErrorCode(err, LAST_ROLE_MANAGER_ERROR_CODE)) {
        this.mascotService.show(
          this.transloco.translate('roles.lastRoleManager', { role }),
          'error',
        );
      }
      // 401/403/404/5xx already get a themed toast from apiErrorInterceptor.
    } finally {
      this.togglingPermission.set(null);
    }
  }

  protected openRoleModal(): void {
    this.roleModalForm().reset(this.emptyRoleModel());
    this.roleModalError.set(null);
    this.roleModalOpen.set(true);
  }

  /** Resets the form here too, not just on open: touched/error state shouldn't outlive a cancel. */
  protected closeRoleModal(): void {
    this.roleModalOpen.set(false);
    this.roleModalForm().reset(this.emptyRoleModel());
    this.roleModalError.set(null);
  }

  protected onSubmitRoleModal(event: Event): void {
    event.preventDefault();
    this.roleModalError.set(null);
    void submit(this.roleModalForm, async (field) => {
      const value = field().value();
      try {
        await firstValueFrom(
          this.http.post<RolePermissions[]>(ROLES_ENDPOINT, {
            name: value.name,
            copyFromRole: value.copyFromRole || null,
          }),
        );
        this.mascotService.show(
          this.transloco.translate('roles.created', { role: normalizeRoleName(value.name) }),
          'success',
        );
        this.selectedRole.set(normalizeRoleName(value.name));
        this.roles.reload();
        this.roleModalOpen.set(false);
        return null;
      } catch (err) {
        if (err instanceof HttpErrorResponse && hasErrorCode(err, ROLE_ALREADY_EXISTS_ERROR_CODE)) {
          this.roleModalError.set(
            this.transloco.translate('roles.newRoleModal.alreadyExists', {
              role: normalizeRoleName(value.name),
            }),
          );
        } else if (
          err instanceof HttpErrorResponse &&
          hasErrorCode(err, INVALID_ROLE_NAME_ERROR_CODE)
        ) {
          this.roleModalError.set(this.transloco.translate('roles.newRoleModal.invalidName'));
        } else {
          this.roleModalError.set(this.transloco.translate('roles.newRoleModal.genericFailed'));
        }
        return null;
      }
    });
  }

  protected requestDeleteRole(role: string): void {
    this.deletingRole.set(role);
  }

  protected cancelDeleteRole(): void {
    this.deletingRole.set(null);
  }

  protected async confirmDeleteRole(): Promise<void> {
    const role = this.deletingRole();
    if (!role) {
      return;
    }
    this.deletePending.set(true);
    try {
      await firstValueFrom(this.http.delete<void>(`${ROLES_ENDPOINT}/${role}`));
      this.mascotService.show(this.transloco.translate('roles.deleted', { role }), 'success');
      this.roles.reload();
    } catch (err) {
      if (err instanceof HttpErrorResponse && hasErrorCode(err, ROLE_IN_USE_ERROR_CODE)) {
        this.mascotService.show(this.transloco.translate('roles.inUse', { role }), 'error');
      } else if (
        err instanceof HttpErrorResponse &&
        hasErrorCode(err, LAST_ROLE_MANAGER_ERROR_CODE)
      ) {
        this.mascotService.show(
          this.transloco.translate('roles.lastRoleManagerDelete', { role }),
          'error',
        );
      }
      // 401/403/404/5xx already get a themed toast from apiErrorInterceptor.
    } finally {
      // Closed on every outcome, not just success: the dialog's native top layer would
      // otherwise sit in front of the mascot's error toast, hiding it behind a modal the
      // user has no reason to keep open - there's nothing left in it to fix and retry.
      this.deletingRole.set(null);
      this.deletePending.set(false);
    }
  }

  protected openPermModal(): void {
    this.permModalForm().reset(this.emptyPermModel());
    this.permModalError.set(null);
    this.permModalOpen.set(true);
  }

  /** Resets the form here too, not just on open: touched/error state shouldn't outlive a cancel. */
  protected closePermModal(): void {
    this.permModalOpen.set(false);
    this.permModalForm().reset(this.emptyPermModel());
    this.permModalError.set(null);
  }

  protected onSubmitPermModal(event: Event): void {
    event.preventDefault();
    this.permModalError.set(null);
    void submit(this.permModalForm, async (field) => {
      const value = field().value();
      const resource =
        value.resource === NEW_RESOURCE_SENTINEL
          ? value.newResource.trim().toLowerCase()
          : value.resource;
      const key = `${resource}:${value.action.trim().toLowerCase()}`;
      try {
        await firstValueFrom(
          this.http.post<PermissionDefinition>(PERMISSIONS_ENDPOINT, {
            key,
            description: value.description,
          }),
        );
        this.mascotService.show(
          this.transloco.translate('roles.permissionCreated', { key }),
          'success',
        );
        this.permissions.reload();
        this.permModalOpen.set(false);
        return null;
      } catch (err) {
        if (
          err instanceof HttpErrorResponse &&
          hasErrorCode(err, PERMISSION_ALREADY_EXISTS_ERROR_CODE)
        ) {
          this.permModalError.set(
            this.transloco.translate('roles.newPermissionModal.alreadyExists', { key }),
          );
        } else {
          this.permModalError.set(
            this.transloco.translate('roles.newPermissionModal.genericFailed'),
          );
        }
        return null;
      }
    });
  }

  protected requestDeletePermission(key: string): void {
    this.deletingPermission.set(key);
  }

  protected cancelDeletePermission(): void {
    this.deletingPermission.set(null);
  }

  protected async confirmDeletePermission(): Promise<void> {
    const key = this.deletingPermission();
    if (!key) {
      return;
    }
    this.deletePermissionPending.set(true);
    try {
      await firstValueFrom(this.http.delete<void>(`${PERMISSIONS_ENDPOINT}/${key}`));
      this.mascotService.show(
        this.transloco.translate('roles.permissionDeleted', { key }),
        'success',
      );
      this.permissions.reload();
    } catch (err) {
      if (err instanceof HttpErrorResponse && hasErrorCode(err, PERMISSION_IN_USE_ERROR_CODE)) {
        this.mascotService.show(
          this.transloco.translate('roles.permissionInUse', { key }),
          'error',
        );
      }
      // 401/403/404/5xx already get a themed toast from apiErrorInterceptor.
    } finally {
      // Closed on every outcome, not just success: the dialog's native top layer would
      // otherwise sit in front of the mascot's error toast, hiding it behind a modal the
      // user has no reason to keep open - there's nothing left in it to fix and retry.
      this.deletingPermission.set(null);
      this.deletePermissionPending.set(false);
    }
  }

  /** Reflects a just-confirmed assign/revoke without re-fetching the whole role list. */
  private setRolePermissionLocally(role: string, permissionKey: string, granted: boolean): void {
    this.roles.value.update((current) =>
      (current ?? []).map((entry) =>
        entry.role === role
          ? {
              ...entry,
              permissions: granted
                ? [...entry.permissions, permissionKey].sort()
                : entry.permissions.filter((held) => held !== permissionKey),
            }
          : entry,
      ),
    );
  }

  private emptyRoleModel(): RoleModalModel {
    return { name: '', copyFromRole: '' };
  }

  private emptyPermModel(): PermissionModalModel {
    const firstGroup = this.permissionGroups()[0]?.prefix;
    return {
      resource: firstGroup ?? NEW_RESOURCE_SENTINEL,
      newResource: '',
      action: '',
      description: '',
    };
  }
}

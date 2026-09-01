import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MascotService } from '../shared/mascot/mascot';
import { RolesPage } from './roles-page';

const DEFAULT_ROLES = [
  { role: 'ADMIN', permissions: ['users:read', 'roles:manage'] },
  { role: 'EDITOR', permissions: ['docs:read'] },
];

const DEFAULT_PERMISSIONS = [
  { key: 'users:read', description: 'List and view crew members' },
  { key: 'roles:manage', description: 'Manage roles and permissions' },
  { key: 'docs:read', description: 'View documents' },
];

// jsdom doesn't implement <dialog>'s showModal()/close() yet - every real browser this app
// targets does, so this is purely a test-environment gap.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement): void {
    this.setAttribute('open', '');
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement): void {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

function setValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

/** Groups start collapsed (see RolesPage#openGroups) - expand one by its visible label. */
function expandGroup(fixture: ComponentFixture<RolesPage>, label: string): void {
  const root = fixture.nativeElement as HTMLElement;
  const groupButton = Array.from(root.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(label),
  );
  groupButton!.click();
  fixture.detectChanges();
}

describe('RolesPage', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RolesPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  async function createAndLoad(
    roles: typeof DEFAULT_ROLES = DEFAULT_ROLES,
    permissions: typeof DEFAULT_PERMISSIONS = DEFAULT_PERMISSIONS,
  ) {
    const fixture = TestBed.createComponent(RolesPage);
    fixture.detectChanges();
    httpTesting.expectOne('/api/roles').flush(roles);
    httpTesting.expectOne('/api/permissions').flush(permissions);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows every group collapsed by default', async () => {
    const fixture = await createAndLoad();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[aria-label="users:read"]')).toBeNull();
    expect(root.querySelector('[aria-label="docs:read"]')).toBeNull();
    expect(root.querySelector('[aria-label="roles:manage"]')).toBeNull();
  });

  it('expands a group to reveal its permissions, and collapses it back', async () => {
    const fixture = await createAndLoad();
    const root = fixture.nativeElement as HTMLElement;

    expandGroup(fixture, 'Docs');
    expect(root.querySelector('[aria-label="docs:read"]')).not.toBeNull();

    expandGroup(fixture, 'Docs');
    expect(root.querySelector('[aria-label="docs:read"]')).toBeNull();
  });

  it('auto-selects the first role and shows its permission matrix', async () => {
    const fixture = await createAndLoad();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Permissions of ADMIN');
    expandGroup(fixture, 'Users');
    expandGroup(fixture, 'Docs');
    const usersReadSwitch = root.querySelector('[aria-label="users:read"]');
    const docsReadSwitch = root.querySelector('[aria-label="docs:read"]');
    expect(usersReadSwitch?.getAttribute('aria-checked')).toBe('true');
    expect(docsReadSwitch?.getAttribute('aria-checked')).toBe('false');
  });

  it('switches the matrix when a different role is selected', async () => {
    const fixture = await createAndLoad();
    const root = fixture.nativeElement as HTMLElement;

    const editorCard = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('EDITOR'),
    );
    editorCard!.click();
    fixture.detectChanges();
    expandGroup(fixture, 'Docs');

    expect(root.textContent).toContain('Permissions of EDITOR');
    expect(root.querySelector('[aria-label="docs:read"]')?.getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('assigns a permission to the selected role, updating only that switch', async () => {
    const fixture = await createAndLoad();
    const root = fixture.nativeElement as HTMLElement;
    expandGroup(fixture, 'Docs');

    const docsReadSwitch = root.querySelector('[aria-label="docs:read"]') as HTMLButtonElement;
    expect(docsReadSwitch.getAttribute('aria-checked')).toBe('false');
    docsReadSwitch.click();
    await fixture.whenStable();

    // No GET /api/roles here: a successful assign/revoke updates the in-memory role
    // entry directly rather than re-fetching the whole registry (see
    // RolesPage#setRolePermissionLocally) - this is the fix for the switch flipping
    // instantly instead of the whole matrix section flashing back to its loading state.
    httpTesting.expectOne('/api/roles/ADMIN/permissions/docs:read').flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(docsReadSwitch.getAttribute('aria-checked')).toBe('true');
    const mascotService = TestBed.inject(MascotService);
    expect(mascotService.message()).toEqual(
      expect.objectContaining({ text: 'Granted docs:read to ADMIN!', tone: 'success' }),
    );
  });

  it('shows a themed error when revoking the last roles:manage holder', async () => {
    const fixture = await createAndLoad();
    const root = fixture.nativeElement as HTMLElement;
    expandGroup(fixture, 'Roles');

    const rolesManageSwitch = root.querySelector(
      '[aria-label="roles:manage"]',
    ) as HTMLButtonElement;
    rolesManageSwitch.click();
    await fixture.whenStable();

    httpTesting
      .expectOne('/api/roles/ADMIN/permissions/roles:manage')
      .flush({ errorCode: 'USER_LAST_ROLE_MANAGER' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    fixture.detectChanges();

    const mascotService = TestBed.inject(MascotService);
    expect(mascotService.message().tone).toBe('error');
    expect(mascotService.message().text).toContain('only role that can still manage');
  });

  it('creates a role and selects it', async () => {
    const fixture = await createAndLoad();
    const root = fixture.nativeElement as HTMLElement;

    const newRoleButton = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'New Role',
    );
    newRoleButton!.click();
    fixture.detectChanges();

    setValue(root.querySelector('#role-name') as HTMLInputElement, 'navigator');
    root
      .querySelector('#role-name')!
      .closest('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    const request = httpTesting.expectOne('/api/roles');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ name: 'navigator', copyFromRole: null });
    request.flush([...DEFAULT_ROLES, { role: 'NAVIGATOR', permissions: [] }], {
      status: 201,
      statusText: 'Created',
    });
    await fixture.whenStable();
    fixture.detectChanges();
    httpTesting
      .expectOne('/api/roles')
      .flush([...DEFAULT_ROLES, { role: 'NAVIGATOR', permissions: [] }]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain('Permissions of NAVIGATOR');
  });

  it('shows an inline error when creating a duplicate role', async () => {
    const fixture = await createAndLoad();
    const root = fixture.nativeElement as HTMLElement;

    const newRoleButton = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'New Role',
    );
    newRoleButton!.click();
    fixture.detectChanges();

    setValue(root.querySelector('#role-name') as HTMLInputElement, 'ADMIN');
    root
      .querySelector('#role-name')!
      .closest('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    httpTesting
      .expectOne('/api/roles')
      .flush({ errorCode: 'USER_ROLE_ALREADY_EXISTS' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain('already exists');
  });

  it('deletes a role after confirmation', async () => {
    const fixture = await createAndLoad();
    const root = fixture.nativeElement as HTMLElement;

    const deleteButton = root.querySelector(
      'button[aria-label="Delete role EDITOR"]',
    ) as HTMLButtonElement;
    deleteButton.click();
    fixture.detectChanges();

    const confirmButton = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete Role',
    );
    confirmButton!.click();
    await fixture.whenStable();

    httpTesting.expectOne('/api/roles/EDITOR').flush(null);
    await fixture.whenStable();
    fixture.detectChanges();
    httpTesting.expectOne('/api/roles').flush([DEFAULT_ROLES[0]]);
    fixture.detectChanges();

    const mascotService = TestBed.inject(MascotService);
    expect(mascotService.message()).toEqual(
      expect.objectContaining({ text: 'Role EDITOR removed from the registry.', tone: 'success' }),
    );
  });

  it('shows a themed error when deleting a role still in use', async () => {
    const fixture = await createAndLoad();
    const root = fixture.nativeElement as HTMLElement;

    const deleteButton = root.querySelector(
      'button[aria-label="Delete role EDITOR"]',
    ) as HTMLButtonElement;
    deleteButton.click();
    fixture.detectChanges();

    const confirmButton = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete Role',
    );
    confirmButton!.click();
    await fixture.whenStable();

    httpTesting
      .expectOne('/api/roles/EDITOR')
      .flush({ errorCode: 'USER_ROLE_IN_USE' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    fixture.detectChanges();

    const mascotService = TestBed.inject(MascotService);
    expect(mascotService.message().tone).toBe('error');
    expect(mascotService.message().text).toContain('still has crew assigned');
  });

  it('creates a permission under an existing resource group', async () => {
    const fixture = await createAndLoad();
    const root = fixture.nativeElement as HTMLElement;

    const newPermButton = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'New Permission',
    );
    newPermButton!.click();
    fixture.detectChanges();

    // Groups are sorted alphabetically (docs, roles, users), so "docs" is the default
    // selection - no need to touch the resource select for this case.
    setValue(root.querySelector('#perm-action') as HTMLInputElement, 'approve');
    setValue(root.querySelector('#perm-description') as HTMLInputElement, 'Approve documents');
    root
      .querySelector('#perm-action')!
      .closest('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    const request = httpTesting.expectOne('/api/permissions');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ key: 'docs:approve', description: 'Approve documents' });
    request.flush(
      { key: 'docs:approve', description: 'Approve documents' },
      { status: 201, statusText: 'Created' },
    );
    await fixture.whenStable();
    fixture.detectChanges();
    httpTesting
      .expectOne('/api/permissions')
      .flush([...DEFAULT_PERMISSIONS, { key: 'docs:approve', description: 'Approve documents' }]);
    fixture.detectChanges();

    const mascotService = TestBed.inject(MascotService);
    expect(mascotService.message().tone).toBe('success');
    expect(mascotService.message().text).toContain('docs:approve');
  });

  it('creates a permission under a brand-new resource group', async () => {
    const fixture = await createAndLoad();
    const root = fixture.nativeElement as HTMLElement;

    const newPermButton = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'New Permission',
    );
    newPermButton!.click();
    fixture.detectChanges();

    const resourceSelect = root.querySelector('#perm-resource') as HTMLSelectElement;
    resourceSelect.value = '__new__';
    resourceSelect.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    setValue(root.querySelector('#perm-new-resource') as HTMLInputElement, 'billing');
    setValue(root.querySelector('#perm-action') as HTMLInputElement, 'view');
    setValue(root.querySelector('#perm-description') as HTMLInputElement, 'View billing');
    root
      .querySelector('#perm-action')!
      .closest('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    const request = httpTesting.expectOne('/api/permissions');
    expect(request.request.body).toEqual({ key: 'billing:view', description: 'View billing' });
    request.flush(
      { key: 'billing:view', description: 'View billing' },
      { status: 201, statusText: 'Created' },
    );
    await fixture.whenStable();
    fixture.detectChanges();
    httpTesting
      .expectOne('/api/permissions')
      .flush([...DEFAULT_PERMISSIONS, { key: 'billing:view', description: 'View billing' }]);
    fixture.detectChanges();

    const mascotService = TestBed.inject(MascotService);
    expect(mascotService.message().text).toContain('billing:view');
  });

  it('rejects a malformed action before calling the backend', async () => {
    const fixture = await createAndLoad();
    const root = fixture.nativeElement as HTMLElement;

    const newPermButton = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'New Permission',
    );
    newPermButton!.click();
    fixture.detectChanges();

    setValue(root.querySelector('#perm-action') as HTMLInputElement, 'Not Valid');
    setValue(root.querySelector('#perm-description') as HTMLInputElement, 'Something');
    root
      .querySelector('#perm-action')!
      .closest('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    httpTesting.expectNone('/api/permissions');
    expect(root.textContent).toContain('lowercase letters/numbers only');
  });

  it('rejects a malformed new group name before calling the backend', async () => {
    const fixture = await createAndLoad();
    const root = fixture.nativeElement as HTMLElement;

    const newPermButton = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'New Permission',
    );
    newPermButton!.click();
    fixture.detectChanges();

    const resourceSelect = root.querySelector('#perm-resource') as HTMLSelectElement;
    resourceSelect.value = '__new__';
    resourceSelect.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    setValue(root.querySelector('#perm-new-resource') as HTMLInputElement, 'Not Valid');
    setValue(root.querySelector('#perm-action') as HTMLInputElement, 'view');
    setValue(root.querySelector('#perm-description') as HTMLInputElement, 'Something');
    root
      .querySelector('#perm-action')!
      .closest('form')!
      .dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    httpTesting.expectNone('/api/permissions');
    expect(root.textContent).toContain('New group name must be lowercase');
  });

  it('deletes a permission after confirmation', async () => {
    const fixture = await createAndLoad();
    const root = fixture.nativeElement as HTMLElement;
    expandGroup(fixture, 'Docs');

    const deleteButton = root.querySelector(
      'button[aria-label="Delete permission docs:read"]',
    ) as HTMLButtonElement;
    deleteButton.click();
    fixture.detectChanges();

    const confirmButton = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete Permission',
    );
    confirmButton!.click();
    await fixture.whenStable();

    httpTesting.expectOne('/api/permissions/docs:read').flush(null);
    await fixture.whenStable();
    fixture.detectChanges();
    httpTesting
      .expectOne('/api/permissions')
      .flush([DEFAULT_PERMISSIONS[0], DEFAULT_PERMISSIONS[1]]);
    fixture.detectChanges();

    const mascotService = TestBed.inject(MascotService);
    expect(mascotService.message()).toEqual(
      expect.objectContaining({
        text: 'Permission docs:read removed from the registry.',
        tone: 'success',
      }),
    );
  });

  it('shows a themed error when deleting a permission still assigned to a role', async () => {
    const fixture = await createAndLoad();
    const root = fixture.nativeElement as HTMLElement;
    expandGroup(fixture, 'Roles');

    const deleteButton = root.querySelector(
      'button[aria-label="Delete permission roles:manage"]',
    ) as HTMLButtonElement;
    deleteButton.click();
    fixture.detectChanges();

    const confirmButton = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete Permission',
    );
    confirmButton!.click();
    await fixture.whenStable();

    httpTesting
      .expectOne('/api/permissions/roles:manage')
      .flush({ errorCode: 'USER_PERMISSION_IN_USE' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    fixture.detectChanges();

    const mascotService = TestBed.inject(MascotService);
    expect(mascotService.message().tone).toBe('error');
    expect(mascotService.message().text).toContain('still granted to at least one role');
  });
});

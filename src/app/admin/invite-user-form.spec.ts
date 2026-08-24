import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ToastService } from '../shared/toast/toast';
import { InviteUserForm } from './invite-user-form';

function setValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function check(checkbox: HTMLInputElement): void {
  checkbox.checked = true;
  checkbox.dispatchEvent(new Event('input'));
}

describe('InviteUserForm', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InviteUserForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('rejects submission with no email and no role, without calling the backend', async () => {
    const fixture = TestBed.createComponent(InviteUserForm);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    httpTesting.expectNone('/api/admin/users');
    expect(root.textContent).toContain('email address be needed');
    expect(root.textContent).toContain('Pick at least one role');
  });

  it('invites a user, emits invited, resets the form, and shows a success toast', async () => {
    const fixture = TestBed.createComponent(InviteUserForm);
    fixture.detectChanges();
    const toastService = TestBed.inject(ToastService);
    let invitedEmitted = false;
    fixture.componentInstance.invited.subscribe(() => (invitedEmitted = true));

    const root = fixture.nativeElement as HTMLElement;
    setValue(root.querySelector('#invite-email')!, 'usopp@onepiece.local');
    check(root.querySelector('input[type=checkbox]')!);
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    const request = httpTesting.expectOne('/api/admin/users');
    expect(request.request.body).toEqual({ email: 'usopp@onepiece.local', roles: ['ADMIN'] });
    request.flush(
      { userId: '1', email: 'usopp@onepiece.local' },
      { status: 201, statusText: 'Created' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(invitedEmitted).toBe(true);
    expect(toastService.toasts()).toContainEqual(
      expect.objectContaining({
        message: 'Invitation sent to usopp@onepiece.local!',
        tone: 'success',
      }),
    );
    expect((root.querySelector('#invite-email') as HTMLInputElement).value).toBe('');
  });

  it('shows a field error when the email is already registered', async () => {
    const fixture = TestBed.createComponent(InviteUserForm);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    setValue(root.querySelector('#invite-email')!, 'luffy@onepiece.local');
    check(root.querySelector('input[type=checkbox]')!);
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    httpTesting
      .expectOne('/api/admin/users')
      .flush(
        { detail: 'Email already registered', errorCode: 'USER_EMAIL_ALREADY_REGISTERED' },
        { status: 409, statusText: 'Conflict' },
      );
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain('already sails with the crew');
  });

  it('shows a generic inline error for a failure other than email-already-registered', async () => {
    const fixture = TestBed.createComponent(InviteUserForm);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    setValue(root.querySelector('#invite-email')!, 'usopp@onepiece.local');
    check(root.querySelector('input[type=checkbox]')!);
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    httpTesting
      .expectOne('/api/admin/users')
      .flush(
        { detail: 'Something exploded', errorCode: 'INTERNAL_ERROR' },
        { status: 500, statusText: 'Internal Server Error' },
      );
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain('Something went wrong sending the invite');
  });
});

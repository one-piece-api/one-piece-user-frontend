import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MascotService } from '../shared/mascot/mascot';
import { provideTranslocoTesting } from '../testing/i18n-testing';
import { InviteUserForm } from './invite-user-form';

const DEFAULT_ROLES = ['ADMIN', 'REVIEWER', 'EDITOR'];

function setValue(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function check(checkbox: HTMLInputElement): void {
  checkbox.checked = true;
  checkbox.dispatchEvent(new Event('change'));
}

function createFixture(roles: readonly string[] = DEFAULT_ROLES) {
  const fixture = TestBed.createComponent(InviteUserForm);
  fixture.componentRef.setInput('roles', roles);
  fixture.detectChanges();
  return fixture;
}

describe('InviteUserForm', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InviteUserForm, provideTranslocoTesting()],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('rejects submission with no email and no role, without calling the backend', async () => {
    const fixture = createFixture();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    httpTesting.expectNone('/api/users');
    expect(root.textContent).toContain('email address be needed');
    expect(root.textContent).toContain('Pick at least one role');
  });

  it('renders one checkbox per role from the registry, in order', () => {
    const fixture = createFixture(['ADMIN', 'NAVIGATOR']);

    const root = fixture.nativeElement as HTMLElement;
    const labels = Array.from(root.querySelectorAll('label'))
      .filter((label) => label.querySelector('input[type=checkbox]'))
      .map((label) => label.textContent?.trim());
    expect(labels).toEqual(['ADMIN', 'NAVIGATOR']);
  });

  it('emits cancelled when the Cancel button is clicked, without calling the backend', async () => {
    const fixture = createFixture();
    let cancelledEmitted = false;
    fixture.componentInstance.cancelled.subscribe(() => (cancelledEmitted = true));

    const root = fixture.nativeElement as HTMLElement;
    const cancelButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Cancel',
    );
    cancelButton!.click();
    fixture.detectChanges();

    httpTesting.expectNone('/api/users');
    expect(cancelledEmitted).toBe(true);
  });

  it('invites a user, emits invited, resets the form, and shows a success message', async () => {
    const fixture = createFixture();
    const mascotService = TestBed.inject(MascotService);
    let invitedEmitted = false;
    fixture.componentInstance.invited.subscribe(() => (invitedEmitted = true));

    const root = fixture.nativeElement as HTMLElement;
    setValue(root.querySelector('#invite-email')!, 'usopp@onepiece.local');
    check(root.querySelector('input[type=checkbox]')!);
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    const request = httpTesting.expectOne('/api/users');
    expect(request.request.body).toEqual({ email: 'usopp@onepiece.local', roles: ['ADMIN'] });
    request.flush(
      { userId: '1', email: 'usopp@onepiece.local' },
      { status: 201, statusText: 'Created' },
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(invitedEmitted).toBe(true);
    expect(mascotService.message()).toEqual(
      expect.objectContaining({
        text: 'Invitation sent to usopp@onepiece.local!',
        tone: 'success',
      }),
    );
    expect((root.querySelector('#invite-email') as HTMLInputElement).value).toBe('');
  });

  it('shows a field error when the email is already registered', async () => {
    const fixture = createFixture();

    const root = fixture.nativeElement as HTMLElement;
    setValue(root.querySelector('#invite-email')!, 'luffy@onepiece.local');
    check(root.querySelector('input[type=checkbox]')!);
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    httpTesting
      .expectOne('/api/users')
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

  it('shows an inline error when the invitation email cannot be delivered', async () => {
    const fixture = createFixture();

    const root = fixture.nativeElement as HTMLElement;
    setValue(root.querySelector('#invite-email')!, 'usopp@onepiece.local');
    check(root.querySelector('input[type=checkbox]')!);
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    httpTesting
      .expectOne('/api/users')
      .flush(
        { detail: 'Could not send the invitation email', errorCode: 'USER_EMAIL_DELIVERY_FAILED' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain("couldn't be delivered");
  });

  it('shows a generic inline error for a failure other than email-already-registered', async () => {
    const fixture = createFixture();

    const root = fixture.nativeElement as HTMLElement;
    setValue(root.querySelector('#invite-email')!, 'usopp@onepiece.local');
    check(root.querySelector('input[type=checkbox]')!);
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    httpTesting
      .expectOne('/api/users')
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

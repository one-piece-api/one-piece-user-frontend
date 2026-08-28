import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ToastService } from '../toast/toast';
import { Forbidden } from './forbidden';
import type { ForbiddenState } from './permission.guard';

describe('Forbidden', () => {
  function createWithState(state: ForbiddenState | undefined) {
    TestBed.configureTestingModule({
      imports: [Forbidden],
      providers: [provideRouter([]), { provide: Location, useValue: { getState: () => state } }],
    });
    return TestBed.createComponent(Forbidden);
  }

  it('shows the attempted route, missing permission and current roles', () => {
    const fixture = createWithState({
      route: '/admin/users',
      permission: 'users:read',
      roles: ['EDITOR'],
    });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('/admin/users');
    expect(root.textContent).toContain('users:read');
    expect(root.textContent).toContain('EDITOR');
  });

  it('falls back to generic wording when no state was carried over', () => {
    const fixture = createWithState(undefined);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('this page');
    expect(root.textContent).toContain('the required permission');
    expect(root.textContent).toContain('none');
  });

  it('shows a confirmation toast when requesting access', () => {
    const fixture = createWithState({ route: '/admin/users', permission: 'users:read', roles: [] });
    fixture.detectChanges();
    const toastService = TestBed.inject(ToastService);

    const root = fixture.nativeElement as HTMLElement;
    const button = Array.from(root.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Request Access',
    );
    button!.click();

    expect(toastService.toasts()).toHaveLength(1);
  });
});

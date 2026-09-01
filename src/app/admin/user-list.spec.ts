import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Modal } from '../shared/ui/modal';
import { AdminUserList } from './user-list';

// jsdom doesn't implement <dialog>'s showModal()/close() yet - every real browser this app
// targets does, so this is purely a test-environment gap, polyfilled here rather than
// worked around in Modal itself.
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

describe('AdminUserList', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUserList],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('lists users with their status and roles', async () => {
    const fixture = TestBed.createComponent(AdminUserList);
    fixture.detectChanges();
    httpTesting.expectOne('/api/roles').flush([]);

    httpTesting.expectOne('/api/users?page=0').flush({
      content: [
        {
          userId: '1',
          username: 'luffy',
          email: 'luffy@onepiece.local',
          status: 'ACTIVE',
          roles: ['ADMIN'],
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('luffy');
    expect(root.textContent).toContain('Active');
    expect(root.textContent).toContain('ADMIN');
    expect(root.textContent).toContain('1–1 of 1');
  });

  it('shows exactly one status badge in the header row on mobile and the standalone one at sm and up', async () => {
    const fixture = TestBed.createComponent(AdminUserList);
    fixture.detectChanges();
    httpTesting.expectOne('/api/roles').flush([]);

    httpTesting.expectOne('/api/users?page=0').flush({
      content: [
        {
          userId: '1',
          username: 'luffy',
          email: 'luffy@onepiece.local',
          status: 'ACTIVE',
          roles: ['ADMIN'],
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const badges = Array.from(root.querySelectorAll('app-badge')).filter((b) =>
      b.textContent?.includes('Active'),
    );
    // Folded into the name/avatar header on mobile (`sm:hidden`) and shown as its own
    // standalone grid column from `sm` up (`hidden sm:inline-flex`) - never both at once.
    expect(badges).toHaveLength(2);
    expect(badges.some((b) => b.className.includes('sm:hidden'))).toBe(true);
    expect(
      badges.some((b) => b.className.includes('hidden') && b.className.includes('sm:inline-flex')),
    ).toBe(true);

    // The name/avatar link must claim the row's remaining space (flex-1) rather than
    // being squeezed toward zero width by the fixed-size badge next to it (flex-none) -
    // regression: without flex-1 here, the username collapsed to width 0 on mobile.
    const nameLink = root.querySelector('a[href="/users/1"]') as HTMLElement;
    expect(nameLink.className).toContain('flex-1');
  });

  it('shows the role/permission registry', async () => {
    const fixture = TestBed.createComponent(AdminUserList);
    fixture.detectChanges();
    httpTesting.expectOne('/api/roles').flush([
      { role: 'ADMIN', permissions: ['users:read', 'audit:read'] },
      { role: 'EDITOR', permissions: ['docs:read', 'docs:write'] },
    ]);

    httpTesting.expectOne('/api/users?page=0').flush({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('ADMIN');
    expect(root.textContent).toContain('users:read · audit:read');
    expect(root.textContent).toContain('EDITOR');
    expect(root.textContent).toContain('docs:read · docs:write');
  });

  function emptyPage() {
    return { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
  }

  it('narrows the manifest by search text, resetting to page 0', async () => {
    const fixture = TestBed.createComponent(AdminUserList);
    fixture.detectChanges();
    httpTesting.expectOne('/api/roles').flush([]);
    httpTesting.expectOne('/api/users?page=0').flush(emptyPage());
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const searchInput = root.querySelector('#crew-search') as HTMLInputElement;
    searchInput.value = 'nami';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    httpTesting.expectOne('/api/users?page=0&q=nami').flush(emptyPage());
  });

  it('narrows the manifest by role', async () => {
    const fixture = TestBed.createComponent(AdminUserList);
    fixture.detectChanges();
    httpTesting.expectOne('/api/roles').flush([
      { role: 'ADMIN', permissions: [] },
      { role: 'EDITOR', permissions: [] },
    ]);
    httpTesting.expectOne('/api/users?page=0').flush(emptyPage());
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const roleSelect = root.querySelector('#crew-role') as HTMLSelectElement;
    roleSelect.value = 'ADMIN';
    roleSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    httpTesting.expectOne('/api/users?page=0&role=ADMIN').flush(emptyPage());
  });

  it('narrows the manifest by status', async () => {
    const fixture = TestBed.createComponent(AdminUserList);
    fixture.detectChanges();
    httpTesting.expectOne('/api/roles').flush([]);
    httpTesting.expectOne('/api/users?page=0').flush(emptyPage());
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const statusSelect = root.querySelector('#crew-status') as HTMLSelectElement;
    statusSelect.value = 'DISABLED';
    statusSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    httpTesting.expectOne('/api/users?page=0&status=DISABLED').flush(emptyPage());
  });

  it('resets every filter back to the unfiltered listing', async () => {
    const fixture = TestBed.createComponent(AdminUserList);
    fixture.detectChanges();
    httpTesting.expectOne('/api/roles').flush([]);
    httpTesting.expectOne('/api/users?page=0').flush(emptyPage());
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const searchInput = root.querySelector('#crew-search') as HTMLInputElement;
    searchInput.value = 'nami';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    httpTesting.expectOne('/api/users?page=0&q=nami').flush(emptyPage());
    await fixture.whenStable();
    fixture.detectChanges();

    const resetButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Reset',
    );
    resetButton!.click();
    fixture.detectChanges();

    httpTesting.expectOne('/api/users?page=0').flush(emptyPage());
  });

  it('shows a filter-aware empty state instead of "no crew members yet" when a filter is active', async () => {
    const fixture = TestBed.createComponent(AdminUserList);
    fixture.detectChanges();
    httpTesting.expectOne('/api/roles').flush([]);
    httpTesting.expectOne('/api/users?page=0').flush(emptyPage());
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const searchInput = root.querySelector('#crew-search') as HTMLInputElement;
    searchInput.value = 'nobody';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    httpTesting.expectOne('/api/users?page=0&q=nobody').flush(emptyPage());
    await fixture.whenStable();
    fixture.detectChanges();

    expect(root.textContent).toContain('No one answers the roll call');
    expect(root.textContent).not.toContain('No crew members yet.');
  });

  it('shows an error toast message when the request fails', async () => {
    const fixture = TestBed.createComponent(AdminUserList);
    fixture.detectChanges();
    httpTesting.expectOne('/api/roles').flush([]);

    httpTesting
      .expectOne('/api/users?page=0')
      .flush('nope', { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Lost the manifest');
  });

  it('keeps the invite form hidden until "New User" is selected', async () => {
    const fixture = TestBed.createComponent(AdminUserList);
    fixture.detectChanges();
    httpTesting.expectOne('/api/roles').flush([]);

    httpTesting.expectOne('/api/users?page=0').flush({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const modal = fixture.debugElement.query(By.directive(Modal)).componentInstance as Modal;
    expect(modal.open()).toBe(false);

    const root = fixture.nativeElement as HTMLElement;
    const newUserButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'New User',
    );
    newUserButton!.click();
    fixture.detectChanges();

    expect(modal.open()).toBe(true);
  });

  it('links each row to its Step 6 role editor', async () => {
    const fixture = TestBed.createComponent(AdminUserList);
    fixture.detectChanges();
    httpTesting.expectOne('/api/roles').flush([]);

    httpTesting.expectOne('/api/users?page=0').flush({
      content: [
        {
          userId: '1',
          username: 'luffy',
          email: 'luffy@onepiece.local',
          status: 'ACTIVE',
          roles: ['ADMIN'],
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const detailLinks = Array.from(root.querySelectorAll('a')).filter(
      (link) => link.getAttribute('href') === '/users/1',
    );
    expect(detailLinks.length).toBeGreaterThan(0);
    expect(detailLinks.some((link) => link.textContent?.includes('Details'))).toBe(true);
  });

  it('shows numbered pagination buttons and lets you jump directly to a page', async () => {
    const fixture = TestBed.createComponent(AdminUserList);
    fixture.detectChanges();
    httpTesting.expectOne('/api/roles').flush([]);

    httpTesting.expectOne('/api/users?page=0').flush({
      content: [
        {
          userId: '1',
          username: 'luffy',
          email: 'luffy@onepiece.local',
          status: 'ACTIVE',
          roles: ['ADMIN'],
        },
      ],
      page: 0,
      size: 1,
      totalElements: 3,
      totalPages: 3,
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const pageButtons = Array.from(root.querySelectorAll('button')).filter((b) =>
      ['1', '2', '3'].includes(b.textContent?.trim() ?? ''),
    );
    expect(pageButtons.map((b) => b.textContent?.trim())).toEqual(['1', '2', '3']);

    const pageThreeButton = pageButtons.find((b) => b.textContent?.trim() === '3');
    pageThreeButton!.click();
    fixture.detectChanges();

    httpTesting.expectOne('/api/users?page=2').flush({
      content: [],
      page: 2,
      size: 1,
      totalElements: 3,
      totalPages: 3,
    });
  });
});

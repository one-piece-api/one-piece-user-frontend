import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoService } from '@jsverse/transloco';
import { NAV_GROUPS, isSubgroup } from '../../shared/nav/nav-items';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { ChainList } from '../entity/chain-list';
import { ENTITIES, ENTITY, entityOf } from '../entity/entities';
import { diffBodies, naturalKeyOf, namesOf, type EntityBody } from '../entity/entity-body';
import { EntityCard } from '../entity/entity-card';
import { chainSection, isNumbered, naturalKeyParts } from '../entity/entity-definition';
import { EntityEditor } from '../entity/entity-editor';
import { EntityList } from '../entity/entity-list';
import { referenceLabel } from '../entity/entity-reference';
import { BOUNTY } from './bounty.model';

const ID = '3f2a9c1b-0000-4000-8000-0000000000b1';
const NAMI = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };
const LANGUAGES = [
  { code: 'it', name: 'Italiano' },
  { code: 'en', name: 'English' },
];

@Component({ template: '' })
class Elsewhere {}

describe('the bounty definition', () => {
  it('is registered, with its route, API path and menu entry first beside the characters', () => {
    expect(ENTITIES).toContain(BOUNTY);
    expect(entityOf('BOUNTY')).toBe(BOUNTY);
    expect(BOUNTY.api).toBe(`/api${BOUNTY.route}`);
    const subgroup = NAV_GROUPS.flatMap(({ items }) => items)
      .filter(isSubgroup)
      .find(({ labelKey }) => labelKey === 'shell.nav.crewsAndCharacters');
    expect(subgroup?.items[0]).toMatchObject({ route: BOUNTY.route });
  });

  it('is known by the poster name and the amount together, and is not numbered', () => {
    expect(naturalKeyParts(BOUNTY)).toEqual(['posterName', 'amount']);
    expect(isNumbered(BOUNTY)).toBe(false);
    expect(naturalKeyOf(BOUNTY, { posterName: 'Monkey D. Luffy', amount: 3000000000 })).toBe(
      'Monkey D. Luffy 3000000000',
    );
    expect(naturalKeyOf(BOUNTY, { posterName: '', amount: null })).toBeNull();
    expect(namesOf(BOUNTY, { posterName: 'Monkey D. Luffy', translations: {} })).toEqual({});
  });

  it('calls a bounty by its poster name and amount, as the reader writes numbers', () => {
    const luffy = { id: 'b1', posterName: 'Monkey D. Luffy', amount: 3000000000 };

    expect(BOUNTY.label?.(luffy, 'it')).toBe('Monkey D. Luffy — 3.000.000.000 ฿');
    expect(referenceLabel(luffy, 'en', BOUNTY)).toBe('Monkey D. Luffy — 3,000,000,000 ฿');
    expect(referenceLabel({ id: 'b0', key: 'Luffy 30000000' }, 'en')).toBe('Luffy 30000000');
    expect(BOUNTY.label?.({ posterName: ' ' }, 'en')).toBeNull();
  });
});

describe('the comparison of two bounties', () => {
  it('compares the condition and the flag, and never the validity the backend works out', () => {
    const before: EntityBody = {
      posterName: 'Monkey D. Luffy',
      amount: 1500000000,
      condition: 'DEAD_OR_ALIVE',
      inactive: false,
      validity: 'SUPERSEDED',
      translations: {},
    };
    const after: EntityBody = {
      ...before,
      amount: 5564800000,
      condition: 'ONLY_ALIVE',
      inactive: true,
      validity: 'ACTIVE',
    };

    const changes = Object.fromEntries(
      diffBodies(BOUNTY, before, after, ['en']).map((diff) => [
        diff.field.field,
        [diff.change, diff.before, diff.after],
      ]),
    );

    expect(changes).toMatchObject({
      amount: ['MODIFIED', '1500000000', '5564800000'],
      condition: ['MODIFIED', 'DEAD_OR_ALIVE', 'ONLY_ALIVE'],
      inactive: ['MODIFIED', 'false', 'true'],
    });
    expect(changes).not.toHaveProperty('validity');
  });
});

describe('the card of a bounty', () => {
  let fixture: ComponentFixture<EntityCard>;
  let root: HTMLElement;

  const BODY: EntityBody = {
    posterName: 'Monkey D. Luffy',
    amount: 3000000000,
    condition: 'DEAD_OR_ALIVE',
    inactive: false,
    validity: 'SUPERSEDED',
    previous: { id: 'b0', posterName: 'Monkey D. Luffy', amount: 1500000000 },
    translations: { en: { description: 'After Wano.' } },
  };

  function render(body: EntityBody): void {
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [provideRouter([]), { provide: ENTITY, useValue: BOUNTY }],
    });
    fixture = TestBed.createComponent(EntityCard);
    fixture.componentRef.setInput('body', body);
    fixture.componentRef.setInput('languages', LANGUAGES);
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  }

  function text(testId: string): string | undefined {
    return root
      .querySelector(`[data-testid="${testId}"]`)
      ?.textContent?.replace(/\s+/g, ' ')
      .trim();
  }

  it('is named by poster name and amount, with the validity beside it and no key under it', () => {
    render(BODY);

    expect(text('card-name')).toBe('Monkey D. Luffy — 3,000,000,000 ฿');
    expect(text('card-validity')).toBe('Superseded');
    expect(root.textContent).not.toContain('Monkey D. Luffy 3000000000');
  });

  it('gives the condition in words, and links the previous bounty by its label', () => {
    render(BODY);

    expect(text('card-condition')).toBe('Dead or alive');
    expect(text('card-previous')).toBe('Monkey D. Luffy — 1,500,000,000 ฿');
    expect(root.querySelector('[data-testid="card-previous"]')?.getAttribute('href')).toBe(
      '/content/bounties/b0',
    );
  });

  it('leaves the withdrawn flag to the validity badge, ticked or not', () => {
    render({ ...BODY, inactive: true, validity: 'INACTIVE' });

    expect(root.querySelector('[data-testid="card-inactive"]')).toBeNull();
    expect(root.textContent).not.toContain('withdrawn');
    expect(text('card-validity')).toBe('Inactive');
  });

  it('says when there is no previous bounty, and shows no validity the backend did not send', () => {
    render({ ...BODY, previous: null, validity: undefined });

    expect(text('card-previous')).toBe('none, this is the first');
    expect(root.querySelector('[data-testid="card-validity"]')).toBeNull();
  });
});

describe('the chain of a bounty', () => {
  const LUFFY = [
    {
      id: 'b3',
      key: 'Monkey D. Luffy 3000000000',
      posterName: 'Monkey D. Luffy',
      amount: 3000000000,
    },
    {
      id: 'b2',
      key: 'Monkey D. Luffy 1500000000',
      posterName: 'Monkey D. Luffy',
      amount: 1500000000,
    },
    { id: 'b1', key: 'Monkey D. Luffy 30000000', posterName: 'Monkey D. Luffy', amount: 30000000 },
  ];

  function render(chain: unknown[], contentId: string): HTMLElement {
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [provideRouter([]), { provide: ENTITY, useValue: BOUNTY }],
    });
    const fixture = TestBed.createComponent(ChainList);
    fixture.componentRef.setInput('section', chainSection('chain'));
    fixture.componentRef.setInput('body', { chain, translations: {} });
    fixture.componentRef.setInput('contentId', contentId);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists the bounties newest first, marking the one on screen and linking the others', () => {
    const root = render(LUFFY, 'b2');

    const items = Array.from(root.querySelectorAll('[data-testid="chain-item"]'));
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'Monkey D. Luffy — 3,000,000,000 ฿',
      'Monkey D. Luffy — 1,500,000,000 ฿',
      'Monkey D. Luffy — 30,000,000 ฿',
    ]);
    expect(root.querySelector('[data-testid="chain-current"]')?.textContent?.trim()).toBe(
      'Monkey D. Luffy — 1,500,000,000 ฿',
    );
    expect(items[0].querySelector('a')?.getAttribute('href')).toBe('/content/bounties/b3');
    expect(items[1].querySelector('a')).toBeNull();
    expect(root.textContent).toContain('Bounty history');
  });

  it('is not shown for a bounty alone in its chain', () => {
    const root = render([LUFFY[0]], 'b3');

    expect(root.querySelector('[data-testid="chain-list"]')).toBeNull();
  });
});

describe('the list of bounties', () => {
  const API = '/api/content/bounties';
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  const NAMI_HOLDER = { id: 'c1', romaji: 'Nami', names: { it: 'Nami', en: 'Nami' } };

  function row(
    id: string,
    posterName: string,
    amount: number,
    validity: string,
    holder: typeof NAMI_HOLDER | null = null,
  ) {
    return {
      id,
      versionNumber: 1,
      status: 'PUBLISHED',
      author: NAMI,
      updatedAt: '2026-10-01T08:00:00Z',
      onlineVersionNumber: 1,
      body: {
        key: `${posterName} ${amount}`,
        posterName,
        amount,
        condition: 'DEAD_OR_ALIVE',
        validity,
        ...(holder ? { holder } : {}),
      },
      allowedActions: [],
      overrideActions: [],
    };
  }

  const ROWS = [
    row('b3', 'Monkey D. Luffy', 3000000000, 'ACTIVE', NAMI_HOLDER),
    row('b2', 'Monkey D. Luffy', 1500000000, 'SUPERSEDED'),
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ENTITY, useValue: BOUNTY },
        provideRouter(
          [
            { path: 'content/bounties', component: EntityList },
            { path: 'content/bounties/:id', component: Elsewhere },
          ],
          withComponentInputBinding(),
        ),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  async function settle(): Promise<void> {
    for (let round = 0; round < 2; round++) {
      await new Promise((resolve) => setTimeout(resolve));
      harness.detectChanges();
    }
  }

  function page(content: unknown[]) {
    return { content, page: 0, size: 20, totalElements: content.length, totalPages: 1 };
  }

  async function open(url: string, listQuery: string): Promise<void> {
    harness = await RouterTestingHarness.create(url);
    harness.detectChanges();
    httpTesting.expectOne('/api/me').flush({
      username: 'nami',
      email: 'nami@onepiece.local',
      roles: [],
      permissions: ['content:read'],
    });
    httpTesting
      .expectOne(`${API}/summary`)
      .flush({ total: ROWS.length, mine: 0, statuses: ['PUBLISHED'] });
    httpTesting.expectOne(`${API}/authors`).flush([]);
    httpTesting.expectOne(`${API}?${listQuery}`).flush(page(ROWS));
    await settle();
    root = harness.routeNativeElement as HTMLElement;
  }

  function cells(testId: string): string[] {
    return Array.from(root.querySelectorAll(`[data-testid="${testId}"]`)).map(
      (cell) => cell.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );
  }

  it('names each row by its poster name, with the amount and the validity in their columns', async () => {
    await open('/content/bounties', 'page=0');

    const firstRow = root.querySelector('[data-testid="content-row"]')!;
    expect(firstRow.querySelector('a span')?.textContent).toContain('Monkey D. Luffy');
    expect(firstRow.textContent).not.toContain('Monkey D. Luffy 3000000000');
    expect(cells('list-cell')).toEqual([
      '3,000,000,000 ฿',
      'Active',
      '1,500,000,000 ฿',
      'Superseded',
    ]);
    expect(root.querySelector<HTMLInputElement>('input[type="search"]')?.placeholder).toBe(
      'name or amount…',
    );
    expect(firstRow.className).toContain(
      'sm:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_',
    );
  });

  it('shows the holder of a bounty linked to its character, and a dash for one without', async () => {
    await open('/content/bounties', 'page=0');

    const holders = Array.from(root.querySelectorAll('[data-testid="relation-cell"]'));
    expect(holders.map((cell) => cell.textContent?.trim())).toEqual(['Nami', '—']);
    expect(holders[0].querySelector('a')?.getAttribute('href')).toBe('/content/characters/c1');
  });

  it('narrows to the bounties of a character, the way a character card leads there', async () => {
    await open('/content/bounties?holder=c1', 'page=0&holder=c1');

    expect(root.querySelector('[data-testid="relation-chip"]')?.textContent).toContain('Holder:');
  });

  it('narrows by validity and condition from the URL, and offers both as filters', async () => {
    await open(
      '/content/bounties?validity=ACTIVE&condition=ONLY_ALIVE',
      'page=0&validity=ACTIVE&condition=ONLY_ALIVE',
    );

    const validity = root.querySelector<HTMLSelectElement>('[data-testid="filter-validity"]')!;
    expect(validity.value).toBe('ACTIVE');
    expect(Array.from(validity.options).map((option) => option.textContent?.trim())).toEqual([
      'All',
      'Active',
      'Superseded',
      'Inactive',
    ]);
    expect(root.querySelector<HTMLSelectElement>('[data-testid="filter-condition"]')!.value).toBe(
      'ONLY_ALIVE',
    );
  });

  it('puts a chosen filter in the URL, and the reset lifts it', async () => {
    await open('/content/bounties', 'page=0');
    const router = TestBed.inject(Router);

    const validity = root.querySelector<HTMLSelectElement>('[data-testid="filter-validity"]')!;
    validity.value = 'SUPERSEDED';
    validity.dispatchEvent(new Event('change'));
    await settle();
    expect(router.url).toBe('/content/bounties?validity=SUPERSEDED');
    httpTesting.expectOne(`${API}?page=0&validity=SUPERSEDED`).flush(page(ROWS));
    await settle();

    Array.from(root.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Reset')!
      .click();
    await settle();
    expect(router.url).toBe('/content/bounties');
    httpTesting.expectOne(`${API}?page=0`).flush(page(ROWS));
    await settle();
  });

  it('sorts by amount from its column header', async () => {
    await open('/content/bounties', 'page=0');

    Array.from(root.querySelectorAll('app-sort-header button'))
      .find((button) => button.textContent?.includes('Amount'))!
      .dispatchEvent(new Event('click'));
    await settle();

    httpTesting.expectOne(`${API}?page=0&sort=amount%2Casc`).flush(page(ROWS));
    await settle();
  });
});

describe('the editor of a bounty', () => {
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ENTITY, useValue: BOUNTY },
        provideRouter(
          [
            { path: 'content/bounties/new', component: EntityEditor },
            { path: 'content/bounties/:id', component: Elsewhere },
          ],
          withComponentInputBinding(),
        ),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/content/bounties/new');
    harness.detectChanges();
    httpTesting.expectOne('/api/content/languages').flush(LANGUAGES);
    root = harness.routeNativeElement as HTMLElement;
    await settle();
  });

  afterEach(() => {
    httpTesting.verify();
  });

  async function settle(): Promise<void> {
    for (let round = 0; round < 3; round++) {
      await new Promise((resolve) => setTimeout(resolve));
      harness.detectChanges();
    }
  }

  function field<T extends HTMLElement>(key: string): T {
    return root.querySelector<T>(`#draft-${key}`)!;
  }

  async function type(key: string, text: string): Promise<void> {
    const input = field<HTMLInputElement>(key);
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  function checkLabels(): string[] {
    return Array.from(root.querySelectorAll('[data-testid="ready-check"]')).map(
      (check) => check.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );
  }

  it('asks review for the poster name, amount, condition and first appearance, not the previous', () => {
    const labels = checkLabels().join(' | ');

    expect(labels).toMatch(/Name on the poster.*Amount.*Condition.*First appearance/);
    expect(labels).not.toMatch(/Previous|valid/);
  });

  it('names the draft by poster name and amount while it is written', async () => {
    await type('posterName', 'Monkey D. Luffy');
    await type('amount', '3000000000');

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Monkey D. Luffy — 3,000,000,000 ฿');
  });

  it('offers the conditions with none chosen, and the flag unticked', () => {
    const condition = field<HTMLSelectElement>('condition');

    expect(Array.from(condition.options).map((option) => option.textContent?.trim())).toEqual([
      '— choose —',
      'Dead or alive',
      'Only alive',
    ]);
    expect(condition.value).toBe('');
    expect(field<HTMLInputElement>('inactive').checked).toBe(false);
    expect(field('validity')).toBeNull();
  });

  it('saves the amount as a number, the condition chosen and the flag as a boolean', async () => {
    await type('posterName', 'Monkey D. Luffy');
    await type('amount', '3000000000');
    const condition = field<HTMLSelectElement>('condition');
    condition.value = 'ONLY_ALIVE';
    condition.dispatchEvent(new Event('change'));
    const inactive = field<HTMLInputElement>('inactive');
    inactive.click();
    await settle();

    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    const request = httpTesting.expectOne('/api/content/bounties');
    expect(request.request.body).toMatchObject({
      posterName: 'Monkey D. Luffy',
      amount: 3000000000,
      condition: 'ONLY_ALIVE',
      inactive: true,
      previous: null,
    });
    expect(JSON.parse(JSON.stringify(request.request.body))).not.toHaveProperty('validity');
    request.flush({ id: ID, onlineVersionNumber: null, versions: [] });
    await settle();
  });

  it('switches the label of an amount with the reading language', async () => {
    await type('posterName', 'Nami');
    await type('amount', '366000000');
    TestBed.inject(TranslocoService).setActiveLang('it');
    await settle();

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Nami — 366.000.000 ฿');
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MascotService } from '../../shared/mascot/mascot';
import { polyfillDialog } from '../../testing/dialog-polyfill';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { ENTITY } from '../entity/entities';
import { EntityComparison } from '../entity/entity-comparison';
import { EntityDetail } from '../entity/entity-detail';
import { EntityEditor } from '../entity/entity-editor';
import { DEVIL_FRUIT } from './devil-fruit.model';

const ID = '3f2a9c1b-0000-4000-8000-000000000009';
const ENDPOINT = '/api/content/devil-fruits';
const SECTION = '/content/devil-fruits';
const NAMI = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };

const PARAMECIA = { id: 't1', romaji: 'Choujin-kei', names: { it: 'Paramisha', en: 'Paramecia' } };
const ZOAN = { id: 't2', romaji: 'Dobutsu-kei', names: { it: 'Zoo', en: 'Zoan' } };
const CH_1044 = { id: 'c1044', number: 1044 };
const EP_1071 = { id: 'e1071', number: 1071 };

const VERSION = {
  number: 1,
  status: 'DRAFT',
  author: NAMI,
  basedOn: null,
  claimant: null,
  everPublished: false,
  allowedActions: ['EDIT', 'DELETE', 'SUBMIT'],
  overrideActions: [],
  createdAt: '2026-10-01T08:00:00Z',
  updatedAt: '2026-10-01T08:00:00Z',
};

/** Hito Hito no Mi, Model: Nika: believed to be the Gomu Gomu no Mi until chapter 1044. */
function nika(titles: Record<string, string>) {
  return {
    romaji: 'Hito Hito no Mi, Model: Nika',
    type: ZOAN,
    translations: {
      it: { name: 'Frutto Homo Homo, modello Nika' },
      en: { name: 'Human-Human Fruit, Model: Nika' },
    },
    initialKnowledge: {
      romaji: 'Gomu Gomu no Mi',
      type: PARAMECIA,
      translations: { it: { name: 'Frutto Gom Gom' }, en: { name: 'Gum-Gum Fruit' } },
    },
    reveals: [
      {
        revealedAt: { chapter: CH_1044, episode: EP_1071 },
        titles,
        fields: ['NAME', 'ROMAJI', 'TYPE'],
      },
    ],
  };
}

@Component({ template: '' })
class Elsewhere {}

describe('the reveals of a Devil Fruit in the editor', () => {
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ENTITY, useValue: DEVIL_FRUIT },
        provideRouter(
          [
            { path: 'content/devil-fruits/:id/edit', component: EntityEditor },
            { path: 'content/devil-fruits/:id', component: Elsewhere },
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

  async function open(titles: Record<string, string>): Promise<void> {
    harness = await RouterTestingHarness.create(`${SECTION}/${ID}/edit`);
    harness.detectChanges();
    httpTesting.expectOne('/api/content/languages').flush([
      { code: 'it', name: 'Italiano' },
      { code: 'en', name: 'English' },
    ]);
    root = harness.routeNativeElement as HTMLElement;
    await settle();
    httpTesting
      .expectOne(`${ENDPOINT}/${ID}`)
      .flush({ id: ID, onlineVersionNumber: null, versions: [VERSION] });
    await settle();
    httpTesting.expectOne(`${ENDPOINT}/${ID}/versions/1`).flush({
      ...VERSION,
      blockedActions: [],
      rejectionReason: null,
      body: nika(titles),
    });
    await settle();
  }

  function byTestId(id: string): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`));
  }

  async function click(id: string, index = 0): Promise<void> {
    byTestId(id)[index].click();
    await settle();
  }

  async function save(): Promise<void> {
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
  }

  function texts(id: string): string[] {
    return byTestId(id).map((element) => element.textContent?.trim() ?? '');
  }

  const BOTH_TITLES = { it: 'Il frutto è Nika', en: 'The fruit is Nika' };

  it('splits the editor into the main fields and the reveals', async () => {
    await open(BOTH_TITLES);

    expect(byTestId('editor-section-main')[0].getAttribute('aria-pressed')).toBe('true');
    expect(byTestId('reveals-panel')).toHaveLength(0);

    await click('editor-section-reveals');

    expect(byTestId('reveals-panel')).toHaveLength(1);
    expect(byTestId('reveal-start')).toHaveLength(1);
    expect(byTestId('reveal-node')).toHaveLength(1);
    expect(texts('reveal-node')[0]).toContain('The fruit is Nika');
  });

  it('shows what the reader believed and what they learn at the reveal', async () => {
    await open(BOTH_TITLES);
    await click('editor-section-reveals');
    await click('reveal-node');

    expect(byTestId('reveal-row')).toHaveLength(3);
    const closed = texts('reveal-row-before').concat(texts('reveal-row-after'));
    expect(closed).toEqual(
      expect.arrayContaining(['Gomu Gomu no Mi', 'Hito Hito no Mi, Model: Nika']),
    );
  });

  it('saves the initial knowledge and the reveals with the main fields', async () => {
    await open(BOTH_TITLES);
    await click('editor-section-reveals');
    await click('reveal-node');
    await click('reveal-language-en');
    const title = byTestId('reveal-title')[0] as HTMLInputElement;
    title.value = 'Nika awakens';
    title.dispatchEvent(new Event('input'));
    await settle();

    await save();
    const request = httpTesting.expectOne(`${ENDPOINT}/${ID}/versions/1`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toMatchObject({
      romaji: 'Hito Hito no Mi, Model: Nika',
      type: 't2',
      initialKnowledge: {
        romaji: 'Gomu Gomu no Mi',
        type: 't1',
        translations: { it: { name: 'Frutto Gom Gom' }, en: { name: 'Gum-Gum Fruit' } },
      },
      reveals: [
        {
          revealedAt: { chapter: 'c1044', episode: 'e1071' },
          fields: ['NAME', 'ROMAJI', 'TYPE'],
          titles: { it: 'Il frutto è Nika', en: 'Nika awakens' },
        },
      ],
    });
    // The last mention reveals the current values: it sends none of its own.
    expect(request.request.body.reveals[0].romaji).toBeUndefined();
    request.flush({ number: 1 });
    await settle();
  });

  it('marks on the reveals section what the backend refused there', async () => {
    await open(BOTH_TITLES);
    await save();

    httpTesting.expectOne(`${ENDPOINT}/${ID}/versions/1`).flush(
      {
        errorCode: 'VALIDATION_FAILED',
        errors: [
          {
            field: 'reveals[0].revealedAt',
            message: 'must not share its point with an earlier reveal of NAME on the chapter axis',
          },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await settle();

    expect(texts('reveals-refused-count')).toEqual(['1']);
    expect(TestBed.inject(MascotService).message().text).toContain('Some reveals');

    await click('editor-section-reveals');
    expect(texts('reveals-summary')[0]).toContain('1 issues');
    await click('reveal-node');
    expect(texts('reveal-point-error')).toEqual([
      'Another reveal of the same field is already at this point',
    ]);
  });

  it('asks for the title of every reveal in every language before review', async () => {
    await open({ it: 'Il frutto è Nika' });

    const checks = texts('ready-check');
    expect(checks.find((check) => check.includes('Reveals · Italiano'))).toContain('complete');
    expect(checks.find((check) => check.includes('Reveals · English'))).toContain('required');
  });
});

polyfillDialog();

describe('the reveals of a Devil Fruit compared', () => {
  let fixture: ComponentFixture<EntityComparison>;
  let httpTesting: HttpTestingController;
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ENTITY, useValue: DEVIL_FRUIT },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  /** Opens v2 against v1, each with the body given. */
  async function compare(before: object, after: object): Promise<void> {
    const versions = [1, 2].map((number) => ({ ...VERSION, number, basedOn: number - 1 || null }));
    fixture = TestBed.createComponent(EntityComparison);
    fixture.componentRef.setInput('versionsUrl', `${ENDPOINT}/${ID}/versions`);
    fixture.componentRef.setInput('versions', versions);
    fixture.componentRef.setInput('onlineVersionNumber', null);
    fixture.componentRef.setInput('languages', [
      { code: 'it', name: 'Italiano' },
      { code: 'en', name: 'English' },
    ]);
    fixture.componentRef.setInput('target', 2);
    fixture.detectChanges();
    httpTesting.match('/api/me').forEach((request) => request.flush({ username: 'nami' }));
    for (const [number, body] of [
      [2, after],
      [1, before],
    ] as const) {
      httpTesting
        .expectOne(`${ENDPOINT}/${ID}/versions/${number}`)
        .flush({ ...versions[number - 1], blockedActions: [], rejectionReason: null, body });
    }
    for (let round = 0; round < 2; round++) {
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
    }
    root = fixture.nativeElement as HTMLElement;
  }

  function texts(id: string): string[] {
    return Array.from(root.querySelectorAll(`[data-testid="${id}"]`)).map(
      (element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );
  }

  const TITLES = { it: 'Il frutto è Nika', en: 'The fruit is Nika' };

  it('lists the reveals added, by position, with what they name', async () => {
    const plain = { ...nika(TITLES), initialKnowledge: undefined, reveals: [] };

    await compare(plain, nika(TITLES));

    expect(texts('comparison-reveals-count')).toEqual(['✦ 2 reveals changed']);
    expect(texts('comparison-reveal-heading')).toEqual(['Reveal 1 · The fruit is Nika']);
    expect(texts('comparison-reveal-named')[0]).toContain('Name, Romaji, Type and subcategory');
    const rows = texts('comparison-reveal-row');
    expect(rows.find((row) => row.startsWith('Initial knowledge · Romaji'))).toContain(
      'Gomu Gomu no Mi',
    );
    expect(rows.find((row) => row.startsWith('Title EN'))).toContain('The fruit is Nika');
    expect(rows.find((row) => row.startsWith('Point'))).toContain('1044');
  });

  it('shows only the title that changed on a reveal kept in place', async () => {
    await compare(nika(TITLES), nika({ ...TITLES, en: 'Nika awakens' }));

    expect(texts('comparison-reveal-heading')).toEqual(['Reveal 1 · Nika awakens']);
    expect(texts('comparison-reveal-named')).toEqual([]);
    const rows = texts('comparison-reveal-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain('The fruit is Nika');
    expect(rows[0]).toContain('Nika awakens');
    expect(texts('comparison-no-changes')).toEqual([]);
  });

  it('leaves the reveals out when they did not change', async () => {
    await compare(nika(TITLES), nika(TITLES));

    expect(texts('comparison-reveals')).toEqual([]);
    expect(texts('comparison-reveals-count')).toEqual([]);
  });
});

describe('the reveals of a Devil Fruit on its page', () => {
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ENTITY, useValue: DEVIL_FRUIT },
        provideRouter(
          [
            { path: 'content/devil-fruits/:id', component: EntityDetail },
            { path: 'content/devil-fruits/:id/edit', component: Elsewhere },
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

  async function open(): Promise<void> {
    harness = await RouterTestingHarness.create(`${SECTION}/${ID}`);
    harness.detectChanges();
    httpTesting.expectOne('/api/me').flush({
      username: 'nami',
      email: 'nami@onepiece.local',
      roles: [],
      permissions: ['content:read', 'content:write'],
    });
    httpTesting.expectOne('/api/content/languages').flush([
      { code: 'it', name: 'Italiano' },
      { code: 'en', name: 'English' },
    ]);
    root = harness.routeNativeElement as HTMLElement;
    httpTesting
      .expectOne(`${ENDPOINT}/${ID}`)
      .flush({ id: ID, onlineVersionNumber: null, versions: [VERSION] });
    await settle();
    httpTesting.expectOne(`${ENDPOINT}/${ID}/versions/1`).flush({
      ...VERSION,
      blockedActions: [],
      rejectionReason: null,
      body: nika({ it: 'Il frutto è Nika', en: 'The fruit is Nika' }),
    });
    httpTesting.expectOne(`${ENDPOINT}/${ID}/versions/1/events`).flush([]);
    await settle();
    httpTesting
      .match((request) => request.url.startsWith('/api/content/characters'))
      .forEach((request) =>
        request.flush({ content: [], page: 0, size: 12, totalElements: 0, totalPages: 0 }),
      );
    await settle();
  }

  function tab(label: string): HTMLButtonElement | undefined {
    return Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((candidate) =>
      candidate.textContent?.includes(label),
    );
  }

  it('shows the reveals read only in a tab of their own', async () => {
    await open();

    tab('Reveals')!.click();
    await settle();

    const panel = root.querySelector('[data-testid="reveals-panel"]')!;
    expect(panel.querySelectorAll('[data-testid="reveal-node"]')).toHaveLength(1);
    expect(panel.querySelector('[data-testid="add-reveal"]')).toBeNull();
    expect(panel.textContent).toContain('Read only');

    panel.querySelector<HTMLElement>('[data-testid="reveal-node"]')!.click();
    await settle();
    expect(panel.querySelector('[data-testid="reveal-title"]')).toBeNull();
    expect(panel.querySelectorAll('[data-testid="reveal-row"]')).toHaveLength(3);
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NAV_GROUPS, isSubgroup } from '../../shared/nav/nav-items';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { ENTITIES, ENTITY, entityOf } from '../entity/entities';
import { naturalKeyOf, namesOf, type EntityBody } from '../entity/entity-body';
import { EntityCard } from '../entity/entity-card';
import { isNumbered, naturalKeyParts } from '../entity/entity-definition';
import { EntityEditor } from '../entity/entity-editor';
import { EntityList } from '../entity/entity-list';
import { AFFILIATION } from './affiliation.model';

const ID = '3f2a9c1b-0000-4000-8000-0000000000a1';
const NAMI = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };
const LANGUAGES = [
  { code: 'it', name: 'Italiano' },
  { code: 'en', name: 'English' },
];
const EMBLEM = { id: 'e1', url: '/api/content/images/e1' };

@Component({ template: '' })
class Elsewhere {}

describe('the affiliation definition', () => {
  it('is registered last, with its route, API path and menu entry after the bounties', () => {
    expect(ENTITIES.at(-1)).toBe(AFFILIATION);
    expect(entityOf('AFFILIATION')).toBe(AFFILIATION);
    expect(AFFILIATION.api).toBe(`/api${AFFILIATION.route}`);
    const subgroup = NAV_GROUPS.flatMap(({ items }) => items)
      .filter(isSubgroup)
      .find(({ labelKey }) => labelKey === 'shell.nav.crewsAndCharacters');
    expect(subgroup?.items.map(({ id }) => id)).toEqual(['bounties', 'affiliations', 'characters']);
    expect(subgroup?.items[1]).toMatchObject({
      route: AFFILIATION.route,
      permission: 'content:read',
    });
    expect(subgroup?.items[1].soon).toBeUndefined();
  });

  it('is known by its romaji and named by its name, and is not numbered', () => {
    expect(naturalKeyParts(AFFILIATION)).toEqual(['romaji']);
    expect(isNumbered(AFFILIATION)).toBe(false);
    expect(naturalKeyOf(AFFILIATION, { romaji: 'Mugiwara no Ichimi' })).toBe('Mugiwara no Ichimi');
    expect(
      namesOf(AFFILIATION, {
        romaji: 'Mugiwara no Ichimi',
        translations: { en: { name: 'Straw Hat Pirates' } },
      }),
    ).toEqual({ en: 'Straw Hat Pirates' });
  });

  it('takes a square emblem with a transparent background, as the backend profile', () => {
    const image = AFFILIATION.fields.find((field) => field.kind === 'image');

    expect(image).toMatchObject({
      key: 'image',
      hint: 'content.affiliations.imageHint',
      profile: { width: 400, height: 400, minWidth: 512, minHeight: 512 },
    });
    expect(image?.kind === 'image' && image.profile.minTransparentPercent).toBe(5);
  });
});

describe('the card of an affiliation', () => {
  let fixture: ComponentFixture<EntityCard>;
  let root: HTMLElement;

  const MUGIWARA: EntityBody = {
    romaji: 'Mugiwara no Ichimi',
    translations: {
      en: { name: 'Straw Hat Pirates', description: 'The crew of Monkey D. Luffy.' },
      it: { name: 'Pirati di Cappello di Paglia', description: 'La ciurma di Monkey D. Luffy.' },
    },
  };

  function render(body: EntityBody): void {
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [provideRouter([]), { provide: ENTITY, useValue: AFFILIATION }],
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

  it('is named in the language shown, with its romaji and description', () => {
    render(MUGIWARA);

    expect(text('card-name')).toBe('Straw Hat Pirates');
    expect(root.textContent).toContain('Mugiwara no Ichimi');
    expect(text('card-description')).toBe('The crew of Monkey D. Luffy.');
  });

  it('shows the emblem, named after the affiliation', () => {
    render({ ...MUGIWARA, image: EMBLEM });

    const image = root.querySelector('app-entity-image-frame img');
    expect(image?.getAttribute('src')).toBe(EMBLEM.url);
    expect(image?.getAttribute('alt')).toBe('Straw Hat Pirates');
  });

  it('stands a placeholder in for an emblem not there', () => {
    render({ ...MUGIWARA, image: null });

    const frame = root.querySelector('app-entity-image-frame');
    expect(frame?.querySelector('img')).toBeNull();
    expect(frame?.textContent?.trim()).toBe('Image of Straw Hat Pirates');
  });
});

describe('the list of affiliations', () => {
  const API = '/api/content/affiliations';
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  const ROWS = [
    {
      id: 'a1',
      versionNumber: 1,
      status: 'PUBLISHED',
      author: NAMI,
      updatedAt: '2026-10-01T08:00:00Z',
      onlineVersionNumber: 1,
      body: {
        romaji: 'Mugiwara no Ichimi',
        names: { en: 'Straw Hat Pirates', it: 'Pirati di Cappello di Paglia' },
      },
      allowedActions: [],
      overrideActions: [],
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ENTITY, useValue: AFFILIATION },
        provideRouter(
          [
            { path: 'content/affiliations', component: EntityList },
            { path: 'content/affiliations/:id', component: Elsewhere },
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

  it('names each row by its name and romaji, with only the common columns and filters', async () => {
    harness = await RouterTestingHarness.create('/content/affiliations');
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
    httpTesting
      .expectOne(`${API}?page=0`)
      .flush({ content: ROWS, page: 0, size: 20, totalElements: 1, totalPages: 1 });
    await settle();
    root = harness.routeNativeElement as HTMLElement;

    const row = root.querySelector('[data-testid="content-row"]')!;
    expect(row.textContent).toContain('Straw Hat Pirates');
    expect(row.textContent).toContain('Mugiwara no Ichimi');
    expect(row.querySelector('a')?.getAttribute('href')).toBe('/content/affiliations/a1');
    expect(root.querySelector('[data-testid="list-cell"]')).toBeNull();
    expect(root.querySelector('[data-testid="relation-cell"]')).toBeNull();
    expect(root.querySelector('h1')?.textContent).toContain('Affiliations');
  });
});

describe('the editor of an affiliation', () => {
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ENTITY, useValue: AFFILIATION },
        provideRouter(
          [
            { path: 'content/affiliations/new', component: EntityEditor },
            { path: 'content/affiliations/:id', component: Elsewhere },
          ],
          withComponentInputBinding(),
        ),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/content/affiliations/new');
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

  function checkLabels(): string[] {
    return Array.from(root.querySelectorAll('[data-testid="ready-check"]')).map(
      (check) => check.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );
  }

  it('asks review for the romaji, the first appearance, a name and a description, not the emblem', () => {
    const labels = checkLabels().join(' | ');

    expect(labels).toMatch(/Romaji.*First appearance/);
    expect(labels).toMatch(/Name/);
    expect(labels).toMatch(/Description/);
    expect(labels).not.toMatch(/Image|Media/);
  });

  it('says above the requirements that the image is the emblem, square and transparent', () => {
    const hint = root.querySelector('#draft-image-hint');

    expect(root.querySelector('[data-testid="image-hint"]')?.textContent?.trim()).toBe(
      "The group's emblem or Jolly Roger.",
    );
    expect(hint?.textContent?.replace(/\s+/g, ' ').trim()).toMatch(
      /^The group's emblem or Jolly Roger\. .*1:1.*512 × 512/,
    );
  });

  it('saves the romaji and the translations, as JSON while no emblem is chosen', async () => {
    const romaji = root.querySelector<HTMLInputElement>('#draft-romaji')!;
    romaji.value = 'Mugiwara no Ichimi';
    romaji.dispatchEvent(new Event('input'));
    await settle();

    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    const request = httpTesting.expectOne('/api/content/affiliations');
    expect(request.request.body).toMatchObject({ romaji: 'Mugiwara no Ichimi' });
    request.flush({ id: ID, onlineVersionNumber: null, versions: [] });
    await settle();
  });
});

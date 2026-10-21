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
import { SPECIES } from './species.model';

const ID = '3f2a9c1b-0000-4000-8000-0000000000a1';
const NAMI = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };
const LANGUAGES = [
  { code: 'it', name: 'Italiano' },
  { code: 'en', name: 'English' },
];
const PICTURE = { id: 'p1', url: '/api/content/images/p1' };

@Component({ template: '' })
class Elsewhere {}

describe('the species definition', () => {
  it('is registered last, with its route, API path and menu entry after the characters', () => {
    expect(ENTITIES.at(-1)).toBe(SPECIES);
    expect(entityOf('SPECIES')).toBe(SPECIES);
    expect(SPECIES.route).toBe('/content/species');
    expect(SPECIES.api).toBe(`/api${SPECIES.route}`);
    const subgroup = NAV_GROUPS.flatMap(({ items }) => items)
      .filter(isSubgroup)
      .find(({ labelKey }) => labelKey === 'shell.nav.crewsAndCharacters');
    expect(subgroup?.items.map(({ id }) => id)).toEqual([
      'bounties',
      'affiliations',
      'characters',
      'species',
    ]);
    expect(subgroup?.items[3]).toMatchObject({
      route: SPECIES.route,
      permission: 'content:read',
    });
    expect(subgroup?.items[3].soon).toBeUndefined();
  });

  it('is known by its romaji and named by its name, and is not numbered', () => {
    expect(naturalKeyParts(SPECIES)).toEqual(['romaji']);
    expect(isNumbered(SPECIES)).toBe(false);
    expect(naturalKeyOf(SPECIES, { romaji: 'Gyojin' })).toBe('Gyojin');
    expect(
      namesOf(SPECIES, { romaji: 'Gyojin', translations: { en: { name: 'Fish-Man' } } }),
    ).toEqual({ en: 'Fish-Man' });
  });

  it('takes a 4:5 picture without asking for transparency, as the backend profile', () => {
    const image = SPECIES.fields.find((field) => field.kind === 'image');

    expect(image).toMatchObject({
      key: 'image',
      hint: 'content.species.imageHint',
      profile: { width: 320, height: 400, minWidth: 400, minHeight: 500, ratioTolerance: 0.1 },
    });
    expect(image?.kind === 'image' && image.profile.minTransparentPercent).toBe(0);
  });
});

describe('the card of a species', () => {
  let fixture: ComponentFixture<EntityCard>;
  let root: HTMLElement;

  const GYOJIN: EntityBody = {
    romaji: 'Gyojin',
    translations: {
      en: { name: 'Fish-Man', description: 'People with the traits of a fish.' },
      it: { name: 'Uomo-pesce', description: 'Persone con i tratti di un pesce.' },
    },
  };

  function render(body: EntityBody): void {
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [provideRouter([]), { provide: ENTITY, useValue: SPECIES }],
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
    render(GYOJIN);

    expect(text('card-name')).toBe('Fish-Man');
    expect(root.textContent).toContain('Gyojin');
    expect(text('card-description')).toBe('People with the traits of a fish.');
  });

  it('shows the picture, named after the species', () => {
    render({ ...GYOJIN, image: PICTURE });

    const image = root.querySelector('app-entity-image-frame img');
    expect(image?.getAttribute('src')).toBe(PICTURE.url);
    expect(image?.getAttribute('alt')).toBe('Fish-Man');
  });

  it('stands a placeholder in for a picture not there', () => {
    render({ ...GYOJIN, image: null });

    const frame = root.querySelector('app-entity-image-frame');
    expect(frame?.querySelector('img')).toBeNull();
    expect(frame?.textContent?.trim()).toBe('Image of Fish-Man');
  });
});

describe('the list of species', () => {
  const API = '/api/content/species';
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
      body: { romaji: 'Gyojin', names: { en: 'Fish-Man', it: 'Uomo-pesce' } },
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
        { provide: ENTITY, useValue: SPECIES },
        provideRouter(
          [
            { path: 'content/species', component: EntityList },
            { path: 'content/species/:id', component: Elsewhere },
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
    harness = await RouterTestingHarness.create('/content/species');
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
    expect(row.textContent).toContain('Fish-Man');
    expect(row.textContent).toContain('Gyojin');
    expect(row.querySelector('a')?.getAttribute('href')).toBe('/content/species/a1');
    expect(root.querySelector('[data-testid="list-cell"]')).toBeNull();
    expect(root.querySelector('[data-testid="relation-cell"]')).toBeNull();
    expect(root.querySelector('h1')?.textContent).toContain('Species');
  });
});

describe('the editor of a species', () => {
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ENTITY, useValue: SPECIES },
        provideRouter(
          [
            { path: 'content/species/new', component: EntityEditor },
            { path: 'content/species/:id', component: Elsewhere },
          ],
          withComponentInputBinding(),
        ),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/content/species/new');
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

  it('asks review for the romaji, the first appearance, a name and a description, not the picture', () => {
    const labels = checkLabels().join(' | ');

    expect(labels).toMatch(/Romaji.*First appearance/);
    expect(labels).toMatch(/Name/);
    expect(labels).toMatch(/Description/);
    expect(labels).not.toMatch(/Image|Media/);
  });

  it('says above the requirements that the image is a typical member, 4:5, with no transparency', () => {
    const hint = root.querySelector('#draft-image-hint')?.textContent?.replace(/\s+/g, ' ').trim();

    expect(root.querySelector('[data-testid="image-hint"]')?.textContent?.trim()).toBe(
      'A typical member of the species, in portrait format.',
    );
    expect(hint).toMatch(/^A typical member of the species, in portrait format\. .*4:5.*400 × 500/);
    expect(hint).not.toMatch(/transparen/i);
  });

  it('saves the romaji and the translations, as JSON while no picture is chosen', async () => {
    const romaji = root.querySelector<HTMLInputElement>('#draft-romaji')!;
    romaji.value = 'Tonakai';
    romaji.dispatchEvent(new Event('input'));
    await settle();

    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    const request = httpTesting.expectOne('/api/content/species');
    expect(request.request.body).toMatchObject({ romaji: 'Tonakai' });
    request.flush({ id: ID, onlineVersionNumber: null, versions: [] });
    await settle();
  });
});

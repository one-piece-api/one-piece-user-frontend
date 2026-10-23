import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoService } from '@jsverse/transloco';
import { MascotService } from '../../shared/mascot/mascot';
import { NAV_GROUPS, isSubgroup } from '../../shared/nav/nav-items';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { blockWords } from '../block-words';
import { ENTITIES, ENTITY, entityOf } from '../entity/entities';
import { naturalKeyOf, type EntityBody } from '../entity/entity-body';
import { EntityCard } from '../entity/entity-card';
import { naturalKeyParts } from '../entity/entity-definition';
import { EntityEditor } from '../entity/entity-editor';
import { EntityList } from '../entity/entity-list';
import { RelationPicker } from '../entity/relation-picker';
import { SPECIES } from '../species/species.model';
import { refusedFieldWords } from '../version-actions';
import { CHARACTER } from './character.model';

const ID = '3f2a9c1b-0000-4000-8000-0000000000c1';
const NAMI_USER = { id: 'u1', username: 'nami', email: 'nami@onepiece.local' };
const LANGUAGES = [
  { code: 'it', name: 'Italiano' },
  { code: 'en', name: 'English' },
];
const NAVY = { id: 'a1', romaji: 'Kaigun', names: { en: 'Navy' }, kind: 'NAVY' };
const CREW = { id: 'a2', romaji: 'Mugiwara', names: { en: 'Straw Hats' }, kind: 'PIRATE_CREW' };
const MERA = { id: 'f1', romaji: 'Mera Mera no Mi', names: { en: 'Flame-Flame' } };
const HUMAN = { id: 's1', romaji: 'Ningen', names: { it: 'Umano', en: 'Human' } };

@Component({ template: '' })
class Elsewhere {}

describe('the character definition', () => {
  it('is registered, with its route, API path and menu entry between affiliations and species', () => {
    expect(ENTITIES).toContain(CHARACTER);
    expect(entityOf('CHARACTER')).toBe(CHARACTER);
    expect(CHARACTER.api).toBe(`/api${CHARACTER.route}`);
    const subgroup = NAV_GROUPS.flatMap(({ items }) => items)
      .filter(isSubgroup)
      .find(({ labelKey }) => labelKey === 'shell.nav.crewsAndCharacters');
    expect(subgroup?.items.map(({ id }) => id)).toEqual([
      'bounties',
      'affiliations',
      'characters',
      'species',
    ]);
    expect(subgroup?.items[2]).toMatchObject({
      route: '/content/characters',
      label: 'content.characters.title',
      permission: 'content:read',
    });
    expect(subgroup?.items[2].soon).toBeUndefined();
  });

  it('is known by its romaji, its fields in the order of the plan', () => {
    expect(naturalKeyParts(CHARACTER)).toEqual(['romaji']);
    expect(naturalKeyOf(CHARACTER, { romaji: 'Monkey D. Luffy' })).toBe('Monkey D. Luffy');
    expect(CHARACTER.fields.map(({ key, kind }) => `${key}:${kind}`)).toEqual([
      'romaji:text',
      'japaneseName:text',
      'image:image',
      'status:choice',
      'gender:choice',
      'birthday:monthDay',
      'species:partList',
      'affiliations:partList',
      'devilFruits:partList',
      'firstAppearance:storyPoint',
      'name:localizedText',
      'epithets:partList',
      'aliases:partList',
      'description:localizedText',
    ]);
  });

  it('takes a 4:5 portrait without asking for transparency, as the backend profile', () => {
    expect(CHARACTER.fields.find((field) => field.kind === 'image')).toMatchObject({
      hint: 'content.characters.imageHint',
      profile: {
        width: 320,
        height: 400,
        minWidth: 400,
        minHeight: 500,
        minTransparentPercent: 0,
      },
    });
  });

  it('is listed on the card of a species, by the filter its list has for it', () => {
    expect(SPECIES.sections).toEqual([{ kind: 'relatedList', of: 'CHARACTER', by: 'species' }]);
  });

  it('lists the memberships as a list of parts, a rank only in the Navy, filtered by the affiliation', () => {
    const memberships = CHARACTER.fields.find((field) => field.key === 'affiliations');

    expect(memberships).toMatchObject({
      kind: 'partList',
      unique: 'affiliation',
      filterBy: { key: 'affiliation', part: 'affiliation' },
    });
    const parts = memberships?.kind === 'partList' ? memberships.parts : [];
    expect(parts.map(({ key }) => key)).toEqual(['affiliation', 'role', 'marineRank', 'former']);
    expect(parts[2]).toMatchObject({
      options: expect.arrayContaining(['FLEET_ADMIRAL', 'CHORE_BOY']),
      visibleWhen: { part: 'affiliation', field: 'kind', equals: 'NAVY' },
    });
    expect(parts[2].kind === 'choice' && parts[2].options).toHaveLength(19);
  });

  it('lists the Devil Fruits as a list of parts, each once, filtered by the fruit', () => {
    const fruits = CHARACTER.fields.find((field) => field.key === 'devilFruits');

    expect(fruits).toMatchObject({
      kind: 'partList',
      unique: 'devilFruit',
      filterBy: { key: 'devilFruit', part: 'devilFruit' },
    });
    const parts = fruits?.kind === 'partList' ? fruits.parts : [];
    expect(parts.map(({ key, kind }) => `${key}:${kind}`)).toEqual([
      'devilFruit:relation',
      'former:boolean',
    ]);
    expect(parts[0]).toMatchObject({ target: 'DEVIL_FRUIT' });
  });

  it('counts and lists the bounties naming it as holder, by the filter their list has for it', () => {
    expect(CHARACTER.counts).toEqual([{ field: 'bountyCount', of: 'BOUNTY', by: 'holder' }]);
    expect(CHARACTER.sections).toEqual([{ kind: 'relatedList', of: 'BOUNTY', by: 'holder' }]);
  });
});

describe('the words about characters', () => {
  it('name the character whose rank the affiliation no longer allows, and link the affiliation', () => {
    const words = blockWords(transloco, {
      reason: 'MARINE_RANK_NOT_ALLOWED',
      detail: { affiliationsIndex: 0, affiliationId: 'a1', affiliationRomaji: 'Kaigun' },
    });

    expect(words.note).toBe('Rank outside the Navy');
    expect(words.links).toEqual([{ label: 'Kaigun', route: '/content/affiliations/a1' }]);
  });

  it('name the ranked characters that keep an affiliation from leaving the Navy, and link them', () => {
    const words = blockWords(transloco, {
      reason: 'MARINE_RANK_IN_USE',
      detail: { count: 2, characters: [{ id: 'c1', romaji: 'Koby' }] },
    });

    expect(words.note).toBe('Ranks held: 2');
    expect(words.links).toEqual([{ label: 'Koby', route: '/content/characters/c1' }]);
    expect(words.more).toBe(1);
  });

  let transloco: TranslocoService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [provideTranslocoTesting()] });
    transloco = TestBed.inject(TranslocoService);
  });

  it('name the fruit a character cannot have as its current one, and the characters already using it', () => {
    const words = blockWords(transloco, {
      reason: 'DEVIL_FRUIT_IN_USE',
      detail: {
        devilFruitsIndex: 0,
        devilFruitId: 'f1',
        devilFruitRomaji: 'Mera Mera no Mi',
        characters: [{ id: 'c1', romaji: 'Portgas D. Ace' }],
      },
    });

    expect(words.note).toBe('Fruit already in use');
    expect(words.sentence).toContain('Mera Mera no Mi');
    expect(words.links).toEqual([{ label: 'Portgas D. Ace', route: '/content/characters/c1' }]);
    expect(words.more).toBe(0);
  });

  it('name the characters that keep a fruit from going online with one user at a time, and link them', () => {
    const words = blockWords(transloco, {
      reason: 'DEVIL_FRUIT_IN_USE',
      detail: { count: 3, characters: [{ id: 'c1', romaji: 'Caesar Clown' }] },
    });

    expect(words.note).toBe('Current users: 3');
    expect(words.links).toEqual([{ label: 'Caesar Clown', route: '/content/characters/c1' }]);
    expect(words.more).toBe(2);
  });

  it('name the online characters that keep a species from being retired, and link them', () => {
    const words = blockWords(transloco, {
      reason: 'ONLINE_ITEMS_LINKED',
      detail: { count: 1, characters: [{ id: 'c1', romaji: 'Nami' }] },
    });

    expect(words.note).toBe('Characters online: 1');
    expect(words.sentence).toContain('Online characters are still linked');
    expect(words.links).toEqual([{ label: 'Nami', route: '/content/characters/c1' }]);
  });

  it('name the online bounties that keep a character from being retired, and link them', () => {
    const words = blockWords(transloco, {
      reason: 'ONLINE_ITEMS_LINKED',
      detail: { count: 1, bounties: [{ id: 'b1', key: 'Nami 366000000' }] },
    });

    expect(words.note).toBe('Bounties online: 1');
    expect(words.links).toEqual([{ label: 'Nami 366000000', route: '/content/bounties/b1' }]);
  });

  it('name a holder that is not online as what keeps a bounty from going online', () => {
    const words = blockWords(transloco, {
      reason: 'RELATED_NOT_ONLINE',
      detail: { holderId: 'c1', holderRomaji: 'Nami' },
    });

    expect(words.note).toBe('Holder not online');
    expect(words.sentence).toContain('Publish the character first');
  });

  it('name an entry of a list review still lacks, by position and language', () => {
    const words = (field: string) => refusedFieldWords(transloco, CHARACTER, field);

    expect(words('epithets[1].text[en]')).toBe('epithet 2 EN');
    expect(words('aliases[0]')).toBe('alias 1');
    expect(words('devilFruits[0].devilFruit')).toBe('fruit 1');
    expect(words('epithets')).toBe('epithets');
    expect(words('translations[it].name')).toBe('name IT');
    expect(words('status')).toBe('status');
  });
});

describe('the card of a character', () => {
  let fixture: ComponentFixture<EntityCard>;
  let root: HTMLElement;

  const NAMI: EntityBody = {
    romaji: 'Nami',
    japaneseName: 'ナミ',
    status: 'ALIVE',
    gender: 'FEMALE',
    birthday: '--07-03',
    species: [HUMAN],
    epithets: [{ text: { it: 'Gatta ladra', en: 'Cat Burglar' } }],
    aliases: ['Miss All Sunday'],
    translations: {
      en: { name: 'Nami', description: 'The navigator of the Straw Hats.' },
      it: { name: 'Nami', description: 'La navigatrice della ciurma di Cappello di paglia.' },
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [provideRouter([]), { provide: ENTITY, useValue: CHARACTER }],
    });
    fixture = TestBed.createComponent(EntityCard);
    fixture.componentRef.setInput('body', NAMI);
    fixture.componentRef.setInput('languages', LANGUAGES);
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  });

  function text(testId: string): string | undefined {
    return root
      .querySelector(`[data-testid="${testId}"]`)
      ?.textContent?.replace(/\s+/g, ' ')
      .trim();
  }

  it('shows its facts in words: status, gender, birthday and the Japanese name in Japanese', () => {
    expect(text('card-status')).toBe('Alive');
    expect(text('card-gender')).toBe('Female');
    expect(text('card-birthday')).toBe('July 3');
    expect(text('card-japaneseName')).toBe('ナミ');
    expect(root.querySelector('[data-testid="card-japaneseName"]')?.getAttribute('lang')).toBe(
      'ja',
    );
  });

  it('marks a past membership as a former member, not as a former user', () => {
    fixture.componentRef.setInput('body', {
      ...NAMI,
      affiliations: [{ affiliation: CREW, former: true }],
    });
    fixture.detectChanges();

    expect(text('card-affiliations')).toContain('Former member');
    expect(text('card-affiliations')).not.toContain('Former user');
  });

  it('lists its Devil Fruits linked, a past one marked as a former user', () => {
    fixture.componentRef.setInput('body', {
      ...NAMI,
      devilFruits: [{ devilFruit: MERA, former: true }],
    });
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="card-devilFruits"] a')?.getAttribute('href')).toBe(
      '/content/devil-fruits/f1',
    );
    expect(text('card-devilFruits')).toContain('Flame-Flame');
    expect(text('card-devilFruits')).toContain('Former user');
  });

  it('lists its species linked, its epithets in the language shown and its aliases', () => {
    expect(root.querySelector('[data-testid="card-species"] a')?.getAttribute('href')).toBe(
      '/content/species/s1',
    );
    expect(text('card-species')).toContain('Human');
    expect(text('card-epithets')).toContain('Cat Burglar');
    expect(text('card-aliases')).toContain('Miss All Sunday');
  });
});

describe('the list of characters', () => {
  const API = '/api/content/characters';
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  const ROWS = [
    {
      id: 'c1',
      versionNumber: 1,
      status: 'PUBLISHED',
      author: NAMI_USER,
      updatedAt: '2026-10-01T08:00:00Z',
      onlineVersionNumber: 1,
      body: { romaji: 'Nami', names: { en: 'Nami', it: 'Nami' }, bountyCount: 2 },
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
        { provide: ENTITY, useValue: CHARACTER },
        provideRouter(
          [
            { path: 'content/characters', component: EntityList },
            { path: 'content/characters/:id', component: Elsewhere },
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

  async function open(url: string, query: string): Promise<void> {
    harness = await RouterTestingHarness.create(url);
    harness.detectChanges();
    httpTesting.expectOne('/api/me').flush({
      username: 'nami',
      email: 'nami@onepiece.local',
      roles: [],
      permissions: ['content:read'],
    });
    httpTesting.expectOne(`${API}/summary`).flush({ total: 1, mine: 0, statuses: ['PUBLISHED'] });
    httpTesting.expectOne(`${API}/authors`).flush([]);
    httpTesting
      .expectOne(`${API}?${query}`)
      .flush({ content: ROWS, page: 0, size: 20, totalElements: 1, totalPages: 1 });
    await settle();
    root = harness.routeNativeElement as HTMLElement;
  }

  it('names each row by its name and romaji, without a column for the status', async () => {
    await open('/content/characters', 'page=0');

    const row = root.querySelector('[data-testid="content-row"]')!;
    expect(row.textContent).toContain('Nami');
    expect(row.querySelector('a')?.getAttribute('href')).toBe('/content/characters/c1');
    expect(root.querySelector('[data-testid="list-cell"]')).toBeNull();
    expect(root.querySelector('[data-testid="relation-cell"]')).toBeNull();
  });

  it('counts the bounties of a character, leading to their list filtered by it', async () => {
    await open('/content/characters', 'page=0');

    const count = root.querySelector('[data-testid="count-cell"]')!;
    expect(count.textContent?.replace(/\s+/g, ' ')).toContain('2');
    expect(count.querySelector('a')?.getAttribute('href')).toBe('/content/bounties?holder=c1');
  });

  it('filters by whether the character is alive, worded as the status field', async () => {
    await open('/content/characters?characterStatus=DECEASED', 'page=0&characterStatus=DECEASED');

    const filter = root.querySelector<HTMLSelectElement>('[data-testid="filter-characterStatus"]')!;
    expect(filter.closest('label')?.textContent).toContain('Alive or dead');
    expect(Array.from(filter.options).map((option) => option.textContent?.trim())).toEqual([
      expect.any(String),
      'Alive',
      'Deceased',
      'Unknown',
    ]);
    expect(filter.value).toBe('DECEASED');
  });

  it('narrows to the members of an affiliation, the way its member count leads there', async () => {
    await open('/content/characters?affiliation=a1', 'page=0&affiliation=a1');

    expect(root.querySelector('[data-testid="relation-chip"]')?.textContent).toContain(
      'Affiliation:',
    );
  });

  it('filters by the kind of group the character belongs to', async () => {
    await open('/content/characters?affiliationKind=NAVY', 'page=0&affiliationKind=NAVY');

    const filter = root.querySelector<HTMLSelectElement>('[data-testid="filter-affiliationKind"]')!;
    expect(filter.closest('label')?.textContent).toContain('Kind of group');
    expect(filter.options).toHaveLength(6);
    expect(filter.value).toBe('NAVY');
  });

  it('narrows to the users of a Devil Fruit, the way the fruit card leads there', async () => {
    await open('/content/characters?devilFruit=f1', 'page=0&devilFruit=f1');

    expect(root.querySelector('[data-testid="relation-chip"]')?.textContent).toContain(
      'Devil Fruit:',
    );
  });

  it('narrows to the characters of a species, the way a species card leads there', async () => {
    await open('/content/characters?species=s1', 'page=0&species=s1');

    expect(root.querySelector('[data-testid="relation-chip"]')?.textContent).toContain('Species:');
  });
});

describe('the editor of a character', () => {
  const API = '/api/content/characters';
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ENTITY, useValue: CHARACTER },
        provideRouter(
          [
            { path: 'content/characters/new', component: EntityEditor },
            { path: 'content/characters/:id', component: Elsewhere },
          ],
          withComponentInputBinding(),
        ),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create('/content/characters/new');
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

  async function click(testId: string, index = 0): Promise<void> {
    root.querySelectorAll<HTMLButtonElement>(`[data-testid="${testId}"]`)[index].click();
    await settle();
  }

  async function write(id: string, text: string): Promise<void> {
    const input = root.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  async function choose(id: string, value: string): Promise<void> {
    const select = root.querySelector<HTMLSelectElement>(`#${id}`)!;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await settle();
  }

  /** Picks a species in the first entry of the list, as the search would. */
  async function pickSpecies(): Promise<void> {
    const picker = harness
      .routeDebugElement!.query(By.css('[data-testid="draft-species"]'))
      .query(By.directive(RelationPicker));
    (picker.componentInstance as RelationPicker).picked.emit(HUMAN);
    await settle();
  }

  /** Picks an affiliation in the first entry of the memberships, as the search would. */
  async function pickAffiliation(reference: typeof NAVY): Promise<void> {
    const picker = harness
      .routeDebugElement!.query(By.css('[data-testid="draft-affiliations"]'))
      .query(By.directive(RelationPicker));
    (picker.componentInstance as RelationPicker).picked.emit(reference);
    await settle();
  }

  /** Picks a fruit in the first entry of the Devil Fruits, as the search would. */
  async function pickFruit(reference: typeof MERA): Promise<void> {
    const picker = harness
      .routeDebugElement!.query(By.css('[data-testid="draft-devilFruits"]'))
      .query(By.directive(RelationPicker));
    (picker.componentInstance as RelationPicker).picked.emit(reference);
    await settle();
  }

  async function save(): Promise<void> {
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
  }

  function fieldErrors(): string[] {
    return Array.from(root.querySelectorAll('[data-testid="field-error"]')).map(
      (error) => error.textContent?.trim() ?? '',
    );
  }

  it('asks review for the romaji, status, gender, first appearance, name and description', () => {
    const labels = checkLabels().join(' | ');

    expect(labels).toMatch(/Romaji.*Status.*Gender.*First appearance/);
    expect(labels).toMatch(/Name/);
    expect(labels).toMatch(/Description/);
    expect(labels).not.toMatch(/Birthday|Species|Alias|Epithet|Japanese/);
  });

  it('asks review for an epithet written, in every language, not for one left empty', async () => {
    await click('part-add', 3);
    expect(checkLabels().join(' | ')).not.toContain('Epithet');

    await write('draft-epithets-0-text-it', 'Gatta ladra');
    const labels = checkLabels();
    expect(labels).toContain('✓Epithet 1 · Italianocomplete');
    expect(labels).toContain('!Epithet 1 · Englishrequired');
  });

  it('saves every value as the API reads it, an entry left empty dropped', async () => {
    await write('draft-romaji', 'Nami');
    await choose('draft-status', 'ALIVE');
    await choose('draft-gender', 'FEMALE');
    await choose('draft-birthday-month', '7');
    await choose('draft-birthday', '3');
    await click('part-add', 0);
    await pickSpecies();
    await click('part-add', 3);
    await write('draft-epithets-0-text-en', ' Cat Burglar ');
    await click('part-add', 4);
    await click('part-add', 4);
    await write('draft-aliases-1-alias', 'Miss Nami');

    await save();
    const request = httpTesting.expectOne(API);
    expect(request.request.body).toMatchObject({
      romaji: 'Nami',
      status: 'ALIVE',
      gender: 'FEMALE',
      birthday: '--07-03',
      species: ['s1'],
      epithets: [{ text: { en: 'Cat Burglar' } }],
      aliases: ['Miss Nami'],
    });
    request.flush({ id: ID, onlineVersionNumber: null, versions: [] });
    await settle();
  });

  it('offers a rank only for a Navy affiliation, and saves the membership with it', async () => {
    await write('draft-romaji', 'Koby');
    await click('part-add', 1);
    expect(root.querySelector('#draft-affiliations-0-marineRank')).toBeNull();

    await pickAffiliation(CREW);
    expect(root.querySelector('#draft-affiliations-0-marineRank')).toBeNull();

    await pickAffiliation(NAVY);
    await choose('draft-affiliations-0-marineRank', 'VICE_ADMIRAL');
    await write('draft-affiliations-0-role-en', ' Hero ');

    await save();
    const request = httpTesting.expectOne(API);
    expect(request.request.body).toMatchObject({
      affiliations: [
        { affiliation: 'a1', role: { en: 'Hero' }, marineRank: 'VICE_ADMIRAL', former: false },
      ],
    });
    request.flush({ id: ID, onlineVersionNumber: null, versions: [] });
    await settle();
  });

  it('saves a Devil Fruit with whether its user is a former one', async () => {
    await write('draft-romaji', 'Portgas D. Ace');
    await click('part-add', 2);
    await pickFruit(MERA);
    root.querySelector<HTMLInputElement>('#draft-devilFruits-0-former')!.click();
    await settle();

    await save();
    const request = httpTesting.expectOne(API);
    expect(request.request.body).toMatchObject({
      devilFruits: [{ devilFruit: 'f1', former: true }],
    });
    request.flush({ id: ID, onlineVersionNumber: null, versions: [] });
    await settle();
  });

  it('says under the rank that the Navy alone has them, when the backend refuses it', async () => {
    await write('draft-romaji', 'Koby');
    await click('part-add', 1);
    await pickAffiliation(NAVY);
    await choose('draft-affiliations-0-marineRank', 'ADMIRAL');

    await save();
    httpTesting.expectOne(API).flush(
      {
        errorCode: 'CONTENT_VALUE_INVALID',
        errors: [
          { field: 'affiliations[0].marineRank', message: 'is allowed only in a Navy affiliation' },
        ],
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await settle();

    expect(fieldErrors()).toContain(
      'is not allowed with this affiliation: only the Navy has ranks',
    );
  });

  it('shows a refused entry under the entry of the draft, past the empty ones not sent', async () => {
    await write('draft-romaji', 'Usopp');
    await click('part-add', 4);
    await write('draft-aliases-0-alias', 'Sogeking');
    await click('part-add', 4);
    await click('part-add', 4);
    await write('draft-aliases-2-alias', 'sogeking');

    await save();
    httpTesting.expectOne(API).flush(
      {
        errorCode: 'CONTENT_VALUE_INVALID',
        errors: [{ field: 'aliases[1]', message: 'is repeated in this list' }],
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await settle();

    const entries = root.querySelectorAll(
      '[data-testid="draft-aliases"] [data-testid="part-entry"]',
    );
    expect(fieldErrors()).toEqual(['already in this list']);
    expect(entries[2].textContent).toContain('already in this list');
    expect(TestBed.inject(MascotService).message().text).toContain('Some entry of a list');
  });

  it('says a species refused can no longer be chosen', async () => {
    await write('draft-romaji', 'Jinbe');
    await click('part-add', 0);
    await pickSpecies();

    await save();
    httpTesting.expectOne(API).flush(
      {
        errorCode: 'CONTENT_VALUE_INVALID',
        errors: [{ field: 'species[0]', message: 'is not a linkable species' }],
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await settle();

    expect(fieldErrors()).toEqual([
      'can no longer be chosen: it needs a content already approved in review',
    ]);
  });
});

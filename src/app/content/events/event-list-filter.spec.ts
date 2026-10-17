import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslocoTesting } from '../../testing/i18n-testing';
import { ENTITY } from '../entity/entities';
import { EntityList } from '../entity/entity-list';
import { EVENT } from './event.model';

const EVENTS = '/api/content/events';
const FRUITS = '/api/content/devil-fruits';
const FRUIT_ID = 'f1';

@Component({ template: '' })
class Elsewhere {}

const page = (content: unknown[]) => ({
  content,
  page: 0,
  size: 20,
  totalElements: content.length,
  totalPages: 1,
});

describe('the list of events narrowed to a fruit', () => {
  let httpTesting: HttpTestingController;
  let harness: RouterTestingHarness;
  let root: HTMLElement;

  async function settle(): Promise<void> {
    for (let round = 0; round < 2; round++) {
      await new Promise((resolve) => setTimeout(resolve));
      harness.detectChanges();
    }
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [provideTranslocoTesting()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ENTITY, useValue: EVENT },
        provideRouter(
          [
            { path: 'content/events', component: EntityList },
            { path: 'content/events/:id', component: Elsewhere },
          ],
          withComponentInputBinding(),
        ),
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create(`/content/events?devilFruit=${FRUIT_ID}`);
    harness.detectChanges();
    httpTesting.expectOne('/api/me').flush({
      username: 'nami',
      email: 'nami@onepiece.local',
      roles: [],
      permissions: ['content:read'],
    });
    httpTesting
      .expectOne(`${EVENTS}/summary`)
      .flush({ total: 1, mine: 0, statuses: ['PUBLISHED'] });
    httpTesting.expectOne(`${EVENTS}/authors`).flush([]);
  });

  afterEach(() => httpTesting.verify());

  it('asks the backend for the events of the fruit, under a chip naming it', async () => {
    const list = httpTesting.expectOne(
      (request) => request.url.startsWith(EVENTS) && request.url.includes(`devilFruit=${FRUIT_ID}`),
    );
    list.flush(page([]));
    httpTesting
      .expectOne(`${FRUITS}/${FRUIT_ID}`)
      .flush({ id: FRUIT_ID, onlineVersionNumber: 2, versions: [{ number: 1 }, { number: 2 }] });
    await settle();
    httpTesting.expectOne(`${FRUITS}/${FRUIT_ID}/versions/2`).flush({
      number: 2,
      body: { romaji: 'Gomu Gomu no Mi', translations: { en: { name: 'Gum-Gum Fruit' } } },
    });
    await settle();
    root = harness.routeNativeElement as HTMLElement;

    const chip = root.querySelector('[data-testid="relation-chip"]');
    expect(chip?.textContent?.replace('✕', '').trim()).toBe('Participant: Gum-Gum Fruit');

    chip!.querySelector('button')!.click();
    await settle();
    httpTesting
      .expectOne((request) => request.url.startsWith(EVENTS) && !request.url.includes('devilFruit'))
      .flush(page([]));
    await settle();

    expect(root.querySelector('[data-testid="relation-chip"]')).toBeNull();
  });
});

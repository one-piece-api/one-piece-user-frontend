import { NAV_GROUPS } from '../../shared/nav/nav-items';
import { ENTITIES, entityOf } from '../entity/entities';
import { diffBodies, draftFieldKey, draftOf, readinessChecks, toBody } from '../entity/entity-body';
import { DEVIL_FRUIT } from './devil-fruit.model';

const LOGIA = { id: 't1', romaji: 'Shizen-kei', names: { it: 'Rogia', en: 'Logia' } };
const ZOAN = { id: 't2', romaji: 'Dobutsu-kei', names: { it: 'Zoo', en: 'Zoan' } };

const GOMU = {
  romaji: 'Gomu Gomu no Mi',
  type: LOGIA,
  translations: {
    it: { name: 'Frutto Gomu', description: 'd', advantages: 'p', disadvantages: 'c' },
  },
};

describe('the Devil Fruit entity', () => {
  it('has a romaji, an image, the type it belongs to, and the four texts of a language', () => {
    expect(DEVIL_FRUIT.fields.map(({ key, kind }) => `${key}:${kind}`)).toEqual([
      'romaji:text',
      'image:image',
      'type:relation',
      'name:localizedText',
      'description:localizedText',
      'advantages:localizedText',
      'disadvantages:localizedText',
    ]);
  });

  it('points to the Devil Fruit Type, which it is told apart from by name only', () => {
    const type = DEVIL_FRUIT.fields.find(({ key }) => key === 'type');

    expect(type).toMatchObject({ kind: 'relation', target: 'DEVIL_FRUIT_TYPE' });
    expect(entityOf('DEVIL_FRUIT_TYPE')).not.toBeNull();
  });

  it('is switched on in the registry, with its own section and API', () => {
    expect(ENTITIES).toContain(DEVIL_FRUIT);
    expect(entityOf('DEVIL_FRUIT')).toBe(DEVIL_FRUIT);
    expect(DEVIL_FRUIT.route).toBe('/content/devil-fruits');
    expect(DEVIL_FRUIT.api).toBe('/api/content/devil-fruits');
  });

  it('has a live entry in the menu, no longer an announced one', () => {
    const items = NAV_GROUPS.flatMap((group) => group.items);
    const entry = items.find(({ id }) => id === 'devil-fruits');

    expect(entry).toMatchObject({
      route: '/content/devil-fruits',
      label: 'content.devilFruits.title',
      permission: 'content:read',
    });
    expect(entry?.soon).toBeUndefined();
  });

  it('is saved with the id of its type, not the type', () => {
    const draft = draftOf(DEVIL_FRUIT, GOMU, ['it']);

    expect(draft['type']).toBe(LOGIA);
    expect(toBody(DEVIL_FRUIT, draft)['type']).toBe('t1');
  });

  it('is saved without a type when none was chosen, and asks for it before review', () => {
    const draft = draftOf(DEVIL_FRUIT, { ...GOMU, type: null }, ['it']);

    expect(toBody(DEVIL_FRUIT, draft)['type']).toBeNull();
    const type = readinessChecks(DEVIL_FRUIT, draft, ['it']).find(({ field }) => field === 'type');
    expect(type).toEqual({ field: 'type', language: null, done: false });
  });

  it('addresses a refusal of the backend on the type by its key', () => {
    expect(draftFieldKey(DEVIL_FRUIT, 'type')).toBe('type');
  });

  it('compares a change of type by the types, named by their romaji', () => {
    const moved = { ...GOMU, type: ZOAN };

    const diff = diffBodies(DEVIL_FRUIT, GOMU as never, moved as never, ['it']).find(
      ({ field }) => field.field === 'type',
    );

    expect(diff).toMatchObject({ change: 'MODIFIED', before: 'Shizen-kei', after: 'Dobutsu-kei' });
  });
});

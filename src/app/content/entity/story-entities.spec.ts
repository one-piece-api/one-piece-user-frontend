import { NAV_GROUPS } from '../../shared/nav/nav-items';
import { ARC } from '../arcs/arc.model';
import { CHAPTER } from '../chapters/chapter.model';
import { EPISODE } from '../episodes/episode.model';
import { SAGA } from '../sagas/saga.model';
import { VOLUME } from '../volumes/volume.model';
import { ENTITIES, entityOf } from './entities';
import { draftOf, readinessChecks } from './entity-body';
import type { EntityDefinition } from './entity-definition';
import { isAskedByReview } from './field-kinds';

describe('the story entities', () => {
  const story = [SAGA, ARC, VOLUME, CHAPTER, EPISODE];

  it('are registered after the Devil Fruit ones, in story order', () => {
    expect(ENTITIES.slice(2)).toEqual(story);
    expect(entityOf('EPISODE')).toBe(EPISODE);
  });

  it('are numbered, named by their title and found at their own route', () => {
    for (const entity of story) {
      expect(entity.naturalKey).toBe('number');
      expect(entity.labelField).toBe('title');
      expect(entity.api).toBe(`/api${entity.route}`);
    }
  });

  it('have their own menu group, in order', () => {
    const group = NAV_GROUPS.find(({ labelKey }) => labelKey === 'shell.nav.story');

    expect(group?.countsLiveItems).toBe(true);
    expect(group?.items.map(({ route }) => route)).toEqual(story.map(({ route }) => route));
  });

  it('ask review for the relation they require and not for the optional extras', () => {
    const asked = (entity: EntityDefinition) =>
      readinessChecks(entity, draftOf(entity, null, ['it']), ['it']).map(({ field }) => field);

    expect(asked(ARC)).toEqual(['number', 'saga', 'title', 'description']);
    expect(asked(CHAPTER)).toEqual(['number', 'arc', 'title', 'description']);
    expect(asked(EPISODE)).toEqual(['number', 'title', 'description']);
    expect(asked(VOLUME)).toEqual(['number', 'title']);
    expect(CHAPTER.fields.filter((field) => !isAskedByReview(field)).map(({ key }) => key)).toEqual(
      ['volume', 'japaneseTitle', 'pageCount', 'releases'],
    );
  });
});

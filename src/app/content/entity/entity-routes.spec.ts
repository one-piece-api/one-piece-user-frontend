import { EnvironmentInjector, createEnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Route } from '@angular/router';
import { NOTE } from '../../testing/note-entity';
import { entityNavItem } from '../../shared/nav/nav-items';
import { ENTITY, entityIcon, entityLabelKey, entityOf } from './entities';
import { entityRoutes } from './entity-routes';

describe('entityRoutes', () => {
  const routes = entityRoutes(NOTE);

  it('makes the section, new, edit and detail pages, "new" before ":id"', () => {
    expect(routes.map((route) => route.path)).toEqual([
      'content/notes',
      'content/notes/new',
      'content/notes/:id/edit',
      'content/notes/:id',
    ]);
  });

  it('asks to read for the list and the detail, to write for the editor', () => {
    expect(routes.map((route) => route.data?.['permission'])).toEqual([
      'content:read',
      'content:write',
      'content:write',
      'content:read',
    ]);
    expect(routes.every((route) => route.canActivate?.length === 1)).toBe(true);
  });

  it('gives every page the definition of the entity', () => {
    for (const route of routes) {
      expect(definitionGivenBy(route)).toBe(NOTE);
    }
  });

  it('loads each page on demand', () => {
    expect(routes.every((route) => route.loadComponent && !route.component)).toBe(true);
  });

  /** What a page under the route gets when it injects `ENTITY`. */
  function definitionGivenBy(route: Route): unknown {
    const parent = TestBed.inject(EnvironmentInjector);
    return createEnvironmentInjector(route.providers ?? [], parent).get(ENTITY);
  }
});

describe('entityNavItem', () => {
  it('names, draws and leads to the section as the definition says', () => {
    expect(entityNavItem(NOTE)).toEqual({
      id: 'notes',
      label: 'content.notes.title',
      icon: '✎',
      route: '/content/notes',
      permission: 'content:read',
    });
  });
});

describe('the registry', () => {
  it('knows the entities it has pages for, and no other', () => {
    expect(entityOf('DEVIL_FRUIT_TYPE')?.route).toBe('/content/devil-fruit-types');
    expect(entityOf('NOTE')).toBeNull();
    expect(entityOf(null)).toBeNull();
  });

  it('names and draws an entity without pages as some other content', () => {
    expect(entityLabelKey(NOTE)).toBe('content.notes.one');
    expect(entityIcon(NOTE)).toBe('✎');
    expect(entityLabelKey(null)).toBe('content.entity.unknown');
    expect(entityIcon(null)).toBe('assets/contents.webp');
  });
});

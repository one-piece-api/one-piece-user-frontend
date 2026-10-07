import type { Routes } from '@angular/router';
import { permissionGuard } from '../../shared/nav/permission.guard';
import { ENTITY } from './entities';
import type { EntityDefinition } from './entity-definition';

/**
 * The four pages of an entity's section - list, new, edit, detail - each given the entity's
 * definition through the `ENTITY` token. Loaded on demand: only the pages anyone can land
 * on stay in the bundle every page starts with.
 */
export function entityRoutes(entity: EntityDefinition): Routes {
  const providers = [{ provide: ENTITY, useValue: entity }];
  const path = entity.route.replace(/^\//, '');
  return [
    {
      path,
      loadComponent: () => import('./entity-list').then((module) => module.EntityList),
      canActivate: [permissionGuard],
      data: { permission: 'content:read' },
      providers,
    },
    {
      // Before ":id": "new" is a page, not the id of a content.
      path: `${path}/new`,
      loadComponent: () => import('./entity-editor').then((module) => module.EntityEditor),
      canActivate: [permissionGuard],
      data: { permission: 'content:write' },
      providers,
    },
    {
      path: `${path}/:id/edit`,
      loadComponent: () => import('./entity-editor').then((module) => module.EntityEditor),
      canActivate: [permissionGuard],
      data: { permission: 'content:write' },
      providers,
    },
    {
      path: `${path}/:id`,
      loadComponent: () => import('./entity-detail').then((module) => module.EntityDetail),
      canActivate: [permissionGuard],
      data: { permission: 'content:read' },
      providers,
    },
  ];
}

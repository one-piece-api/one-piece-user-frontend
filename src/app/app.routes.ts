import { Routes } from '@angular/router';
import { SessionExpired } from './identity/session-expired';
import { WhoAmI } from './identity/who-am-i';
import { Forbidden } from './shared/nav/forbidden';
import { permissionGuard } from './shared/nav/permission.guard';

export const routes: Routes = [
  { path: '', component: WhoAmI },
  { path: 'session-expired', component: SessionExpired },
  { path: 'forbidden', component: Forbidden },
  {
    // Loaded on demand, like every route below: only the pages anyone can land on stay in
    // the bundle every page starts with.
    path: 'content/devil-fruit-types',
    loadComponent: () =>
      import('./content/devil-fruit-types/devil-fruit-type-list').then(
        (module) => module.DevilFruitTypeList,
      ),
    canActivate: [permissionGuard],
    data: { permission: 'content:read' },
  },
  {
    path: 'content/devil-fruit-types/:id',
    loadComponent: () =>
      import('./content/devil-fruit-types/devil-fruit-type-detail').then(
        (module) => module.DevilFruitTypeDetail,
      ),
    canActivate: [permissionGuard],
    data: { permission: 'content:read' },
  },
  {
    path: 'users',
    loadComponent: () => import('./admin/user-list').then((module) => module.AdminUserList),
    canActivate: [permissionGuard],
    data: { permission: 'users:read' },
  },
  {
    path: 'users/:userId',
    loadComponent: () => import('./admin/user-detail').then((module) => module.AdminUserDetail),
    canActivate: [permissionGuard],
    data: { permission: 'users:read' },
  },
  {
    path: 'audit',
    loadComponent: () => import('./admin/audit-page').then((module) => module.AdminAuditPage),
    canActivate: [permissionGuard],
    data: { permission: 'audit:read' },
  },
  {
    path: 'roles',
    loadComponent: () => import('./admin/roles-page').then((module) => module.RolesPage),
    canActivate: [permissionGuard],
    data: { permission: 'roles:manage' },
  },
  {
    path: 'languages',
    loadComponent: () => import('./admin/languages-page').then((module) => module.LanguagesPage),
    canActivate: [permissionGuard],
    data: { permission: 'languages:manage' },
  },
];

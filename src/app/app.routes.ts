import { Routes } from '@angular/router';
import { SessionExpired } from './identity/session-expired';
import { WhoAmI } from './identity/who-am-i';
import { Forbidden } from './shared/nav/forbidden';
import { statusPageGuard } from './content/dashboard/status-page.guard';
import { ENTITIES } from './content/entity/entities';
import { entityRoutes } from './content/entity/entity-routes';
import { homeGuard } from './shared/nav/home.guard';
import { permissionGuard } from './shared/nav/permission.guard';

export const routes: Routes = [
  // The root only redirects: to the dashboard, or to the profile for who reads no content.
  { path: '', pathMatch: 'full', canActivate: [homeGuard], children: [] },
  { path: 'profile', component: WhoAmI },
  { path: 'session-expired', component: SessionExpired },
  { path: 'forbidden', component: Forbidden },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./content/dashboard/dashboard-home').then((module) => module.DashboardHome),
    canActivate: [permissionGuard],
    data: { permission: 'content:read' },
  },
  {
    // Who sees which status is the status page's own rule, not a single permission.
    path: 'dashboard/:status',
    loadComponent: () =>
      import('./content/dashboard/dashboard-status').then((module) => module.DashboardStatus),
    canActivate: [statusPageGuard],
  },
  // One section per entity, from the registry: list, new, edit, detail.
  ...ENTITIES.flatMap(entityRoutes),
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

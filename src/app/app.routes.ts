import { Routes } from '@angular/router';
import { AdminAuditPage } from './admin/audit-page';
import { LanguagesPage } from './admin/languages-page';
import { RolesPage } from './admin/roles-page';
import { AdminUserDetail } from './admin/user-detail';
import { AdminUserList } from './admin/user-list';
import { SessionExpired } from './identity/session-expired';
import { WhoAmI } from './identity/who-am-i';
import { Forbidden } from './shared/nav/forbidden';
import { permissionGuard } from './shared/nav/permission.guard';

export const routes: Routes = [
  { path: '', component: WhoAmI },
  { path: 'session-expired', component: SessionExpired },
  { path: 'forbidden', component: Forbidden },
  {
    // Loaded on demand: the content screens stay out of the bundle every page starts with.
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
    component: AdminUserList,
    canActivate: [permissionGuard],
    data: { permission: 'users:read' },
  },
  {
    path: 'users/:userId',
    component: AdminUserDetail,
    canActivate: [permissionGuard],
    data: { permission: 'users:read' },
  },
  {
    path: 'audit',
    component: AdminAuditPage,
    canActivate: [permissionGuard],
    data: { permission: 'audit:read' },
  },
  {
    path: 'roles',
    component: RolesPage,
    canActivate: [permissionGuard],
    data: { permission: 'roles:manage' },
  },
  {
    path: 'languages',
    component: LanguagesPage,
    canActivate: [permissionGuard],
    data: { permission: 'languages:manage' },
  },
];

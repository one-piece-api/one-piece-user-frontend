import { Routes } from '@angular/router';
import { AdminAuditPage } from './admin/audit-page';
import { RolesPage } from './admin/roles-page';
import { AdminUserDetail } from './admin/user-detail';
import { AdminUserList } from './admin/user-list';
import { Encyclopedia } from './content/encyclopedia';
import { MyDrafts } from './content/my-drafts';
import { ReviewQueue } from './content/review-queue';
import { SessionExpired } from './identity/session-expired';
import { WhoAmI } from './identity/who-am-i';
import { Forbidden } from './shared/nav/forbidden';
import { permissionGuard } from './shared/nav/permission.guard';

export const routes: Routes = [
  { path: '', component: WhoAmI },
  { path: 'session-expired', component: SessionExpired },
  { path: 'forbidden', component: Forbidden },
  {
    path: 'drafts',
    component: MyDrafts,
    canActivate: [permissionGuard],
    data: { permission: 'content:write' },
  },
  {
    path: 'review-queue',
    component: ReviewQueue,
    canActivate: [permissionGuard],
    data: { permission: 'content:review' },
  },
  {
    path: 'encyclopedia',
    component: Encyclopedia,
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
];

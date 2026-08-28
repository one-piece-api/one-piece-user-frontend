import { Routes } from '@angular/router';
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
    path: 'admin/users',
    component: AdminUserList,
    canActivate: [permissionGuard],
    data: { permission: 'users:read' },
  },
  {
    path: 'admin/users/:userId',
    component: AdminUserDetail,
    canActivate: [permissionGuard],
    data: { permission: 'users:read' },
  },
];

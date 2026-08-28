import { Routes } from '@angular/router';
import { AdminUserDetail } from './admin/user-detail';
import { AdminUserList } from './admin/user-list';
import { SessionExpired } from './identity/session-expired';
import { WhoAmI } from './identity/who-am-i';

export const routes: Routes = [
  { path: '', component: WhoAmI },
  { path: 'session-expired', component: SessionExpired },
  { path: 'admin/users', component: AdminUserList },
  { path: 'admin/users/:userId', component: AdminUserDetail },
];

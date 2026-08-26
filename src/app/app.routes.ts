import { Routes } from '@angular/router';
import { AdminUserDetail } from './admin/user-detail';
import { AdminUserList } from './admin/user-list';
import { WhoAmI } from './identity/who-am-i';

export const routes: Routes = [
  { path: '', component: WhoAmI },
  { path: 'admin/users', component: AdminUserList },
  { path: 'admin/users/:userId', component: AdminUserDetail },
];

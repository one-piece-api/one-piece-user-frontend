import { Routes } from '@angular/router';
import { AdminUserList } from './admin/user-list';
import { WhoAmI } from './identity/who-am-i';

export const routes: Routes = [
  { path: '', component: WhoAmI },
  { path: 'admin/users', component: AdminUserList },
];

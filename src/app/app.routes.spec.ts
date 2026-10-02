import { routes } from './app.routes';
import { permissionGuard } from './shared/nav/permission.guard';

describe('routes', () => {
  it('opens the Devil Fruit Type section only to who holds content:read', () => {
    const route = routes.find((candidate) => candidate.path === 'content/devil-fruit-types');

    expect(route?.canActivate).toEqual([permissionGuard]);
    expect(route?.data).toEqual({ permission: 'content:read' });
  });
});

import { routes } from './app.routes';
import { permissionGuard } from './shared/nav/permission.guard';

describe('routes', () => {
  it.each(['content/devil-fruit-types', 'content/devil-fruit-types/:id'])(
    'opens %s only to who holds content:read',
    (path) => {
      const route = routes.find((candidate) => candidate.path === path);

      expect(route?.canActivate).toEqual([permissionGuard]);
      expect(route?.data).toEqual({ permission: 'content:read' });
    },
  );
});

import { routes } from './app.routes';
import { statusPageGuard } from './content/dashboard/status-page.guard';
import { permissionGuard } from './shared/nav/permission.guard';

/**
 * The pages anyone can land on, signed in or not - the root only redirects: the only ones
 * in the initial bundle.
 */
const EAGER_PATHS = ['', 'profile', 'session-expired', 'forbidden'];

describe('routes', () => {
  it('loads on demand every page behind a permission', () => {
    const guarded = routes.filter((route) => !EAGER_PATHS.includes(route.path ?? ''));

    expect(guarded.length).toBeGreaterThan(0);
    for (const route of guarded) {
      expect(route.loadComponent, route.path).toBeDefined();
      expect(route.component, route.path).toBeUndefined();
      expect([[permissionGuard], [statusPageGuard]], route.path).toContainEqual(route.canActivate);
    }
  });

  it.each(['dashboard', 'content/devil-fruit-types', 'content/devil-fruit-types/:id'])(
    'opens %s only to who holds content:read',
    (path) => {
      const route = routes.find((candidate) => candidate.path === path);

      expect(route?.canActivate).toEqual([permissionGuard]);
      expect(route?.data).toEqual({ permission: 'content:read' });
    },
  );

  it('opens a dashboard status page by its own rule: who sees that status', () => {
    const route = routes.find((candidate) => candidate.path === 'dashboard/:status');

    expect(route?.canActivate).toEqual([statusPageGuard]);
    expect(route?.loadComponent).toBeDefined();
  });
});

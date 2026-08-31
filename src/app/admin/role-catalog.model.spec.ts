import { groupPermissionsByPrefix } from './role-catalog.model';

describe('groupPermissionsByPrefix', () => {
  it('groups permissions by the part of their key before the colon', () => {
    const groups = groupPermissionsByPrefix([
      { key: 'users:read', description: 'List and view crew members' },
      { key: 'docs:approve', description: 'Approve documents' },
      { key: 'users:invite', description: 'Invite a new crew member' },
    ]);

    expect(groups).toEqual([
      {
        prefix: 'docs',
        label: 'Docs',
        permissions: [{ key: 'docs:approve', description: 'Approve documents' }],
      },
      {
        prefix: 'users',
        label: 'Users',
        permissions: [
          { key: 'users:invite', description: 'Invite a new crew member' },
          { key: 'users:read', description: 'List and view crew members' },
        ],
      },
    ]);
  });

  it('returns no groups for an empty permission list', () => {
    expect(groupPermissionsByPrefix([])).toEqual([]);
  });
});

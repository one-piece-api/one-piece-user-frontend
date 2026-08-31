/** One entry in the permission registry (`GET /permissions`) - every permission that
 * exists, including one no role currently holds (ADR-0012). */
export interface PermissionDefinition {
  key: string;
  description: string;
}

export interface PermissionGroup {
  prefix: string;
  label: string;
  permissions: readonly PermissionDefinition[];
}

/**
 * Groups permissions by their key's resource prefix (`resource:action` → `resource`),
 * derived client-side rather than stored - a new permission's group is just wherever its
 * prefix already sorts, no backend concept of "group" exists.
 */
export function groupPermissionsByPrefix(
  permissions: readonly PermissionDefinition[],
): PermissionGroup[] {
  const byPrefix = new Map<string, PermissionDefinition[]>();
  for (const permission of permissions) {
    const prefix = permission.key.split(':')[0] || permission.key;
    const group = byPrefix.get(prefix);
    if (group) {
      group.push(permission);
    } else {
      byPrefix.set(prefix, [permission]);
    }
  }
  return [...byPrefix.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([prefix, groupPermissions]) => ({
      prefix,
      label: prefix.charAt(0).toUpperCase() + prefix.slice(1),
      permissions: [...groupPermissions].sort((a, b) => a.key.localeCompare(b.key)),
    }));
}

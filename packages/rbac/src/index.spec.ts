import {
  Role,
  PERMISSIONS,
  permissionsForRole,
  roleHasPermission,
  roleHasPermissions,
  ABACEngine,
  PermissionCache,
  PermissionAuditor,
  PermissionChecker,
} from './index';

describe('Role permissions', () => {
  it('OWNER has all permissions', () => {
    const ownerPermissions = permissionsForRole(Role.OWNER);
    expect(ownerPermissions).toContain('organization.delete');
    expect(ownerPermissions).toContain('system.admin');
  });

  it('ADMIN cannot delete the organization', () => {
    expect(roleHasPermission(Role.ADMIN, 'organization.delete')).toBe(false);
  });

  it('ADMIN has most other permissions', () => {
    expect(roleHasPermission(Role.ADMIN, 'clients.delete')).toBe(true);
    expect(roleHasPermission(Role.ADMIN, 'system.audit')).toBe(true);
  });

  it('MEMBER has inherited read permissions', () => {
    expect(roleHasPermission(Role.MEMBER, 'clients.read')).toBe(true);
    expect(roleHasPermission(Role.MEMBER, 'clients.delete')).toBe(false);
  });

  it('VIEWER only has read permissions', () => {
    expect(roleHasPermission(Role.VIEWER, 'clients.read')).toBe(true);
    expect(roleHasPermission(Role.VIEWER, 'clients.create')).toBe(false);
  });

  it('checks multiple permissions at once', () => {
    expect(roleHasPermissions(Role.MANAGER, ['clients.read', 'clients.create'])).toBe(true);
    expect(roleHasPermissions(Role.MANAGER, ['clients.read', 'organization.delete'])).toBe(false);
  });
});

describe('ABAC engine', () => {
  it('evaluates attribute rules', () => {
    const engine = new ABACEngine();
    engine.addRule({
      permission: 'clients.update',
      condition: (context) => context.organizationId === 'org-1',
      description: 'Only within same organization',
    });

    expect(engine.hasPermission('clients.update', { organizationId: 'org-1' })).toBe(true);
    expect(engine.hasPermission('clients.update', { organizationId: 'org-2' })).toBe(false);
  });

  it('returns false for undefined permission rules', () => {
    const engine = new ABACEngine();
    expect(engine.hasPermission('clients.delete', { organizationId: 'org-1' })).toBe(false);
  });
});

describe('Permission cache', () => {
  it('stores and retrieves permissions', () => {
    const cache = new PermissionCache(1000);
    const perms = ['clients.read'] as const;
    cache.set('user-1', perms);
    expect(cache.get('user-1')).toEqual(perms);
  });

  it('expires entries after TTL', async () => {
    const cache = new PermissionCache(1);
    cache.set('user-1', ['clients.read']);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(cache.get('user-1')).toBeNull();
  });

  it('invalidates entries', () => {
    const cache = new PermissionCache(1000);
    cache.set('user-1', ['clients.read']);
    cache.invalidate('user-1');
    expect(cache.get('user-1')).toBeNull();
  });
});

describe('Permission auditor', () => {
  it('logs and filters audit entries', () => {
    const auditor = new PermissionAuditor();
    auditor.log({
      timestamp: new Date().toISOString(),
      userId: 'user-1',
      action: 'CHECK',
      result: true,
    });

    const filtered = auditor.getEntries({ userId: 'user-1' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].result).toBe(true);
  });

  it('clears entries', () => {
    const auditor = new PermissionAuditor();
    auditor.log({ timestamp: new Date().toISOString(), action: 'CHECK', result: true });
    auditor.clear();
    expect(auditor.getEntries()).toHaveLength(0);
  });
});

describe('Permission checker', () => {
  it('checks RBAC and ABAC combined', () => {
    const checker = new PermissionChecker();
    expect(checker.checkRolePermissions(Role.MEMBER, ['clients.read'])).toBe(true);
    expect(checker.checkRolePermissions(Role.MEMBER, ['clients.delete'])).toBe(false);
  });
});

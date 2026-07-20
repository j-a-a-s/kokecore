import {
  Role,
  PermissionTemplates,
  RequirePermissions,
  diffPermissions,
  getRequiredPermissions,
  permissionSchema,
  permissionsSchema,
  permissionsForRole,
  roleHasPermission,
  roleHasPermissions,
  roleSchema,
  ABACEngine,
  PermissionCache,
  PermissionAuditor,
  PermissionChecker,
  default as rbac,
} from './index';
import * as publicApi from './public';

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

  it('handles an unknown role defensively and empty requirements', () => {
    expect(permissionsForRole('UNKNOWN' as Role)).toEqual([]);
    expect(roleHasPermissions(Role.VIEWER, [])).toBe(true);
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

  it('requires every rule and supports any/all checks', () => {
    const engine = new ABACEngine();
    engine.addRule({ permission: 'clients.read', condition: () => true });
    engine.addRule({
      permission: 'clients.read',
      condition: (context) => context.userId === 'allowed',
    });
    engine.addRule({ permission: 'catalog.read', condition: () => true });

    expect(engine.hasPermission('clients.read', { userId: 'allowed' })).toBe(true);
    expect(engine.hasPermission('clients.read', { userId: 'denied' })).toBe(false);
    expect(engine.hasAnyPermission(['clients.delete', 'catalog.read'], {})).toBe(true);
    expect(engine.hasAnyPermission(['clients.delete'], {})).toBe(false);
    expect(engine.hasAllPermissions(['clients.read', 'catalog.read'], { userId: 'allowed' })).toBe(
      true
    );
    expect(
      engine.hasAllPermissions(['clients.read', 'clients.delete'], { userId: 'allowed' })
    ).toBe(false);
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

  it('returns null for misses and clears all entries', () => {
    const cache = new PermissionCache();
    expect(cache.get('missing')).toBeNull();
    cache.set('one', ['clients.read']);
    cache.set('two', ['catalog.read']);
    cache.clear();
    expect(cache.get('one')).toBeNull();
    expect(cache.get('two')).toBeNull();
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

  it('returns copies and enforces the maximum history size', () => {
    const auditor = new PermissionAuditor(2);
    auditor.log({ timestamp: '1', action: 'CHECK', result: false });
    auditor.log({ timestamp: '2', action: 'GRANT', result: true });
    auditor.log({ timestamp: '3', action: 'REVOKE', result: true });

    const entries = auditor.getEntries();
    expect(entries.map((entry) => entry.timestamp)).toEqual(['2', '3']);
    entries.length = 0;
    expect(auditor.getEntries()).toHaveLength(2);
    expect(auditor.getEntries({ action: 'GRANT', result: true })).toHaveLength(1);
  });
});

describe('Permission checker', () => {
  it('checks RBAC and ABAC combined', () => {
    const checker = new PermissionChecker();
    expect(checker.checkRolePermissions(Role.MEMBER, ['clients.read'])).toBe(true);
    expect(checker.checkRolePermissions(Role.MEMBER, ['clients.delete'])).toBe(false);
  });

  it('does not bypass ABAC rules when a cache key has a prior authorization', () => {
    const engine = new ABACEngine();
    engine.addRule({
      permission: 'clients.update',
      condition: (context) => context.organizationId === 'org-1',
    });
    const checker = new PermissionChecker(engine);

    expect(
      checker.checkWithCache('user-1', Role.MEMBER, ['clients.update'], {
        organizationId: 'org-1',
      })
    ).toBe(true);
    expect(
      checker.checkWithCache('user-1', Role.MEMBER, ['clients.update'], {
        organizationId: 'org-2',
      })
    ).toBe(false);
  });

  it('evaluates combined checks and records contextual audits', () => {
    const engine = new ABACEngine();
    engine.addRule({
      permission: 'clients.read',
      condition: (context) => context.organizationId === 'org-1',
    });
    const auditor = new PermissionAuditor();
    const checker = new PermissionChecker(engine, new PermissionCache(), auditor);

    expect(
      checker.checkPermissions(Role.VIEWER, ['clients.read'], {
        userId: 'user-1',
        organizationId: 'org-1',
      })
    ).toBe(true);
    expect(
      checker.checkPermissions(Role.VIEWER, ['clients.read'], {
        organizationId: 'org-2',
      })
    ).toBe(false);
    expect(checker.checkPermissions(Role.VIEWER, ['clients.create'])).toBe(false);
    expect(checker.checkPermissions(Role.VIEWER, ['clients.read'])).toBe(true);
    expect(auditor.getEntries({ action: 'CHECK' }).length).toBeGreaterThan(3);
  });

  it('uses and populates the RBAC cache only for successful checks', () => {
    const checker = new PermissionChecker();
    expect(checker.checkWithCache('viewer', Role.VIEWER, ['clients.read'])).toBe(true);
    expect(checker.getCache().get('viewer')).toContain('clients.read');
    expect(checker.checkWithCache('viewer', Role.VIEWER, ['clients.read'])).toBe(true);
    expect(checker.checkWithCache('viewer', Role.VIEWER, ['clients.create'])).toBe(false);
    expect(checker.checkWithCache('denied', Role.VIEWER, ['clients.create'])).toBe(false);
    expect(checker.getCache().get('denied')).toBeNull();
    expect(checker.getABACEngine()).toBeInstanceOf(ABACEngine);
    expect(checker.getAuditor()).toBeInstanceOf(PermissionAuditor);
  });
});

describe('Public RBAC utilities', () => {
  it('stores permission decorator metadata', () => {
    const handler = () => undefined;
    const descriptor: PropertyDescriptor = { value: handler };
    RequirePermissions('clients.read', 'clients.update')({}, 'handler', descriptor);
    expect(getRequiredPermissions(handler)).toEqual(['clients.read', 'clients.update']);
    expect(getRequiredPermissions(() => undefined)).toEqual([]);
  });

  it('provides templates and validates schemas', () => {
    expect(PermissionTemplates.fullAccess).toContain('system.admin');
    expect(PermissionTemplates.readOnly.every((permission) => permission.endsWith('.read'))).toBe(
      true
    );
    expect(PermissionTemplates.writeAccess).not.toContain('clients.delete');
    expect(PermissionTemplates.management).toContain('events.manage');
    expect(PermissionTemplates.sales).toContain('quotations.send');
    expect(PermissionTemplates.operations).toContain('events.update');
    expect(roleSchema.parse('OWNER')).toBe(Role.OWNER);
    expect(roleSchema.safeParse('UNKNOWN').success).toBe(false);
    expect(permissionSchema.parse('clients.read')).toBe('clients.read');
    expect(permissionSchema.safeParse('unknown.read').success).toBe(false);
    expect(permissionsSchema.parse(['clients.read'])).toEqual(['clients.read']);
  });

  it('calculates permission differences', () => {
    expect(
      diffPermissions(['clients.read', 'clients.update'], ['clients.read', 'catalog.read'])
    ).toEqual({
      added: ['catalog.read'],
      removed: ['clients.update'],
      unchanged: ['clients.read'],
    });
    expect(rbac.roleHasPermission(Role.OWNER, 'system.admin')).toBe(true);
  });
});

describe('Public API entry point', () => {
  it('resolves every runtime export from the package entry point', () => {
    for (const key of Object.keys(publicApi) as Array<keyof typeof publicApi>) {
      expect(publicApi[key]).toBeDefined();
    }
    expect(publicApi.Role).toBe(Role);
  });
});

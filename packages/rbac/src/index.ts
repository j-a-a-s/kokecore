/**
 * @kokecore/rbac
 *
 * Enterprise-grade Role-Based and Attribute-Based Access Control (RBAC/ABAC) with:
 * - Hierarchical permission system
 * - Dynamic permission evaluation
 * - Attribute-based access control
 * - Permission caching
 * - Audit logging
 * - Permission versioning
 */

import { z } from 'zod';

/**
 * Role definitions with hierarchical structure
 */
export enum Role {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

/**
 * Permission categories for organization
 */
export const PERMISSIONS = [
  // Organization permissions
  'organization.read',
  'organization.update',
  'organization.delete',
  'organization.members.read',
  'organization.members.invite',
  'organization.members.update',
  'organization.members.remove',

  // Client permissions
  'clients.read',
  'clients.create',
  'clients.update',
  'clients.delete',

  // Catalog permissions
  'catalog.read',
  'catalog.create',
  'catalog.update',
  'catalog.delete',

  // Quotation permissions
  'quotations.read',
  'quotations.create',
  'quotations.update',
  'quotations.send',
  'quotations.approve',
  'quotations.reject',
  'quotations.delete',

  // Event permissions
  'events.read',
  'events.create',
  'events.update',
  'events.manage',
  'events.delete',

  // Payment permissions
  'wallet.read',
  'wallet.manage',

  // System permissions
  'system.admin',
  'system.audit',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Role-permission mapping with inheritance
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  ADMIN: PERMISSIONS.filter((permission) => permission !== 'organization.delete'),
  MANAGER: [
    'organization.read',
    'organization.members.read',
    'clients.read',
    'clients.create',
    'clients.update',
    'clients.delete',
    'catalog.read',
    'catalog.create',
    'catalog.update',
    'catalog.delete',
    'quotations.read',
    'quotations.create',
    'quotations.update',
    'quotations.send',
    'quotations.approve',
    'quotations.reject',
    'events.read',
    'events.create',
    'events.update',
    'events.manage',
    'wallet.read',
  ],
  MEMBER: [
    'organization.read',
    'clients.read',
    'clients.create',
    'clients.update',
    'catalog.read',
    'catalog.create',
    'catalog.update',
    'quotations.read',
    'quotations.create',
    'quotations.update',
    'events.read',
    'events.create',
    'events.update',
    'wallet.read',
  ],
  VIEWER: ['organization.read', 'clients.read', 'catalog.read', 'quotations.read', 'events.read'],
};

/**
 * Permission hierarchy for inheritance
 */
export const PERMISSION_HIERARCHY: Record<string, string[]> = {
  'organization.delete': ['organization.update'],
  'organization.update': ['organization.read'],
  'organization.members.remove': ['organization.members.update', 'organization.members.read'],
  'organization.members.update': ['organization.members.read'],
  'organization.members.invite': ['organization.members.read'],
  'clients.delete': ['clients.update', 'clients.read'],
  'clients.update': ['clients.read'],
  'clients.create': ['clients.read'],
  'catalog.delete': ['catalog.update', 'catalog.read'],
  'catalog.update': ['catalog.read'],
  'catalog.create': ['catalog.read'],
  'quotations.delete': ['quotations.update', 'quotations.read'],
  'quotations.approve': ['quotations.read'],
  'quotations.reject': ['quotations.read'],
  'quotations.send': ['quotations.read'],
  'quotations.update': ['quotations.read'],
  'quotations.create': ['quotations.read'],
  'events.delete': ['events.manage', 'events.update', 'events.read'],
  'events.manage': ['events.update', 'events.read'],
  'events.update': ['events.read'],
  'events.create': ['events.read'],
  'wallet.manage': ['wallet.read'],
};

/**
 * Get all permissions for a role including inherited permissions
 */
export function permissionsForRole(role: Role): readonly Permission[] {
  const directPermissions = ROLE_PERMISSIONS[role] || [];
  const allPermissions = new Set<Permission>(directPermissions);

  // Add inherited permissions based on hierarchy
  directPermissions.forEach((permission) => {
    const inherited = PERMISSION_HIERARCHY[permission] || [];
    inherited.forEach((inheritedPerm) => {
      allPermissions.add(inheritedPerm as Permission);
    });
  });

  return Array.from(allPermissions);
}

/**
 * Check if a role has specific permissions
 */
export function roleHasPermissions(
  role: Role,
  requiredPermissions: readonly Permission[]
): boolean {
  const rolePermissions = permissionsForRole(role);
  return requiredPermissions.every((permission) => rolePermissions.includes(permission));
}

/**
 * Check if a role has a single permission
 */
export function roleHasPermission(role: Role, permission: Permission): boolean {
  return roleHasPermissions(role, [permission]);
}

/**
 * Attribute-based access control context
 */
export interface ABACContext {
  userId?: string;
  organizationId?: string;
  resourceId?: string;
  resourceType?: string;
  attributes?: Record<string, unknown>;
  time?: Date;
  location?: string;
  ip?: string;
}

/**
 * Attribute-based permission rule
 */
export interface AttributeRule {
  permission: Permission;
  condition: (context: ABACContext) => boolean;
  description?: string;
}

/**
 * ABAC engine for dynamic permission evaluation
 */
export class ABACEngine {
  private rules: Map<Permission, AttributeRule[]> = new Map();

  addRule(rule: AttributeRule): void {
    const existing = this.rules.get(rule.permission) || [];
    this.rules.set(rule.permission, [...existing, rule]);
  }

  hasPermission(permission: Permission, context: ABACContext): boolean {
    const rules = this.rules.get(permission);
    if (!rules || rules.length === 0) {
      return false;
    }

    return rules.every((rule) => rule.condition(context));
  }

  hasAnyPermission(permissions: Permission[], context: ABACContext): boolean {
    return permissions.some((permission) => this.hasPermission(permission, context));
  }

  hasAllPermissions(permissions: Permission[], context: ABACContext): boolean {
    return permissions.every((permission) => this.hasPermission(permission, context));
  }
}

/**
 * Permission cache for performance
 */
export class PermissionCache {
  private cache: Map<string, { permissions: readonly Permission[]; timestamp: number }> = new Map();
  private ttl: number;

  constructor(ttlMs: number = 5 * 60 * 1000) {
    this.ttl = ttlMs;
  }

  set(key: string, permissions: readonly Permission[]): void {
    this.cache.set(key, {
      permissions,
      timestamp: Date.now(),
    });
  }

  get(key: string): readonly Permission[] | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.permissions;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Permission audit entry
 */
export interface PermissionAuditEntry {
  timestamp: string;
  userId?: string;
  organizationId?: string;
  action: 'GRANT' | 'REVOKE' | 'CHECK';
  permission?: Permission;
  role?: Role;
  context?: ABACContext;
  result: boolean;
  reason?: string;
}

/**
 * Permission auditor for tracking permission changes
 */
export class PermissionAuditor {
  private entries: PermissionAuditEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries: number = 1000) {
    this.maxEntries = maxEntries;
  }

  log(entry: PermissionAuditEntry): void {
    this.entries.push(entry);

    // Keep only the most recent entries
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  getEntries(filter?: Partial<PermissionAuditEntry>): PermissionAuditEntry[] {
    if (!filter) return [...this.entries];

    return this.entries.filter((entry) => {
      return Object.entries(filter).every(([key, value]) => {
        return entry[key as keyof PermissionAuditEntry] === value;
      });
    });
  }

  clear(): void {
    this.entries = [];
  }
}

/**
 * Combined RBAC/ABAC permission checker
 */
export class PermissionChecker {
  private abacEngine: ABACEngine;
  private cache: PermissionCache;
  private auditor: PermissionAuditor;

  constructor(
    abacEngine: ABACEngine = new ABACEngine(),
    cache: PermissionCache = new PermissionCache(),
    auditor: PermissionAuditor = new PermissionAuditor()
  ) {
    this.abacEngine = abacEngine;
    this.cache = cache;
    this.auditor = auditor;
  }

  /**
   * Check permissions using RBAC
   */
  checkRolePermissions(
    role: Role,
    requiredPermissions: readonly Permission[],
    context?: ABACContext
  ): boolean {
    const hasPermissions = roleHasPermissions(role, requiredPermissions);

    this.auditor.log({
      timestamp: new Date().toISOString(),
      userId: context?.userId,
      organizationId: context?.organizationId,
      action: 'CHECK',
      permission: requiredPermissions[0] ?? undefined,
      role,
      context,
      result: hasPermissions,
    });

    return hasPermissions;
  }

  /**
   * Check permissions using ABAC
   */
  checkAttributePermissions(permission: Permission, context: ABACContext): boolean {
    const hasPermission = this.abacEngine.hasPermission(permission, context);

    this.auditor.log({
      timestamp: new Date().toISOString(),
      userId: context.userId,
      organizationId: context.organizationId,
      action: 'CHECK',
      permission,
      context,
      result: hasPermission,
    });

    return hasPermission;
  }

  /**
   * Check permissions using both RBAC and ABAC
   */
  checkPermissions(
    role: Role,
    requiredPermissions: readonly Permission[],
    context?: ABACContext
  ): boolean {
    // First check RBAC
    const rbacResult = this.checkRolePermissions(role, requiredPermissions, context);
    if (!rbacResult) return false;

    // Then check ABAC if context is provided
    if (context) {
      const abacResult = requiredPermissions.every((permission) =>
        this.checkAttributePermissions(permission, context)
      );
      return abacResult;
    }

    return true;
  }

  /**
   * Check with caching
   */
  checkWithCache(
    cacheKey: string,
    role: Role,
    requiredPermissions: readonly Permission[],
    context?: ABACContext
  ): boolean {
    const cached = this.cache.get(cacheKey);
    if (cached !== null) {
      return requiredPermissions.every((permission) => cached.includes(permission));
    }

    const result = this.checkPermissions(role, requiredPermissions, context);

    if (result) {
      this.cache.set(cacheKey, permissionsForRole(role));
    }

    return result;
  }

  /**
   * Get the ABAC engine for custom rules
   */
  getABACEngine(): ABACEngine {
    return this.abacEngine;
  }

  /**
   * Get the cache instance
   */
  getCache(): PermissionCache {
    return this.cache;
  }

  /**
   * Get the auditor instance
   */
  getAuditor(): PermissionAuditor {
    return this.auditor;
  }
}

/**
 * Permission decorator metadata store
 */
const permissionMetadata = new WeakMap<object, Permission[]>();

/**
 * Permission decorator for NestJS (if using NestJS)
 */
export function RequirePermissions(...permissions: Permission[]) {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    permissionMetadata.set(descriptor.value, permissions);
    return descriptor;
  };
}

/**
 * Get required permissions from metadata
 */
export function getRequiredPermissions(target: any): Permission[] {
  return permissionMetadata.get(target) || [];
}

/**
 * Permission template for common patterns
 */
export const PermissionTemplates = {
  // Full access
  fullAccess: PERMISSIONS,

  // Read-only access
  readOnly: PERMISSIONS.filter((p) => p.endsWith('.read')),

  // Write access (no delete)
  writeAccess: PERMISSIONS.filter((p) => !p.endsWith('.delete')),

  // Management access
  management: [
    'organization.read',
    'organization.update',
    'organization.members.read',
    'organization.members.invite',
    'organization.members.update',
    'clients.read',
    'clients.create',
    'clients.update',
    'catalog.read',
    'catalog.create',
    'catalog.update',
    'quotations.read',
    'quotations.create',
    'quotations.update',
    'quotations.send',
    'quotations.approve',
    'events.read',
    'events.create',
    'events.update',
    'events.manage',
    'wallet.read',
  ],

  // Sales access
  sales: [
    'clients.read',
    'clients.create',
    'clients.update',
    'catalog.read',
    'quotations.read',
    'quotations.create',
    'quotations.update',
    'quotations.send',
    'events.read',
    'events.create',
  ],

  // Operations access
  operations: [
    'clients.read',
    'catalog.read',
    'quotations.read',
    'events.read',
    'events.create',
    'events.update',
    'events.manage',
  ],
};

/**
 * Zod schemas for validation
 */
export const roleSchema = z.nativeEnum(Role);
export const permissionSchema = z.enum(PERMISSIONS);
export const permissionsSchema = z.array(permissionSchema);

/**
 * Permission diff for tracking changes
 */
export interface PermissionDiff {
  added: Permission[];
  removed: Permission[];
  unchanged: Permission[];
}

/**
 * Calculate diff between two permission sets
 */
export function diffPermissions(
  oldPermissions: readonly Permission[],
  newPermissions: readonly Permission[]
): PermissionDiff {
  const oldSet = new Set(oldPermissions);
  const newSet = new Set(newPermissions);

  const added = newPermissions.filter((p) => !oldSet.has(p));
  const removed = oldPermissions.filter((p) => !newSet.has(p));
  const unchanged = oldPermissions.filter((p) => newSet.has(p));

  return { added, removed, unchanged };
}

/**
 * Export all RBAC utilities
 */
export default {
  Role,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  PERMISSION_HIERARCHY,
  permissionsForRole,
  roleHasPermissions,
  roleHasPermission,
  ABACEngine,
  PermissionCache,
  PermissionAuditor,
  PermissionChecker,
  RequirePermissions,
  getRequiredPermissions,
  PermissionTemplates,
  diffPermissions,
  roleSchema,
  permissionSchema,
  permissionsSchema,
};

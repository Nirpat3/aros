// ── Workspace Management ──────────────────────────────────────────
// Create, list, configure workspaces under a tenant.
// Each workspace owns: stores, connector, agents, members.

import type {
  Tenant,
  TenantPlan,
  Workspace,
  WorkspaceType,
  WorkspaceMember,
  WorkspaceAgent,
  WorkspaceStore,
  UserRole,
  BrandingConfig,
} from './types.js';
import { PLAN_LIMITS, DEFAULT_BRANDING } from './types.js';

// ── Tenant Factory ────────────────────────────────────────────────

export function createTenant(opts: {
  id: string;
  name: string;
  ownerUserId: string;
  plan?: TenantPlan;
  companyType?: Tenant['companyType'];
  parentTenantId?: string;
}): Tenant {
  return {
    id: opts.id,
    name: opts.name,
    slug: slugify(opts.name),
    plan: opts.plan ?? 'free',
    companyType: opts.companyType ?? 'direct',
    parentTenantId: opts.parentTenantId,
    ownerUserId: opts.ownerUserId,
    onboardingComplete: false,
    createdAt: new Date().toISOString(),
  };
}

// ── Workspace Factory ─────────────────────────────────────────────

export function createWorkspace(opts: {
  id: string;
  tenantId: string;
  name: string;
  type?: WorkspaceType;
  connectorNodeId?: string;
  connectorConfig?: Record<string, unknown>;
}): Workspace {
  return {
    id: opts.id,
    tenantId: opts.tenantId,
    name: opts.name,
    slug: slugify(opts.name),
    type: opts.type ?? 'retail',
    status: 'active',
    storeCount: 0,
    memberCount: 0,
    agentCount: 0,
    connectorNodeId: opts.connectorNodeId,
    connectorConfig: opts.connectorConfig,
    createdAt: new Date().toISOString(),
  };
}

// ── Member Management ─────────────────────────────────────────────

export function createInvite(opts: {
  id: string;
  workspaceId: string;
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  storeScope?: string[] | 'all';
}): WorkspaceMember {
  return {
    id: opts.id,
    workspaceId: opts.workspaceId,
    userId: opts.userId,
    email: opts.email,
    name: opts.name,
    role: opts.role,
    storeScope: opts.storeScope ?? 'all',
    invitedAt: new Date().toISOString(),
  };
}

/** Check role hierarchy: owner > admin > manager > viewer */
const ROLE_RANK: Record<UserRole, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  viewer: 1,
};

export function canManageRole(actorRole: UserRole, targetRole: UserRole): boolean {
  return ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}

export function canInvite(actorRole: UserRole): boolean {
  return actorRole === 'owner' || actorRole === 'admin';
}

export function canConfigureConnector(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canViewStore(member: WorkspaceMember, storeId: string): boolean {
  if (member.storeScope === 'all') return true;
  return member.storeScope.includes(storeId);
}

// ── Plan Enforcement ──────────────────────────────────────────────

export interface PlanCheckResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: TenantPlan;
}

export function checkCreateWorkspace(plan: TenantPlan, currentCount: number): PlanCheckResult {
  const limits = PLAN_LIMITS[plan];
  if (currentCount >= limits.maxWorkspaces) {
    const upgrade = plan === 'starter' ? 'pro' : plan === 'pro' ? 'enterprise' : undefined;
    return {
      allowed: false,
      reason: `${plan} plan allows ${limits.maxWorkspaces} workspace(s). Upgrade to add more.`,
      upgradeRequired: upgrade,
    };
  }
  return { allowed: true };
}

export function checkInviteUser(plan: TenantPlan, currentCount: number): PlanCheckResult {
  const limits = PLAN_LIMITS[plan];
  if (currentCount >= limits.maxUsersPerWorkspace) {
    const upgrade = plan === 'starter' ? 'pro' : plan === 'pro' ? 'enterprise' : undefined;
    return {
      allowed: false,
      reason: `${plan} plan allows ${limits.maxUsersPerWorkspace} users per workspace.`,
      upgradeRequired: upgrade,
    };
  }
  return { allowed: true };
}

export function checkAddStores(
  plan: TenantPlan,
  currentCount: number,
  adding: number,
): PlanCheckResult {
  const limits = PLAN_LIMITS[plan];
  if (currentCount + adding > limits.maxStoresPerWorkspace) {
    return {
      allowed: false,
      reason: `${plan} plan allows ${limits.maxStoresPerWorkspace} stores per workspace.`,
      upgradeRequired: plan === 'starter' ? 'pro' : plan === 'pro' ? 'enterprise' : undefined,
    };
  }
  return { allowed: true };
}

export function checkCustomBranding(plan: TenantPlan): PlanCheckResult {
  if (!PLAN_LIMITS[plan].customBranding) {
    return {
      allowed: false,
      reason: 'Custom branding requires Pro plan or higher.',
      upgradeRequired: 'pro',
    };
  }
  return { allowed: true };
}

export function checkCustomDomain(plan: TenantPlan): PlanCheckResult {
  if (!PLAN_LIMITS[plan].customDomain) {
    return {
      allowed: false,
      reason: 'Custom domain requires Enterprise plan.',
      upgradeRequired: 'enterprise',
    };
  }
  return { allowed: true };
}

export function checkWhiteLabel(plan: TenantPlan): PlanCheckResult {
  if (!PLAN_LIMITS[plan].whiteLabel) {
    return {
      allowed: false,
      reason: 'White-label (hide "Powered by AROS") requires Enterprise plan.',
      upgradeRequired: 'enterprise',
    };
  }
  return { allowed: true };
}

// ── Branding Factory ──────────────────────────────────────────────

export function createBranding(
  tenantId: string,
  brandingId: string,
  overrides?: Partial<BrandingConfig>,
): BrandingConfig {
  return {
    ...DEFAULT_BRANDING,
    id: brandingId,
    tenantId,
    ...overrides,
  };
}

// ── MIB007 Superadmin Access ──────────────────────────────────────
// MIB is the superadmin — can READ all tenants, workspaces, stores,
// agents, members. CANNOT write to tenant/workspace data.

export interface MibTenantView {
  tenant: Tenant;
  workspaces: Workspace[];
  totalStores: number;
  totalUsers: number;
  totalAgents: number;
  plan: TenantPlan;
  onboardingComplete: boolean;
  branding?: BrandingConfig;
  monthlyRevenue: number; // calculated from plan + store count
}

export function calculateMRR(plan: TenantPlan, storeCount: number): number {
  const prices: Record<TenantPlan, number> = {
    free: 0,
    starter: 49,
    pro: 99,
    enterprise: 299,
  };
  return prices[plan] * storeCount;
}

// ── Helpers ───────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

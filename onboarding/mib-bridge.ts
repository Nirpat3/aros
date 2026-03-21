// ── MIB007 Superadmin Bridge ──────────────────────────────────────
// MIB is the superadmin of AROS and all deployed platforms.
// MIB has READ access to every tenant, workspace, store, agent.
// MIB has WRITE access ONLY for: provisioning, plan management,
// marketplace catalog, agent fleet updates.
//
// Tenant/workspace data (stores, transactions, settings) = READ ONLY.

import type {
  Tenant,
  TenantPlan,
  Workspace,
  WorkspaceMember,
  WorkspaceStore,
  WorkspaceAgent,
  BrandingConfig,
} from './types.js';
import { calculateMRR, type MibTenantView } from './workspace.js';

// ── MIB Access Control ────────────────────────────────────────────

export type MibPermission =
  | 'tenants:read'
  | 'tenants:provision'
  | 'tenants:plan'
  | 'workspaces:read'
  | 'stores:read'
  | 'agents:read'
  | 'agents:deploy'
  | 'marketplace:manage'
  | 'crm:read'
  | 'crm:write'
  | 'billing:read'
  | 'billing:manage';

export const MIB_PERMISSIONS: MibPermission[] = [
  'tenants:read',
  'tenants:provision',
  'tenants:plan',
  'workspaces:read',
  'stores:read',
  'agents:read',
  'agents:deploy',
  'marketplace:manage',
  'crm:read',
  'crm:write',
  'billing:read',
  'billing:manage',
];

// Things MIB can NEVER do to tenant/workspace data
export const MIB_DENIED = [
  'workspaces:write',       // cannot modify workspace settings
  'stores:write',           // cannot modify store data
  'transactions:read',      // cannot see raw POS transactions
  'credentials:read',       // cannot see POS API keys
  'users:impersonate',      // cannot log in as tenant user
] as const;

// ── CRM Lead → Tenant Pipeline ───────────────────────────────────

export interface CrmLead {
  id: number;
  name: string;
  email: string;
  company: string;
  title?: string;
  phone?: string;
  storeCount?: string;
  posSystem?: string;
  inquiryType: string;
  plan?: string;
  message?: string;
  source: string;
  status: string;
  submittedAt: string;
}

export interface CrmToTenantMapping {
  leadId: number;
  tenantId?: string;
  workspaceId?: string;
  status: 'lead' | 'provisioning' | 'active' | 'churned';
  convertedAt?: string;
}

/** Map a CRM lead to a tenant plan based on their inquiry. */
export function suggestPlan(lead: CrmLead): TenantPlan {
  if (lead.plan === 'enterprise' || lead.inquiryType === 'enterprise') return 'enterprise';
  if (lead.plan === 'pro') return 'pro';
  if (lead.plan === 'starter') return 'starter';
  if (lead.inquiryType === 'self-hosted') return 'free';

  // Infer from store count
  const count = lead.storeCount || '';
  if (count.includes('500') || count.includes('101')) return 'enterprise';
  if (count.includes('21') || count.includes('6')) return 'pro';
  return 'starter';
}

// ── MIB Dashboard Data ────────────────────────────────────────────

export interface MibDashboardStats {
  totalTenants: number;
  totalWorkspaces: number;
  totalStores: number;
  totalUsers: number;
  totalAgents: number;
  mrr: number;
  arr: number;

  // Pipeline from CRM
  leadsNew: number;
  leadsContacted: number;
  leadsQualified: number;
  leadsPilot: number;
  leadsConverted: number;

  // By plan
  tenantsByPlan: Record<TenantPlan, number>;

  // Recent activity
  recentSignups: CrmLead[];
  recentProvisions: MibTenantView[];
}

export interface MibCustomerListItem {
  // From CRM (lead stage)
  lead?: CrmLead;

  // From tenant (active customer)
  tenant?: Tenant;
  workspaces: Workspace[];
  totalStores: number;
  totalUsers: number;
  totalAgents: number;
  mrr: number;
  branding?: BrandingConfig;

  // Unified status
  stage: 'lead' | 'pilot' | 'active' | 'churned';
  displayName: string;
  displayEmail: string;
  plan: TenantPlan;
  onboardingComplete: boolean;
}

/** Build a unified customer list from CRM leads + active tenants. */
export function buildCustomerList(
  leads: CrmLead[],
  tenants: MibTenantView[],
  mappings: CrmToTenantMapping[],
): MibCustomerListItem[] {
  const items: MibCustomerListItem[] = [];
  const mappedLeadIds = new Set(mappings.filter(m => m.tenantId).map(m => m.leadId));

  // Active tenants first
  for (const tv of tenants) {
    const mapping = mappings.find(m => m.tenantId === tv.tenant.id);
    const lead = mapping ? leads.find(l => l.id === mapping.leadId) : undefined;

    items.push({
      lead,
      tenant: tv.tenant,
      workspaces: tv.workspaces,
      totalStores: tv.totalStores,
      totalUsers: tv.totalUsers,
      totalAgents: tv.totalAgents,
      mrr: tv.monthlyRevenue,
      branding: tv.branding,
      stage: tv.tenant.onboardingComplete ? 'active' : 'pilot',
      displayName: tv.tenant.name,
      displayEmail: lead?.email ?? '',
      plan: tv.tenant.plan,
      onboardingComplete: tv.tenant.onboardingComplete,
    });
  }

  // Unconverted leads
  for (const lead of leads) {
    if (mappedLeadIds.has(lead.id)) continue;
    if (lead.status === 'converted') continue;

    items.push({
      lead,
      workspaces: [],
      totalStores: 0,
      totalUsers: 0,
      totalAgents: 0,
      mrr: 0,
      stage: 'lead',
      displayName: lead.company,
      displayEmail: lead.email,
      plan: suggestPlan(lead),
      onboardingComplete: false,
    });
  }

  return items;
}

export interface ConfigField {
  type: 'string' | 'number' | 'boolean' | 'select';
  required?: boolean;
  label: string;
  placeholder?: string;
  secret?: boolean;
  default?: unknown;
  options?: { label: string; value: string }[];
  description?: string;
}

export interface Node {
  id: string;
  name: string;
  version: string;
  description: string;
  category: NodeCategory;
  author: string;
  registry: string;
  packageName: string;
  icon?: string;
  screenshots?: string[];
  pricing: NodePricing;
  capabilities: string[];
  requiredPlatformVersion: string;
  publishedAt: string;
  updatedAt: string;
  configSchema?: Record<string, ConfigField>;
  storeDiscovery?: boolean;
  status?: 'live' | 'beta' | 'coming-soon' | 'planned';
}

export type NodeCategory =
  | 'pos'
  | 'pos-connector'
  | 'inventory'
  | 'analytics'
  | 'loyalty'
  | 'marketing'
  | 'payments'
  | 'shipping'
  | 'crm'
  | 'reporting'
  | 'database'
  | 'integration'
  | 'utility';

export interface NodePricing {
  model: 'free' | 'one-time' | 'subscription';
  price?: number;
  currency?: string;
  interval?: 'monthly' | 'yearly';
}

export interface InstalledNode {
  node: Node;
  installedVersion: string;
  installedAt: string;
  enabled: boolean;
  config: Record<string, unknown>;
}

export interface RegistryResponse {
  nodes: Node[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InstallResult {
  success: boolean;
  node: Node;
  error?: string;
}

// ── Plugin Submission & Review (Apple-style) ─────────────────────

export type PluginReviewStatus = 'draft' | 'pending_review' | 'in_review' | 'approved' | 'rejected' | 'published';

export interface PluginSubmission {
  id: string;
  nodeId: string;
  submitterId: string;
  submitterEmail: string;

  // Plugin metadata
  name: string;
  version: string;
  description: string;
  category: NodeCategory;
  changelog?: string;
  packageName: string;
  sourceUrl?: string;
  screenshots?: string[];

  // Demo credentials (required — Apple App Store model)
  demoCredentials: DemoCredentials;

  // Review state
  status: PluginReviewStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  rejectionReason?: string;
  publishedAt?: string;

  // Version tracking
  previousVersionId?: string;
  revisionCount: number;
}

export interface DemoCredentials {
  url: string;
  username: string;
  password: string;
  instructions?: string;   // e.g. "Use store #1 for testing"
  environment: 'sandbox' | 'staging' | 'production';
}

export interface SubmissionCreateInput {
  name: string;
  version: string;
  description: string;
  category: NodeCategory;
  changelog?: string;
  packageName: string;
  sourceUrl?: string;
  screenshots?: string[];
  demoCredentials: DemoCredentials;
}

export interface ReviewAction {
  submissionId: string;
  action: 'approve' | 'reject' | 'request_revision';
  notes?: string;
  rejectionReason?: string;
}

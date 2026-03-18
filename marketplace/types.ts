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
}

export type NodeCategory =
  | 'pos'
  | 'inventory'
  | 'analytics'
  | 'loyalty'
  | 'marketing'
  | 'payments'
  | 'shipping'
  | 'crm'
  | 'reporting'
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

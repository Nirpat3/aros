export type LicenseTier = 'free' | 'business' | 'enterprise' | 'oem';

export interface License {
  tier: LicenseTier;
  maxUsers: number; // 1 for free, unlimited for business+
  whitelabelEnabled: boolean; // false for free/business, true for oem
  byomEnabled: boolean; // true for all tiers
  mib007Metered: boolean; // true = uses MIB007 hosted models (metered)
  licenseKey: string;
  expiresAt: string | null; // null = perpetual
  tenantId: string;
}

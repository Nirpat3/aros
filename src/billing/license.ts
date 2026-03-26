/**
 * AROS Platform — License Provisioning
 *
 * Generates, validates, and looks up license keys tied to tenants.
 * Format: AROS-{TIER}-{16 hex chars}-{4 hex checksum}
 */

import { createHash, randomBytes } from 'node:crypto';
import { createSupabaseAdmin } from '../supabase.js';

export type LicenseTier = 'free' | 'starter' | 'pro' | 'enterprise';

const VALID_TIERS: Set<string> = new Set(['free', 'starter', 'pro', 'enterprise']);
const LICENSE_RE = /^AROS-(free|starter|pro|enterprise)-([a-f0-9]{16})-([a-f0-9]{4})$/;

// ── Checksum ────────────────────────────────────────────────────

function computeChecksum(prefix: string): string {
  return createHash('sha256').update(prefix).digest('hex').slice(0, 4);
}

// ── Generate ────────────────────────────────────────────────────

/**
 * Generate a license key for a tenant and store it in Supabase.
 * @returns The generated license key string
 */
export async function provisionLicense(tenantId: string, tier: LicenseTier): Promise<string> {
  if (!VALID_TIERS.has(tier)) {
    throw new Error(`Invalid license tier: ${tier}`);
  }

  const random16 = randomBytes(8).toString('hex'); // 16 hex chars
  const prefix = `AROS-${tier}-${random16}`;
  const checksum = computeChecksum(prefix);
  const key = `${prefix}-${checksum}`;

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from('tenants')
    .update({
      license_key: key,
      license_tier: tier,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId);

  if (error) {
    throw new Error(`Failed to store license for tenant ${tenantId}: ${error.message}`);
  }

  return key;
}

// ── Validate ────────────────────────────────────────────────────

export interface LicenseValidation {
  valid: boolean;
  tier: LicenseTier | null;
  tenantId: string | null;
  error?: string;
}

/**
 * Validate a license key: checks format, checksum, and existence in Supabase.
 */
export async function validateLicense(key: string): Promise<LicenseValidation> {
  // 1. Format check
  const match = key.match(LICENSE_RE);
  if (!match) {
    return { valid: false, tier: null, tenantId: null, error: 'Invalid license format' };
  }

  const tier = match[1] as LicenseTier;
  const random16 = match[2];
  const providedChecksum = match[3];

  // 2. Checksum verification
  const expectedChecksum = computeChecksum(`AROS-${tier}-${random16}`);
  if (providedChecksum !== expectedChecksum) {
    return { valid: false, tier: null, tenantId: null, error: 'Invalid checksum' };
  }

  // 3. Database lookup
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from('tenants')
    .select('id, license_tier, billing_status')
    .eq('license_key', key)
    .single();

  if (error || !data) {
    return { valid: false, tier, tenantId: null, error: 'License not found in registry' };
  }

  return {
    valid: true,
    tier: data.license_tier as LicenseTier,
    tenantId: data.id,
  };
}

// ── Tier Extraction (offline) ───────────────────────────────────

/**
 * Extract the tier from a license key without database lookup.
 * Only checks format + checksum — does NOT verify the key exists.
 */
export function getLicenseTier(key: string): LicenseTier | null {
  const match = key.match(LICENSE_RE);
  if (!match) return null;

  const tier = match[1] as LicenseTier;
  const random16 = match[2];
  const providedChecksum = match[3];

  const expectedChecksum = computeChecksum(`AROS-${tier}-${random16}`);
  if (providedChecksum !== expectedChecksum) return null;

  return tier;
}

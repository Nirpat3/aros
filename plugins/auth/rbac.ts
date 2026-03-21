import type { TokenPayload, AuthProvider } from './ArosProvider.js';
import type { UserRole } from '../../onboarding/types.js';

// ── Role hierarchy (higher index = more power) ───────────────────

const ROLE_HIERARCHY: UserRole[] = ['viewer', 'manager', 'admin', 'owner', 'superadmin'];

function roleLevel(role: string): number {
  const idx = ROLE_HIERARCHY.indexOf(role as UserRole);
  return idx === -1 ? 0 : idx;
}

// ── Guards ───────────────────────────────────────────────────────

export function isSuperAdmin(payload: TokenPayload): boolean {
  return payload.role === 'superadmin';
}

export function hasRole(payload: TokenPayload, requiredRole: UserRole): boolean {
  if (isSuperAdmin(payload)) return true;
  return roleLevel(payload.role) >= roleLevel(requiredRole);
}

export function hasAnyRole(payload: TokenPayload, roles: UserRole[]): boolean {
  if (isSuperAdmin(payload)) return true;
  return roles.some((r) => payload.role === r);
}

// ── Middleware factory (framework-agnostic) ──────────────────────

export interface RequestWithAuth {
  headers: { authorization?: string; [k: string]: unknown };
}

/**
 * Extracts and validates token from `Authorization: Bearer <token>` header.
 * Returns decoded payload or null.
 */
export async function authenticateRequest(
  req: RequestWithAuth,
  provider: AuthProvider,
): Promise<TokenPayload | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return await provider.validate(header.slice(7));
  } catch {
    return null;
  }
}

/**
 * Returns a guard function that checks minimum role.
 *
 * Usage:
 * ```ts
 * const requireAdmin = requireRole('admin', provider);
 * // In request handler:
 * const payload = await requireAdmin(req);
 * if (!payload) return res.status(403).json({ error: 'Forbidden' });
 * ```
 */
export function requireRole(role: UserRole, provider: AuthProvider) {
  return async (req: RequestWithAuth): Promise<TokenPayload | null> => {
    const payload = await authenticateRequest(req, provider);
    if (!payload) return null;
    if (!hasRole(payload, role)) return null;
    return payload;
  };
}

/**
 * Superadmin bypasses all feature flags.
 * Call this in the WhitelabelProvider to override feature gating.
 */
export function superadminFeatureOverride(
  features: Record<string, boolean | undefined>,
  payload: TokenPayload | null,
): Record<string, boolean | undefined> {
  if (!payload || !isSuperAdmin(payload)) return features;
  // Enable everything for superadmin
  const overridden = { ...features };
  for (const key of Object.keys(overridden)) {
    overridden[key] = true;
  }
  return overridden;
}

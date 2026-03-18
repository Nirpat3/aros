/**
 * AROS Platform — Entry Point
 *
 * License enforcement runs first, before any services or plugins load.
 */

// ── License enforcement (must be first) ──────────────────────────────────
import { enforceBootGuard } from './licensing/boot-guard.js';

const bootResult = enforceBootGuard();

// ── Re-export licensing public API ───────────────────────────────────────
export { getLicenseInfo, hasFeature } from './licensing/index.js';
export type { AROSLicense, LicenseTier, BootGuardResult } from './licensing/index.js';

// ── Platform boot continues below ───────────────────────────────────────
// TODO: Initialize services, load plugins, start connectors, etc.
// All subsequent code can safely assume a valid license is present.

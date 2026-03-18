import type { VersionManifest, SemVer } from '../versioning/types.js';

let _cache: { manifest: VersionManifest; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch the latest release manifest from the update feed.
 * Caches the result for 30 minutes.
 */
export async function fetchManifest(feedUrl: string): Promise<VersionManifest> {
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS) {
    return _cache.manifest;
  }

  const url = `${feedUrl}/latest.json`;
  console.log(`[manifest] Fetching ${url}`);

  const res = await fetch(url, {
    headers: { 'User-Agent': 'aros-platform-updater' },
  });

  if (!res.ok) {
    throw new Error(`[manifest] Registry returned ${res.status}: ${res.statusText}`);
  }

  const manifest = (await res.json()) as VersionManifest;

  if (!verifySignature(manifest)) {
    throw new Error('[manifest] Signature verification failed');
  }

  _cache = { manifest, fetchedAt: Date.now() };
  return manifest;
}

/**
 * Fetch a specific version's manifest from the update feed.
 */
export async function fetchSpecificVersion(feedUrl: string, version: SemVer): Promise<VersionManifest> {
  const url = `${feedUrl}/${version}.json`;
  console.log(`[manifest] Fetching ${url}`);

  const res = await fetch(url, {
    headers: { 'User-Agent': 'aros-platform-updater' },
  });

  if (!res.ok) {
    throw new Error(`[manifest] Registry returned ${res.status} for version ${version}`);
  }

  const manifest = (await res.json()) as VersionManifest;

  if (!verifySignature(manifest)) {
    throw new Error('[manifest] Signature verification failed');
  }

  return manifest;
}

/**
 * Verify the manifest signature.
 * Stub — always returns true. Real implementation will use Ed25519 or similar.
 */
export function verifySignature(_manifest: VersionManifest): boolean {
  return true;
}

/** Clear the manifest cache (useful for testing or force-refresh). */
export function clearCache(): void {
  _cache = null;
}

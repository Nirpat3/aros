import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface ArosConfig {
  platform: { version: string };
  core: {
    source: string;
    version: string;
    autoUpdate: boolean;
    updateFeed: string;
    channel: string;
  };
}

interface Release {
  version: string;
  channel: string;
  sha256: string;
  releaseNotes: string;
  publishedAt: string;
  minPlatformVersion: string;
}

interface UpdateCheckResult {
  available: boolean;
  current: string;
  latest: string;
  release: Release | null;
}

const CONFIG_PATH = join(process.cwd(), 'aros.config.json');

function loadConfig(): ArosConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

/**
 * Check the MIB007 registry for available core updates.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const config = loadConfig();
  const { updateFeed, channel, version: current } = config.core;

  const url = `${updateFeed}?channel=${channel}&current=${current}`;
  console.log(`[updater] Checking for updates: ${url}`);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': `aros-platform/${config.platform.version}` },
    });

    if (!res.ok) {
      console.warn(`[updater] Registry returned ${res.status}`);
      return { available: false, current, latest: current, release: null };
    }

    const data = (await res.json()) as { releases: Release[] };
    const releases = data.releases ?? [];

    // Find latest release on the configured channel
    const eligible = releases
      .filter((r) => r.channel === channel)
      .filter((r) => compareVersions(r.minPlatformVersion, config.platform.version) <= 0)
      .sort((a, b) => compareVersions(b.version, a.version));

    const latest = eligible[0];
    if (!latest || compareVersions(latest.version, current) <= 0) {
      console.log(`[updater] Already on latest: ${current}`);
      return { available: false, current, latest: current, release: null };
    }

    console.log(`[updater] Update available: ${current} → ${latest.version}`);
    return { available: true, current, latest: latest.version, release: latest };
  } catch (err) {
    console.error(`[updater] Failed to check for updates:`, err);
    return { available: false, current, latest: current, release: null };
  }
}

/**
 * Pin a new core version in aros.config.json.
 */
export function pinVersion(version: string): void {
  const config = loadConfig();
  config.core.version = version;
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
  console.log(`[updater] Pinned core version to ${version}`);
}

// CLI entrypoint
if (process.argv[1]?.endsWith('updater/index.ts')) {
  checkForUpdates().then((result) => {
    if (result.available && result.release) {
      console.log(`\nUpdate available: ${result.current} → ${result.latest}`);
      console.log(`Release notes: ${result.release.releaseNotes}`);
      console.log(`\nRun 'pnpm update:apply' to install this update.`);
    } else {
      console.log('\nNo updates available.');
    }
  });
}

import type { SemVer } from './types.js';

export function parse(version: string): { major: number; minor: number; patch: number } {
  const parts = version.split('.').map(Number);
  return { major: parts[0] ?? 0, minor: parts[1] ?? 0, patch: parts[2] ?? 0 };
}

export function compare(a: SemVer, b: SemVer): -1 | 0 | 1 {
  const pa = parse(a);
  const pb = parse(b);
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (pa[key] > pb[key]) return 1;
    if (pa[key] < pb[key]) return -1;
  }
  return 0;
}

export function isNewer(candidate: SemVer, current: SemVer): boolean {
  return compare(candidate, current) === 1;
}

export function bumpType(from: SemVer, to: SemVer): 'major' | 'minor' | 'patch' {
  const f = parse(from);
  const t = parse(to);
  if (t.major !== f.major) return 'major';
  if (t.minor !== f.minor) return 'minor';
  return 'patch';
}

/**
 * Check if a version satisfies a range string.
 * Supports: exact ("1.2.3"), caret ("^1.2.0"), tilde ("~1.2.0"), wildcard ("1.2.x", "1.x").
 */
export function satisfies(version: SemVer, range: string): boolean {
  const v = parse(version);

  // Exact match
  if (/^\d+\.\d+\.\d+$/.test(range)) {
    return compare(version, range as SemVer) === 0;
  }

  // Caret range: ^major.minor.patch — compatible with major
  if (range.startsWith('^')) {
    const r = parse(range.slice(1));
    if (v.major !== r.major) return false;
    return compare(version, range.slice(1) as SemVer) >= 0;
  }

  // Tilde range: ~major.minor.patch — compatible with minor
  if (range.startsWith('~')) {
    const r = parse(range.slice(1));
    if (v.major !== r.major || v.minor !== r.minor) return false;
    return v.patch >= r.patch;
  }

  // Wildcard: 1.2.x or 1.x
  if (range.includes('x')) {
    const parts = range.split('.');
    if (parts[0] !== undefined && parts[0] !== 'x' && v.major !== Number(parts[0])) return false;
    if (parts[1] !== undefined && parts[1] !== 'x' && v.minor !== Number(parts[1])) return false;
    return true;
  }

  // Fallback: treat as exact
  return version === range;
}

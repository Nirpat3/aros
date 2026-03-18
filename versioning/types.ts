export type SemVer = `${number}.${number}.${number}`;
export type UpdateChannel = "stable" | "beta" | "edge";
export type UpdatePolicy = "auto" | "notify" | "off" | "ignore";

export interface VersionManifest {
  version: SemVer;
  releasedAt: string;
  channel: UpdateChannel;
  minArosVersion: SemVer;
  packages: {
    core: PackageRelease;
    ui: PackageRelease;
  };
  signature: string;
}

export interface PackageRelease {
  package: string;
  version: SemVer;
  breaking: boolean;
  migrationGuide?: string;
  changelog: ChangelogEntry[];
  whitelabelNote?: string;
}

export interface ChangelogEntry {
  type: "feat" | "fix" | "perf" | "style" | "breaking" | "security";
  scope?: string;
  message: string;
}

export interface UpdateHistoryEntry {
  timestamp: string;
  type: "core" | "ui";
  fromVersion: SemVer;
  toVersion: SemVer;
  status: "applied" | "ignored" | "skipped" | "failed" | "rolled-back";
  auto: boolean;
  reason?: string;
  appliedBy?: string;
}

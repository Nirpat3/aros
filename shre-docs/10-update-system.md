# 10 — AROS Update System

## 1. Two-Channel Update Model

AROS splits updates into two independent channels:

| Channel | Package | What It Contains | Why Separate |
|---------|---------|------------------|--------------|
| **Core** | `@mib007/core` | Engine, marketplace runtime, data layer, APIs | Business logic — always safe to update |
| **UI** | `@mib007/ui` | React components, layouts, CSS, dashboard | Visual layer — whitelabeled deployments may want to skip |

Separating core and UI lets whitelabeled operators freeze their custom theme while still receiving engine fixes, security patches, and marketplace updates.

---

## 2. Release Manifest Format

Every release is described by a **VersionManifest** JSON file served from the update feed.

```jsonc
{
  // Top-level metadata
  "version": "1.2.0",                     // SemVer — the release version
  "releasedAt": "2026-03-18T00:00:00Z",   // ISO 8601 timestamp
  "channel": "stable",                     // "stable" | "beta" | "edge"
  "minArosVersion": "0.1.0",              // Minimum platform version required
  "signature": "sha256:abc123...",         // Release signature (verified by updater)

  "packages": {
    "core": {
      "package": "@mib007/core",           // npm package name
      "version": "1.2.0",                 // Package-level SemVer
      "breaking": false,                  // true if contains breaking changes
      "migrationGuide": "https://...",     // Optional — link to migration docs
      "changelog": [                       // Array of ChangelogEntry
        {
          "type": "feat",                  // "feat" | "fix" | "perf" | "style" | "breaking" | "security"
          "scope": "marketplace",          // Optional scope tag
          "message": "Added bulk node install"
        }
      ]
    },
    "ui": {
      "package": "@mib007/ui",
      "version": "1.2.0",
      "breaking": false,
      "changelog": [
        { "type": "feat", "scope": "dashboard", "message": "New analytics widget" }
      ],
      "whitelabelNote": "Adds new sidebar layout — may override custom CSS."
    }
  }
}
```

Manifests are served at:
- `{feedUrl}/latest.json` — always points to the newest stable release
- `{feedUrl}/{version}.json` — specific version (e.g., `1.2.0.json`)

---

## 3. Update Policies

Each channel (core and UI) has an independent **UpdatePolicy**:

| Policy | Behavior |
|--------|----------|
| `auto` | Automatically download and apply updates matching the auto-apply rules |
| `notify` | Check for updates and show notifications; require manual approval to apply |
| `off` | Disable update checking entirely (air-gapped / locked deployments) |
| `ignore` | (UI only) Permanently skip all UI updates — used for fully whitelabeled deployments |

### Auto-apply rules (core channel)

| Setting | Effect |
|---------|--------|
| `autoApplyPatch: true` | Patch bumps (x.x.N) are auto-applied |
| `autoApplyMinor: true` | Minor bumps (x.N.0) are auto-applied |
| `requireManualMajor: true` | Major bumps (N.0.0) always require manual approval |

### UI-specific settings

| Setting | Effect |
|---------|--------|
| `ignoreIfWhitelabeled: true` | Auto-ignore UI updates when `whitelabel.active !== "default"` |
| `previewBeforeApply: true` | Show component preview before applying UI changes |

---

## 4. Decision Matrix

Recommended policy configuration by deployment type:

| Deployment Type | Core Policy | UI Policy | Notes |
|----------------|-------------|-----------|-------|
| Default AROS | `notify` | `notify` | Standard — admin reviews all updates |
| Whitelabeled | `notify` | `ignore` (auto) | `ignoreIfWhitelabeled` activates automatically |
| Air-gapped | `off` | `off` | No network access; use manual update process |
| Enterprise | `notify` | `ignore` | Custom UI locked; core patched manually |
| Beta tester | `notify` + auto-apply | `notify` | Core auto-patches; UI reviewed manually |
| Development | `auto` | `auto` | Everything auto-applied for dev/staging |

---

## 5. Semver Rules per Policy

How each bump type is handled depending on the active policy:

| Bump Type | `auto` | `notify` | `off` / `ignore` |
|-----------|--------|----------|-------------------|
| **Patch** (1.0.0 → 1.0.1) | Auto-apply (if `autoApplyPatch`) | Notification shown | Ignored |
| **Minor** (1.0.0 → 1.1.0) | Auto-apply (if `autoApplyMinor`) | Notification shown | Ignored |
| **Major** (1.0.0 → 2.0.0) | Blocked (`requireManualMajor`) | Notification + "I understand" checkbox | Ignored |

Major updates always require explicit acknowledgment in the Update Center, even with `auto` policy.

---

## 6. UI Preview Flow

When `previewBeforeApply` is enabled:

1. Update Center shows "UI Update Available" card
2. Admin clicks **Preview Changes**
3. Expandable panel shows:
   - Full changelog (color-coded by type: feat/fix/perf/security)
   - Affected component scopes
   - Whitelabel warning if `whitelabelNote` exists in the manifest
4. Admin reviews and clicks **Apply UI Update** or **Skip**
5. On apply: `pnpm update @mib007/ui@{version}` runs, config updated, history recorded

---

## 7. Whitelabel + UI Updates

When a deployment has a custom whitelabel theme (`whitelabel.active !== "default"`):

- If `ignoreIfWhitelabeled: true` — all UI updates are silently ignored
- If UI policy is `notify` — the Update Center shows a warning banner:
  > "You have a custom theme — layout changes will apply over your branding."
- Theme files in `whitelabel/{name}/theme.json` are **never** overwritten by UI updates
- UI updates only replace `@mib007/ui` package code (React components, CSS)
- Custom component overrides in the whitelabel config take precedence over base UI

**Best practice**: Whitelabeled deployments should set UI policy to `ignore` and manually evaluate each UI release for compatibility with their custom theme.

---

## 8. History Tracking

All update actions are logged to `updater/history.json`:

```json
[
  {
    "timestamp": "2026-03-18T14:30:00Z",
    "type": "core",
    "fromVersion": "1.0.0",
    "toVersion": "1.0.1",
    "status": "applied",
    "auto": true
  },
  {
    "timestamp": "2026-03-18T14:31:00Z",
    "type": "ui",
    "fromVersion": "1.0.0",
    "toVersion": "1.0.1",
    "status": "skipped",
    "auto": false,
    "reason": "Whitelabel conflict — waiting for theme update"
  }
]
```

### Status values

| Status | Meaning |
|--------|---------|
| `applied` | Update was successfully installed |
| `skipped` | Admin chose to skip this version |
| `ignored` | Policy auto-ignored this update |
| `failed` | Installation or health check failed |
| `rolled-back` | Applied but then reverted |

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | ISO 8601 | When the action occurred |
| `type` | `"core"` \| `"ui"` | Which channel |
| `fromVersion` | SemVer | Version before the action |
| `toVersion` | SemVer | Target version |
| `status` | string | Outcome (see above) |
| `auto` | boolean | Whether the action was automatic or manual |
| `reason` | string? | Optional explanation for skip/ignore/fail |
| `appliedBy` | string? | Who triggered it (admin username or "scheduler") |

---

## 9. Rollback

Core and UI can be rolled back independently:

### Core rollback
1. The updater backs up `aros.config.json` before every core update
2. On failure, rollback restores the backup config and reinstalls the previous `@mib007/core` version
3. Manual rollback: `pnpm add @mib007/core@{previous-version} --filter @aros/core`
4. Update `aros.config.json` → `core.version` to match

### UI rollback
1. `pnpm add @mib007/ui@{previous-version}`
2. Update `aros.config.json` → `core.uiVersion` to match
3. No config backup needed — UI changes are package-only

### History
Rolled-back updates are recorded with `status: "rolled-back"` in history.json.

---

## 10. Air-Gap / Offline Manual Update

For deployments without internet access:

1. **Download** the release manifest and packages on a connected machine:
   ```bash
   curl https://registry.mib007.io/releases/1.2.0.json -o 1.2.0.json
   npm pack @mib007/core@1.2.0
   npm pack @mib007/ui@1.2.0
   ```

2. **Transfer** the `.tgz` files and manifest to the air-gapped host

3. **Install** manually:
   ```bash
   pnpm add ./mib007-core-1.2.0.tgz --filter @aros/core
   pnpm add ./mib007-ui-1.2.0.tgz
   ```

4. **Update config**:
   - Set `core.version` to `"1.2.0"` in `aros.config.json`
   - Set `core.uiVersion` to `"1.2.0"`

5. **Verify**: Run `pnpm build` and check health endpoints

6. Set `updates.core.policy` and `updates.ui.policy` to `"off"` to suppress connection warnings

---

## 11. CHANGELOG.md Authoring Guide

When publishing a new MIB007 release:

1. **Add entries** to `mib007/releases/CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/) format
2. **Create a version manifest** at `mib007/releases/{version}.json` matching the VersionManifest schema
3. **Copy to latest**: Update `mib007/releases/latest.json` to match the new version
4. **Sign the release**: Set the `signature` field (placeholder until signing is implemented)

### Changelog entry types

| Type | Color in UI | When to Use |
|------|-------------|-------------|
| `feat` | Blue | New functionality |
| `fix` | Green | Bug fix |
| `perf` | Purple | Performance improvement |
| `style` | Gray | Visual / CSS change |
| `breaking` | Red | Backwards-incompatible change |
| `security` | Amber | Security fix |

### Scope conventions

Use consistent scope tags: `core`, `marketplace`, `registry`, `ui`, `dashboard`, `chat`, `auth`, `api`.

---

## 12. Admin Panel Walkthrough — Update Center

The Update Center (`/updates`) is the admin interface for managing all platform updates.

### Sections

1. **Version Status Card** (always visible)
   - Shows current Platform, Core, and UI versions
   - "Last checked" timestamp with **Check Now** button
   - Status badge: green "Up to date", amber "Updates available", or gray "Checking..."

2. **Core Update Card** (shown when core update is available)
   - Displays version transition: `v1.0.0 → v1.1.0`
   - Bump type badge: PATCH (green), MINOR (blue), MAJOR (red)
   - Expandable changelog with color-coded entries
   - Breaking change warning banner (red, with migration guide link)
   - For MAJOR updates: "I understand" checkbox must be checked before Apply
   - **Apply Core Update** button + **Skip This Version** link

3. **UI Update Card** (shown when UI update is available, policy != ignore)
   - Same version transition display
   - Whitelabel warning banner (amber) if custom theme is active
   - Expandable changelog
   - **Preview Changes** toggle: shows affected component list
   - **Apply UI Update** | **Skip** | **Ignore All UI Updates**

4. **Update History Table**
   - Columns: Date, Type (Core/UI badge), From → To, Status (color-coded), Auto/Manual
   - Shows last 20 entries, newest first
   - **Export History** button (downloads JSON)

5. **Update Settings Panel** (collapsible)
   - Core: policy dropdown, auto-apply patch/minor toggles
   - UI: policy dropdown, ignore-if-whitelabeled toggle, preview toggle
   - Check interval selector (15min / 30min / 1h / 6h / manual only)
   - **Save Settings** button

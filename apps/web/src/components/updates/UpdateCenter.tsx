import { useState } from 'react';

import type { SemVer, VersionManifest, UpdateHistoryEntry, ChangelogEntry, UpdatePolicy } from '../../../../../versioning/types';

// ─── Props ───────────────────────────────────────────────────────────────────

interface UpdateSettings {
  core: {
    policy: UpdatePolicy;
    channel: string;
    autoApplyPatch: boolean;
    autoApplyMinor: boolean;
    requireManualMajor: boolean;
  };
  ui: {
    policy: UpdatePolicy;
    ignoreIfWhitelabeled: boolean;
    previewBeforeApply: boolean;
  };
  checkIntervalMinutes: number;
}

interface CurrentVersions {
  platform: SemVer;
  core: SemVer;
  ui: SemVer;
}

interface UpdateCenterProps {
  currentVersions: CurrentVersions;
  latestManifest: VersionManifest | null;
  history: UpdateHistoryEntry[];
  settings: UpdateSettings;
  onApplyCore: (manifest: VersionManifest) => void;
  onApplyUi: (manifest: VersionManifest) => void;
  onSkip: (type: 'core' | 'ui', manifest: VersionManifest) => void;
  onSaveSettings: (settings: UpdateSettings) => void;
  onCheckNow: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bumpType(from: string, to: string): 'major' | 'minor' | 'patch' {
  const f = from.split('.').map(Number);
  const t = to.split('.').map(Number);
  if (t[0] !== f[0]) return 'major';
  if (t[1] !== f[1]) return 'minor';
  return 'patch';
}

function isNewer(candidate: string, current: string): boolean {
  const a = candidate.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  return false;
}

const BUMP_COLORS: Record<string, string> = {
  major: 'bg-red-100 text-red-800 border-red-200',
  minor: 'bg-blue-100 text-blue-800 border-blue-200',
  patch: 'bg-green-100 text-green-800 border-green-200',
};

const ENTRY_COLORS: Record<ChangelogEntry['type'], string> = {
  feat: 'text-blue-600',
  fix: 'text-green-600',
  perf: 'text-purple-600',
  style: 'text-gray-600',
  breaking: 'text-red-600',
  security: 'text-amber-600',
};

const STATUS_COLORS: Record<string, string> = {
  applied: 'text-green-600',
  ignored: 'text-gray-400',
  skipped: 'text-amber-500',
  failed: 'text-red-600',
  'rolled-back': 'text-red-500',
};

const INTERVAL_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '6 hours', value: 360 },
  { label: 'Manual only', value: 0 },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function UpdateCenter({
  currentVersions,
  latestManifest,
  history,
  settings,
  onApplyCore,
  onApplyUi,
  onSkip,
  onSaveSettings,
  onCheckNow,
}: UpdateCenterProps) {
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [coreChangelogOpen, setCoreChangelogOpen] = useState(false);
  const [uiChangelogOpen, setUiChangelogOpen] = useState(false);
  const [uiPreviewOpen, setUiPreviewOpen] = useState(false);
  const [majorAcknowledged, setMajorAcknowledged] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<UpdateSettings>(settings);

  const coreAvailable = latestManifest && isNewer(latestManifest.packages.core.version, currentVersions.core);
  const uiAvailable = latestManifest && isNewer(latestManifest.packages.ui.version, currentVersions.ui);
  const coreBump = coreAvailable ? bumpType(currentVersions.core, latestManifest!.packages.core.version) : null;
  const uiBump = uiAvailable ? bumpType(currentVersions.ui, latestManifest!.packages.ui.version) : null;

  const handleCheckNow = () => {
    setChecking(true);
    onCheckNow();
    setTimeout(() => {
      setChecking(false);
      setLastChecked(new Date().toLocaleString());
    }, 2000);
  };

  const statusLabel = checking
    ? 'Checking...'
    : coreAvailable || uiAvailable
      ? 'Updates available'
      : 'Up to date';

  const statusIcon = checking ? '...' : coreAvailable || uiAvailable ? '\u{1F514}' : '\u2713';
  const statusColor = checking
    ? 'text-gray-500'
    : coreAvailable || uiAvailable
      ? 'text-amber-600'
      : 'text-green-600';

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-900">Update Center</h1>

      {/* ── Version Status Card ── */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Version Status</h2>
          <span className={`font-medium ${statusColor}`}>
            {statusIcon} {statusLabel}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <span className="text-sm text-gray-500">Platform</span>
            <p className="font-mono font-semibold">v{currentVersions.platform}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Core</span>
            <p className="font-mono font-semibold">v{currentVersions.core}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">UI</span>
            <p className="font-mono font-semibold">v{currentVersions.ui}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">
            {lastChecked ? `Last checked: ${lastChecked}` : 'Not checked yet'}
          </span>
          <button
            onClick={handleCheckNow}
            disabled={checking}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {checking ? 'Checking...' : 'Check Now'}
          </button>
        </div>
      </div>

      {/* ── Core Update Card ── */}
      {coreAvailable && latestManifest && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">
              Core Update Available: v{currentVersions.core} &rarr; v{latestManifest.packages.core.version}
            </h2>
            <span className={`px-2 py-1 text-xs font-bold uppercase rounded border ${BUMP_COLORS[coreBump!]}`}>
              {coreBump}
            </span>
          </div>

          {latestManifest.packages.core.breaking && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-3">
              <p className="text-red-800 text-sm font-medium">
                &#9888; Breaking changes — review the changelog and migration guide before applying.
              </p>
            </div>
          )}

          {latestManifest.packages.core.migrationGuide && (
            <a
              href={latestManifest.packages.core.migrationGuide}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 text-sm underline mb-3 inline-block"
            >
              View Migration Guide &rarr;
            </a>
          )}

          <button
            onClick={() => setCoreChangelogOpen(!coreChangelogOpen)}
            className="text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            {coreChangelogOpen ? '\u25BC' : '\u25B6'} Changelog ({latestManifest.packages.core.changelog.length} entries)
          </button>

          {coreChangelogOpen && (
            <ul className="ml-4 mb-4 space-y-1">
              {latestManifest.packages.core.changelog.map((entry, i) => (
                <li key={i} className="text-sm">
                  <span className={`font-medium ${ENTRY_COLORS[entry.type]}`}>[{entry.type}]</span>
                  {entry.scope && <span className="text-gray-400"> ({entry.scope})</span>}
                  {' '}{entry.message}
                </li>
              ))}
            </ul>
          )}

          {coreBump === 'major' && (
            <label className="flex items-center gap-2 mb-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={majorAcknowledged}
                onChange={(e) => setMajorAcknowledged(e.target.checked)}
                className="rounded border-gray-300"
              />
              I understand this is a major update and have reviewed breaking changes
            </label>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => onApplyCore(latestManifest)}
              disabled={coreBump === 'major' && !majorAcknowledged}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Apply Core Update
            </button>
            <button
              onClick={() => onSkip('core', latestManifest)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Skip This Version
            </button>
          </div>
        </div>
      )}

      {/* ── UI Update Card ── */}
      {uiAvailable && latestManifest && settings.ui.policy !== 'ignore' && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">
              UI Update Available: v{currentVersions.ui} &rarr; v{latestManifest.packages.ui.version}
            </h2>
            {uiBump && (
              <span className={`px-2 py-1 text-xs font-bold uppercase rounded border ${BUMP_COLORS[uiBump]}`}>
                {uiBump}
              </span>
            )}
          </div>

          {latestManifest.packages.ui.whitelabelNote && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-3">
              <p className="text-amber-800 text-sm">
                &#9888; You have a custom theme — layout changes will apply over your branding.
              </p>
            </div>
          )}

          <button
            onClick={() => setUiChangelogOpen(!uiChangelogOpen)}
            className="text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            {uiChangelogOpen ? '\u25BC' : '\u25B6'} Changelog ({latestManifest.packages.ui.changelog.length} entries)
          </button>

          {uiChangelogOpen && (
            <ul className="ml-4 mb-4 space-y-1">
              {latestManifest.packages.ui.changelog.map((entry, i) => (
                <li key={i} className="text-sm">
                  <span className={`font-medium ${ENTRY_COLORS[entry.type]}`}>[{entry.type}]</span>
                  {entry.scope && <span className="text-gray-400"> ({entry.scope})</span>}
                  {' '}{entry.message}
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={() => setUiPreviewOpen(!uiPreviewOpen)}
            className="text-sm text-blue-600 hover:text-blue-800 mb-3 block"
          >
            {uiPreviewOpen ? '\u25BC Hide Preview' : '\u25B6 Preview Changes'}
          </button>

          {uiPreviewOpen && (
            <div className="bg-gray-50 rounded-md p-3 mb-3 text-sm text-gray-600">
              <p className="font-medium mb-1">Affected components:</p>
              <ul className="list-disc ml-4">
                {latestManifest.packages.ui.changelog
                  .filter((e) => e.scope)
                  .map((e, i) => (
                    <li key={i}>{e.scope}: {e.message}</li>
                  ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => onApplyUi(latestManifest)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              Apply UI Update
            </button>
            <button
              onClick={() => onSkip('ui', latestManifest)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Skip
            </button>
            <button
              onClick={() => {
                const next = { ...localSettings, ui: { ...localSettings.ui, policy: 'ignore' as UpdatePolicy } };
                setLocalSettings(next);
                onSaveSettings(next);
              }}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Ignore All UI Updates
            </button>
          </div>
        </div>
      )}

      {/* ── Update History Table ── */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Update History</h2>
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'update-history.json';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Export History
          </button>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-gray-400">No update history yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">From &rarr; To</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Mode</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(-20).reverse().map((entry, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 pr-4 text-gray-600">
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        entry.type === 'core' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                      }`}>
                        {entry.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-gray-700">
                      {entry.fromVersion} &rarr; {entry.toVersion}
                    </td>
                    <td className={`py-2 pr-4 font-medium ${STATUS_COLORS[entry.status] ?? 'text-gray-600'}`}>
                      {entry.status}
                    </td>
                    <td className="py-2 text-gray-500">{entry.auto ? 'Auto' : 'Manual'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Update Settings Panel ── */}
      <div className="bg-white rounded-lg border border-gray-200">
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="w-full flex items-center justify-between p-5 text-left"
        >
          <h2 className="text-lg font-semibold text-gray-800">Update Settings</h2>
          <span className="text-gray-400">{settingsOpen ? '\u25BC' : '\u25B6'}</span>
        </button>

        {settingsOpen && (
          <div className="px-5 pb-5 space-y-5 border-t border-gray-100 pt-4">
            {/* Core settings */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Core Updates</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Policy</label>
                  <select
                    value={localSettings.core.policy}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        core: { ...localSettings.core, policy: e.target.value as UpdatePolicy },
                      })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="auto">Auto</option>
                    <option value="notify">Notify</option>
                    <option value="off">Off</option>
                  </select>
                </div>
                <div className="space-y-2 pt-5">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={localSettings.core.autoApplyPatch}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          core: { ...localSettings.core, autoApplyPatch: e.target.checked },
                        })
                      }
                      className="rounded border-gray-300"
                    />
                    Auto-apply patches
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={localSettings.core.autoApplyMinor}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          core: { ...localSettings.core, autoApplyMinor: e.target.checked },
                        })
                      }
                      className="rounded border-gray-300"
                    />
                    Auto-apply minor
                  </label>
                </div>
              </div>
            </div>

            {/* UI settings */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">UI Updates</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Policy</label>
                  <select
                    value={localSettings.ui.policy}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        ui: { ...localSettings.ui, policy: e.target.value as UpdatePolicy },
                      })
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="auto">Auto</option>
                    <option value="notify">Notify</option>
                    <option value="ignore">Ignore</option>
                  </select>
                </div>
                <div className="space-y-2 pt-5">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={localSettings.ui.ignoreIfWhitelabeled}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          ui: { ...localSettings.ui, ignoreIfWhitelabeled: e.target.checked },
                        })
                      }
                      className="rounded border-gray-300"
                    />
                    Ignore UI if whitelabeled
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={localSettings.ui.previewBeforeApply}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          ui: { ...localSettings.ui, previewBeforeApply: e.target.checked },
                        })
                      }
                      className="rounded border-gray-300"
                    />
                    Preview before apply
                  </label>
                </div>
              </div>
            </div>

            {/* Interval */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">Check Interval</label>
              <select
                value={localSettings.checkIntervalMinutes}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, checkIntervalMinutes: Number(e.target.value) })
                }
                className="w-48 border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                {INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => onSaveSettings(localSettings)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              Save Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

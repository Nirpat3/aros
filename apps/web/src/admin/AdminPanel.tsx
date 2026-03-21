import { useState } from 'react';
import { PluginReview } from './PluginReview';
import { UserManagement } from './UserManagement';

type AdminTab = 'plugins' | 'users';

const font = '-apple-system, "SF Pro Text", BlinkMacSystemFont, "Helvetica Neue", system-ui, sans-serif';

export function AdminPanel() {
  const [tab, setTab] = useState<AdminTab>('plugins');

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0f', fontFamily: font }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '12px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#161618',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#638dff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#ececf1', letterSpacing: '-0.02em' }}>Admin</span>
        </div>

        <div style={{ display: 'flex', gap: 2, marginLeft: 24 }}>
          {([
            { key: 'plugins' as AdminTab, label: 'Plugin Review' },
            { key: 'users' as AdminTab, label: 'Users' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 500, fontFamily: font,
                background: tab === key ? 'rgba(99,141,255,0.14)' : 'transparent',
                color: tab === key ? '#638dff' : '#6b6b76',
                transition: 'all 150ms',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {tab === 'plugins' && <PluginReview />}
      {tab === 'users' && <UserManagement />}
    </div>
  );
}

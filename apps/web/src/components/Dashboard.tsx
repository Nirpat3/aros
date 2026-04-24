import { useState, useEffect } from 'react';
import { useWhitelabel } from '../whitelabel/WhitelabelProvider';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const API_BASE = (window as any).__AROS_API_URL__
  || (window.location.hostname === 'localhost' ? 'http://localhost:5457' : '');

/* ─── Types ──────────────────────────────────────────────── */
interface DashboardData {
  todaySales: { revenue: number; changePercent: number };
  activeAlerts: { count: number; critical: number };
  aiAgents: { active: number; total: number; statuses: Record<string, number> };
  lowStock: { count: number; items: Array<{ name: string; current: number; threshold: number }> };
  recentActivity: Array<{
    id: string;
    agent: string;
    action: string;
    timestamp: string;
    type: 'success' | 'warning' | 'info' | 'error';
  }>;
}

/* ─── Mock data (used when API is unavailable) ───────────── */
const MOCK_DATA: DashboardData = {
  todaySales: { revenue: 4827.50, changePercent: 12.3 },
  activeAlerts: { count: 3, critical: 1 },
  aiAgents: { active: 4, total: 6, statuses: { running: 4, idle: 1, error: 1 } },
  lowStock: {
    count: 7,
    items: [
      { name: 'Paper Towels (6pk)', current: 3, threshold: 10 },
      { name: 'Energy Drink 16oz', current: 8, threshold: 24 },
      { name: 'AA Batteries (4pk)', current: 2, threshold: 12 },
    ],
  },
  recentActivity: [
    { id: '1', agent: 'Inventory Agent', action: 'Generated reorder list for 7 low-stock items', timestamp: '2 min ago', type: 'warning' },
    { id: '2', agent: 'Sales Agent', action: 'Morning sales report processed — $1,240 in first 3 hours', timestamp: '18 min ago', type: 'success' },
    { id: '3', agent: 'Pricing Agent', action: 'Adjusted 12 promotional prices for weekend sale', timestamp: '45 min ago', type: 'info' },
    { id: '4', agent: 'Security Agent', action: 'Flagged unusual void pattern at Register 3', timestamp: '1 hr ago', type: 'error' },
    { id: '5', agent: 'Compliance Agent', action: 'Age verification audit completed — 100% pass rate', timestamp: '2 hr ago', type: 'success' },
  ],
};

const DOT_COLORS: Record<string, string> = {
  success: '#10B981',
  warning: '#F59E0B',
  info: '#3B82F6',
  error: '#EF4444',
};

/* ─── Skeleton placeholder ───────────────────────────────── */
function Skeleton({ width, height }: { width: string; height: string }) {
  return <div className="aros-skeleton" style={{ width, height }} />;
}

/* ─── Metric card ────────────────────────────────────────── */
function MetricCard({
  label,
  value,
  sub,
  subColor,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  loading: boolean;
}) {
  return (
    <div className="aros-card">
      <h3>{label}</h3>
      {loading ? (
        <>
          <Skeleton width="120px" height="34px" />
          <div style={{ marginTop: 8 }}><Skeleton width="80px" height="14px" /></div>
        </>
      ) : (
        <>
          <p className="aros-metric">{value}</p>
          {sub && (
            <p style={{ fontSize: 13, color: subColor || '#64748B', marginTop: 4, fontWeight: 500 }}>
              {sub}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Dashboard ──────────────────────────────────────────── */
export function Dashboard() {
  const { config } = useWhitelabel();
  const { session, tenant } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Returns today + yesterday rows for the active tenant from Supabase,
    // so the dashboard reflects the store selected in the TenantPicker.
    async function fetchFromSupabase(): Promise<DashboardData | null> {
      if (!tenant?.id) return null;
      const today = new Date();
      const yday = new Date(today);
      yday.setDate(today.getDate() - 1);
      const toISO = (d: Date) => d.toISOString().slice(0, 10);
      const { data: rows, error } = await supabase
        .from('pos_sales_daily')
        .select('business_date, total_sales, total_transactions')
        .eq('tenant_id', tenant.id)
        .is('department', null)
        .gte('business_date', toISO(yday))
        .lte('business_date', toISO(today))
        .order('business_date', { ascending: false });
      if (error || !rows) return null;
      const todayRow = rows.find((r) => r.business_date === toISO(today));
      const ydayRow = rows.find((r) => r.business_date === toISO(yday));
      const todayRev = Number(todayRow?.total_sales ?? 0);
      const ydayRev = Number(ydayRow?.total_sales ?? 0);
      const changePercent = ydayRev > 0 ? ((todayRev - ydayRev) / ydayRev) * 100 : 0;
      return {
        todaySales: { revenue: todayRev, changePercent },
        activeAlerts: { count: 0, critical: 0 },
        aiAgents: { active: 0, total: 0, statuses: {} },
        lowStock: { count: 0, items: [] },
        recentActivity: [],
      };
    }

    async function fetchDashboard() {
      // Primary: Supabase pos_sales_daily for the active tenant
      const sb = await fetchFromSupabase();
      if (!cancelled && sb) {
        setData(sb);
        setLoading(false);
        return;
      }
      // Secondary: aros-platform API (legacy)
      try {
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        const res = await fetch(`${API_BASE}/api/dashboard`, {
          credentials: 'include',
          headers,
        });
        if (!res.ok) throw new Error('API unavailable');
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch {
        // Neither source available — fall back to mock data
        if (!cancelled) {
          setData(MOCK_DATA);
          setLoading(false);
        }
      }
    }

    fetchDashboard();
    return () => { cancelled = true; };
  }, [session, tenant?.id]);

  const d = data;
  const changeSign = d && d.todaySales.changePercent >= 0 ? '+' : '';
  const changeColor = d && d.todaySales.changePercent >= 0 ? '#10B981' : '#EF4444';

  return (
    <div className="aros-dashboard">
      <h1>Welcome to {config.brand.name}</h1>
      <p>{config.brand.tagline}</p>

      {/* ── Metric Cards ──────────────────────────────────── */}
      <div className="aros-dashboard-grid">
        <MetricCard
          label="Today's Sales"
          value={d ? `$${d.todaySales.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}
          sub={d ? `${changeSign}${d.todaySales.changePercent}% vs yesterday` : undefined}
          subColor={changeColor}
          loading={loading}
        />
        <MetricCard
          label="Active Alerts"
          value={d ? String(d.activeAlerts.count) : ''}
          sub={d && d.activeAlerts.critical > 0 ? `${d.activeAlerts.critical} critical` : 'All clear'}
          subColor={d && d.activeAlerts.critical > 0 ? '#EF4444' : '#10B981'}
          loading={loading}
        />
        <MetricCard
          label="AI Agents"
          value={d ? `${d.aiAgents.active} / ${d.aiAgents.total}` : ''}
          sub={d ? `${d.aiAgents.active} running` : undefined}
          subColor="#3B82F6"
          loading={loading}
        />
        <MetricCard
          label="Low Stock Items"
          value={d ? String(d.lowStock.count) : ''}
          sub={d && d.lowStock.count > 0 ? 'Items below reorder threshold' : 'Stock levels OK'}
          subColor={d && d.lowStock.count > 5 ? '#F59E0B' : '#10B981'}
          loading={loading}
        />
      </div>

      {/* ── Recent Activity ───────────────────────────────── */}
      <div className="aros-activity-feed">
        <h2>Recent Activity</h2>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', gap: 12 }}>
                <Skeleton width="8px" height="8px" />
                <div style={{ flex: 1 }}>
                  <Skeleton width="80%" height="16px" />
                  <div style={{ marginTop: 6 }}><Skeleton width="60px" height="12px" /></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ul className="aros-activity-list">
            {d?.recentActivity.map(item => (
              <li key={item.id} className="aros-activity-item">
                <span
                  className="aros-activity-dot"
                  style={{ background: DOT_COLORS[item.type] || '#94A3B8' }}
                />
                <div className="aros-activity-content">
                  <p className="aros-activity-text">
                    <strong>{item.agent}</strong> — {item.action}
                  </p>
                  <p className="aros-activity-time">{item.timestamp}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';

const MARKETPLACE_URL = (window as any).__MARKETPLACE_URL__
  ?? (window.location.hostname === 'localhost' ? 'http://localhost:5458' : 'https://marketplace.nirtek.net');

const API_BASE = (window as any).__AROS_API_URL__
  || (window.location.hostname === 'localhost' ? 'http://localhost:5457' : '');

interface CatalogItem {
  id: string;
  name: string;
  description: string;
  category: string;
  pricing_tier?: 'free' | 'starter' | 'professional' | 'enterprise';
  icon?: string;
  status: 'available' | 'coming_soon';
}

interface CatalogResponse {
  apps: CatalogItem[];
  tools: CatalogItem[];
  nodes: CatalogItem[];
  total: { apps: number; tools: number; nodes: number };
}

type TabType = 'all' | 'apps' | 'tools' | 'nodes';

const CATEGORIES = [
  'all', 'pos', 'pos-connector', 'inventory', 'analytics', 'loyalty',
  'marketing', 'payments', 'shipping', 'crm', 'reporting',
  'database', 'integration', 'utility', 'operations',
];

const TIER_COLORS: Record<string, string> = {
  free: '#10B981',
  starter: '#3B82F6',
  professional: '#8B5CF6',
  enterprise: '#F59E0B',
};

const font = '-apple-system, "SF Pro Text", BlinkMacSystemFont, "Helvetica Neue", system-ui, sans-serif';

export function MarketplacePage() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabType>('all');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCatalog();
  }, []);

  async function fetchCatalog() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      if (search) params.set('q', search);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${MARKETPLACE_URL}/v1/marketplace/catalog${qs}`);
      if (!res.ok) throw new Error('Failed to load marketplace');
      const data: CatalogResponse = await res.json();
      setCatalog(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach marketplace');
      // Show empty state
      setCatalog({ apps: [], tools: [], nodes: [], total: { apps: 0, tools: 0, nodes: 0 } });
    } finally {
      setLoading(false);
    }
  }

  async function handleInstall(item: CatalogItem) {
    setInstalling(item.id);
    try {
      const res = await fetch(`${API_BASE}/api/marketplace/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId: item.id }),
        credentials: 'include',
      });
      if (res.ok) {
        setInstalled(prev => new Set(prev).add(item.id));
      }
    } catch {
      // Non-fatal
    } finally {
      setInstalling(null);
    }
  }

  function getItems(): CatalogItem[] {
    if (!catalog) return [];
    const items: CatalogItem[] = [];
    if (tab === 'all' || tab === 'apps') items.push(...catalog.apps);
    if (tab === 'all' || tab === 'tools') items.push(...catalog.tools);
    if (tab === 'all' || tab === 'nodes') items.push(...catalog.nodes);

    if (search) {
      const q = search.toLowerCase();
      return items.filter(i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
    }
    if (category !== 'all') {
      return items.filter(i => i.category === category);
    }
    return items;
  }

  const items = getItems();

  return (
    <div style={{ padding: 32, fontFamily: font, color: '#ececf1', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>
          Marketplace
        </h1>
        <p style={{ fontSize: 14, color: '#a1a1aa' }}>
          Browse and install apps, tools, and integrations for your store.
        </p>
      </div>

      {/* Search + Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search marketplace..."
          style={{
            flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 10, fontSize: 14,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#ececf1', fontFamily: font, outline: 'none',
          }}
        />
        <select
          value={category}
          onChange={e => { setCategory(e.target.value); }}
          style={{
            padding: '10px 14px', borderRadius: 10, fontSize: 13,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#ececf1', fontFamily: font, outline: 'none', appearance: 'auto' as any,
          }}
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c === 'all' ? 'All Categories' : c.replace(/-/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 2 }}>
        {(['all', 'apps', 'tools', 'nodes'] as TabType[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 18px', borderRadius: '8px 8px 0 0', fontSize: 13, fontWeight: 600,
              fontFamily: font, cursor: 'pointer', border: 'none', transition: 'all 150ms',
              background: tab === t ? 'rgba(99,141,255,0.15)' : 'transparent',
              color: tab === t ? '#638dff' : '#6b6b76',
            }}
          >
            {t === 'all' ? `All (${catalog ? catalog.total.apps + catalog.total.tools + catalog.total.nodes : 0})`
              : `${t.charAt(0).toUpperCase() + t.slice(1)} (${catalog?.total[t as 'apps' | 'tools' | 'nodes'] ?? 0})`}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '14px 18px', borderRadius: 10, marginBottom: 20, fontSize: 13,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
          color: '#FCA5A5',
        }}>
          {error}. Make sure the marketplace service is running.
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#6b6b76', fontSize: 14 }}>
          Loading marketplace...
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 60, borderRadius: 16,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📦</div>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: '#a1a1aa' }}>No items found</h3>
          <p style={{ fontSize: 13, color: '#6b6b76' }}>
            {search ? 'Try a different search term.' : 'Check back soon — new integrations are added regularly.'}
          </p>
        </div>
      )}

      {/* Grid */}
      {!loading && items.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {items.map(item => (
            <div
              key={item.id}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                transition: 'border-color 150ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(99,141,255,0.25)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
            >
              {/* Icon + Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(99,141,255,0.1)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
                }}>
                  {item.icon || '🔌'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.name}
                  </h3>
                  <span style={{
                    fontSize: 11, color: '#6b6b76', textTransform: 'capitalize',
                  }}>
                    {item.category?.replace(/-/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p style={{
                fontSize: 13, color: '#a1a1aa', lineHeight: 1.5, margin: '0 0 14px 0',
                flex: 1,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {item.description}
              </p>

              {/* Footer: tier + action */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {item.pricing_tier && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                    color: TIER_COLORS[item.pricing_tier] || '#a1a1aa',
                  }}>
                    {item.pricing_tier}
                  </span>
                )}
                {!item.pricing_tier && <span />}

                {item.status === 'coming_soon' ? (
                  <span style={{ fontSize: 12, color: '#6b6b76', fontStyle: 'italic' }}>Coming soon</span>
                ) : installed.has(item.id) ? (
                  <span style={{ fontSize: 12, color: '#10B981', fontWeight: 600 }}>Installed</span>
                ) : (
                  <button
                    onClick={() => handleInstall(item)}
                    disabled={installing === item.id}
                    style={{
                      padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      fontFamily: font, cursor: 'pointer', border: 'none',
                      background: '#638dff', color: '#fff', transition: 'opacity 150ms',
                      opacity: installing === item.id ? 0.6 : 1,
                    }}
                  >
                    {installing === item.id ? 'Installing...' : 'Install'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

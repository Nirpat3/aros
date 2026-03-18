import { useWhitelabel } from '../whitelabel/WhitelabelProvider';

export function Sidebar() {
  const { config } = useWhitelabel();

  return (
    <aside className="aros-sidebar">
      <div className="aros-sidebar-header">
        <img src={config.logo?.primary} alt={config.brand.name} className="aros-logo" />
        <span className="aros-brand-name">{config.brand.name}</span>
      </div>
      <nav className="aros-nav">
        <a href="/" className="aros-nav-item active">Dashboard</a>
        {config.features?.marketplace && <a href="/marketplace" className="aros-nav-item">Marketplace</a>}
        {config.features?.analytics && <a href="/analytics" className="aros-nav-item">Analytics</a>}
        {config.features?.settings && <a href="/settings" className="aros-nav-item">Settings</a>}
      </nav>
    </aside>
  );
}

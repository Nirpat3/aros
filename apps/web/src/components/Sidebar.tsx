import { useWhitelabel } from '../whitelabel/WhitelabelProvider';
import { UpdateBadge } from './updates';
import { useAuth } from '../admin/useAuth';

export function Sidebar() {
  const { config } = useWhitelabel();
  const { isAdmin } = useAuth();

  return (
    <aside className="aros-sidebar">
      <div className="aros-sidebar-header">
        <img src={config.logo?.primary} alt={config.brand.name} className="aros-logo" />
        <span className="aros-brand-name">{config.brand.name}</span>
      </div>
      <nav className="aros-nav">
        <a href="/dashboard" className="aros-nav-item active">Dashboard</a>
        {config.features?.marketplace && <a href="/marketplace" className="aros-nav-item">Marketplace</a>}
        {config.features?.marketplace && <a href="/developers" className="aros-nav-item">Developers</a>}
        {config.features?.analytics && <a href="/analytics" className="aros-nav-item">Analytics</a>}
        <a href="/billing" className="aros-nav-item">Billing</a>
        <a href="/costs" className="aros-nav-item">Costs</a>
        <a href="/updates" className="aros-nav-item">
          Updates
          <UpdateBadge coreAvailable={false} uiAvailable={false} />
        </a>
        {config.features?.settings && <a href="/settings" className="aros-nav-item">Settings</a>}
        {isAdmin && <a href="/admin" className="aros-nav-item">Admin</a>}
      </nav>
    </aside>
  );
}

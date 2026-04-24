import { useState, useCallback, useEffect } from 'react';
import { useWhitelabel } from '../whitelabel/WhitelabelProvider';
import { UpdateBadge } from './updates';
import { useAuth } from '../admin/useAuth';
import { TenantPicker } from './TenantPicker';

export function Sidebar() {
  const { config } = useWhitelabel();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen(prev => !prev), []);
  const close = useCallback(() => setOpen(false), []);

  // Close sidebar on navigation (popstate) and escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onPop = () => close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
    };
  }, [close]);

  return (
    <>
      {/* Hamburger button — visible only on mobile via CSS */}
      <button
        className="aros-hamburger"
        onClick={toggle}
        aria-label={open ? 'Close menu' : 'Open menu'}
        type="button"
      >
        {open ? '\u2715' : '\u2630'}
      </button>

      {/* Overlay — visible only on mobile when sidebar is open */}
      <div
        className={`aros-sidebar-overlay${open ? ' aros-sidebar-overlay--visible' : ''}`}
        onClick={close}
      />

      <aside className={`aros-sidebar${open ? ' aros-sidebar--open' : ''}`}>
        <div className="aros-sidebar-header">
          <img src={config.logo?.primary} alt={config.brand.name} className="aros-logo" />
          <span className="aros-brand-name">{config.brand.name}</span>
        </div>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
          <TenantPicker />
        </div>
        <nav className="aros-nav">
          <a href="/dashboard" className="aros-nav-item active" onClick={close}>Dashboard</a>
          {config.features?.marketplace && <a href="/marketplace" className="aros-nav-item" onClick={close}>Marketplace</a>}
          {config.features?.marketplace && <a href="/developers" className="aros-nav-item" onClick={close}>Settings</a>}
          {config.features?.analytics && <a href="/analytics" className="aros-nav-item" onClick={close}>Analytics</a>}
          <a href="/billing" className="aros-nav-item" onClick={close}>Billing</a>
          <a href="/costs" className="aros-nav-item" onClick={close}>Costs</a>
          <a href="/updates" className="aros-nav-item" onClick={close}>
            Updates
            <UpdateBadge coreAvailable={false} uiAvailable={false} />
          </a>
          {config.features?.settings && <a href="/settings" className="aros-nav-item" onClick={close}>Settings</a>}
          {isAdmin && <a href="/admin" className="aros-nav-item" onClick={close}>Admin</a>}
        </nav>
      </aside>
    </>
  );
}

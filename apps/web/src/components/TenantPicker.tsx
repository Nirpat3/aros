import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Tenant/Store picker dropdown — appears in the top-right of every page.
 * Shown only when the current user is a member of more than one tenant.
 */
export function TenantPicker() {
  const { memberships, tenant, selectTenant } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (memberships.length <= 1 || !tenant) return null;

  return (
    <div ref={ref} style={styles.wrapper}>
      <button type="button" style={styles.trigger} onClick={() => setOpen((o) => !o)}>
        <span style={styles.label}>{tenant.name}</span>
        <span style={styles.caret}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={styles.menu}>
          {memberships.map((m) => {
            const active = m.tenant.id === tenant.id;
            return (
              <button
                type="button"
                key={m.tenant.id}
                style={{ ...styles.item, ...(active ? styles.itemActive : {}) }}
                onClick={() => {
                  selectTenant(m.tenant.id);
                  setOpen(false);
                }}
              >
                <span style={styles.itemName}>{m.tenant.name}</span>
                <span style={styles.itemRole}>{m.role}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { position: 'relative', display: 'inline-block' },
  trigger: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontSize: 14,
    color: '#111827',
    cursor: 'pointer',
  },
  label: { fontWeight: 600 },
  caret: { fontSize: 10, color: '#6b7280' },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    right: 0,
    minWidth: 220,
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    boxShadow: '0 10px 25px rgba(15, 23, 42, 0.08)',
    padding: 4,
    zIndex: 1000,
  },
  item: {
    display: 'flex',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: 'transparent',
    border: 0,
    borderRadius: 6,
    fontSize: 14,
    color: '#111827',
    cursor: 'pointer',
    textAlign: 'left',
  },
  itemActive: { background: '#eef2ff', color: '#3730a3', fontWeight: 600 },
  itemName: {},
  itemRole: { fontSize: 11, color: '#6b7280', textTransform: 'uppercase' },
};

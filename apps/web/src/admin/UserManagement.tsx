import { useState, useEffect } from 'react';

// ── Types ────────────────────────────────────────────────────────

type UserRole = 'superadmin' | 'owner' | 'admin' | 'manager' | 'viewer';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Super Admin',
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<UserRole, { bg: string; text: string }> = {
  superadmin: { bg: '#581C87', text: '#D8B4FE' },
  owner:      { bg: '#1E40AF', text: '#93C5FD' },
  admin:      { bg: '#065F46', text: '#6EE7B7' },
  manager:    { bg: '#92400E', text: '#FCD34D' },
  viewer:     { bg: '#374151', text: '#9CA3AF' },
};

// ── Component ────────────────────────────────────────────────────

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('viewer');

  // Browser-first: read users from localStorage (same store ArosProvider would use)
  const USERS_KEY = 'aros-users';

  const loadUsers = (): User[] => {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  };

  const saveUsers = (list: User[]) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(list));
  };

  const refresh = () => {
    setUsers(loadUsers());
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const updateRole = (userId: string, role: UserRole) => {
    const list = loadUsers();
    const idx = list.findIndex((u) => u.id === userId);
    if (idx === -1) return;
    list[idx] = { ...list[idx], role, updatedAt: new Date().toISOString() };
    saveUsers(list);
    setEditingUser(null);
    refresh();
  };

  const font = '-apple-system, "SF Pro Text", BlinkMacSystemFont, "Helvetica Neue", system-ui, sans-serif';

  return (
    <div style={{ padding: 32, fontFamily: font, color: '#ececf1', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 4 }}>User Management</h1>
      <p style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 24 }}>
        Manage user accounts and role assignments across the platform.
      </p>

      {/* Users table */}
      <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1.2fr 120px 160px 80px',
          padding: '10px 16px', background: 'rgba(255,255,255,0.04)',
          fontSize: 11, fontWeight: 600, color: '#6b6b76', textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Joined</span>
          <span></span>
        </div>

        {loading ? (
          <div style={{ padding: 24, color: '#6b6b76', fontSize: 13, textAlign: 'center' }}>Loading...</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 24, color: '#6b6b76', fontSize: 13, textAlign: 'center' }}>No users found.</div>
        ) : (
          users.map((user) => {
            const rc = ROLE_COLORS[user.role as UserRole] ?? ROLE_COLORS.viewer;
            const isEditing = editingUser?.id === user.id;

            return (
              <div
                key={user.id}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1.2fr 120px 160px 80px',
                  padding: '12px 16px', alignItems: 'center',
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  background: isEditing ? 'rgba(99,141,255,0.05)' : 'transparent',
                  transition: 'background 150ms',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500 }}>{user.name}</span>
                <span style={{ fontSize: 13, color: '#a1a1aa' }}>{user.email}</span>
                <span>
                  {isEditing ? (
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                      style={{
                        padding: '4px 8px', borderRadius: 6, fontSize: 12,
                        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                        color: '#ececf1', fontFamily: font, outline: 'none',
                      }}
                    >
                      {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  ) : (
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: rc.bg, color: rc.text,
                    }}>
                      {ROLE_LABELS[user.role as UserRole] ?? user.role}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 12, color: '#6b6b76' }}>
                  {new Date(user.createdAt).toLocaleDateString()}
                </span>
                <span>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => updateRole(user.id, selectedRole)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: '#065F46', color: '#6EE7B7', fontSize: 11, fontWeight: 600, fontFamily: font,
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingUser(null)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: 'rgba(255,255,255,0.08)', color: '#a1a1aa', fontSize: 11, fontFamily: font,
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingUser(user); setSelectedRole(user.role as UserRole); }}
                      style={{
                        padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: 'rgba(255,255,255,0.06)', color: '#a1a1aa', fontSize: 11, fontFamily: font,
                        transition: 'background 150ms',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    >
                      Edit
                    </button>
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

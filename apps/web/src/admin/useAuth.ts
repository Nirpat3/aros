import { useState, useEffect, useCallback } from 'react';

// Lightweight browser-side auth hook.
// Reads the JWT from sessionStorage and decodes the payload (base64 middle segment).
// This is NOT security — server validates tokens. This is for UI gating only.

export interface AuthUser {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

const TOKEN_KEY = 'aros-auth-token';

function decodePayload(token: string): AuthUser | null {
  try {
    const parts = token.split(':');
    // ArosProvider uses encrypted tokens, not JWT — so we store the decoded user separately
    const userRaw = sessionStorage.getItem('aros-auth-user');
    if (userRaw) return JSON.parse(userRaw);
    return null;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const userRaw = sessionStorage.getItem('aros-auth-user');
    if (userRaw) {
      try { return JSON.parse(userRaw); } catch { return null; }
    }
    return null;
  });

  const isSuperAdmin = user?.role === 'superadmin';
  const isAdmin = isSuperAdmin || user?.role === 'owner' || user?.role === 'admin';

  const login = useCallback((token: string, userData: AuthUser) => {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem('aros-auth-user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem('aros-auth-user');
    setUser(null);
  }, []);

  return { user, isSuperAdmin, isAdmin, login, logout };
}

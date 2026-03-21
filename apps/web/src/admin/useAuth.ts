import { useState, useCallback } from 'react';

// Lightweight browser-side auth hook.
// Stores user data in both sessionStorage and localStorage for persistence.
// This is NOT security — server validates tokens. This is for UI gating only.

export interface AuthUser {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

const TOKEN_KEY = 'aros-auth-token';
const USER_KEY = 'aros-auth-user';

function loadUser(): AuthUser | null {
  // Try sessionStorage first, fall back to localStorage
  const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as AuthUser;
    // Check if token has expired (1 hour buffer)
    if (user.exp && user.exp * 1000 < Date.now()) {
      // Expired — clear and return null
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    // Sync to sessionStorage if only in localStorage
    if (!sessionStorage.getItem(USER_KEY)) {
      sessionStorage.setItem(USER_KEY, raw);
    }
    return user;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(loadUser);

  const isSuperAdmin = user?.role === 'superadmin';
  const isAdmin = isSuperAdmin || user?.role === 'owner' || user?.role === 'admin';

  const login = useCallback((token: string, userData: AuthUser) => {
    const json = JSON.stringify(userData);
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, json);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, json);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('aros-onboarding-complete');
    setUser(null);
    window.location.href = '/login';
  }, []);

  return { user, isSuperAdmin, isAdmin, login, logout };
}

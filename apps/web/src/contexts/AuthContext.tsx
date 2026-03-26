import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const API_BASE = (window as any).__AROS_API_URL__
  || (window.location.hostname === 'localhost' ? 'http://localhost:5457' : '');

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: string;
  onboarding_completed: boolean;
  created_at: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  tenant: Tenant | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, metadata: Record<string, string>) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchTenant(userId: string): Promise<Tenant | null> {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('owner_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return data as Tenant;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        const t = await fetchTenant(s.user.id);
        setTenant(t);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          const t = await fetchTenant(s.user.id);
          setTenant(t);
        } else {
          setTenant(null);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    // Route through server for brute-force protection + audit logging
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || 'Login failed' };
      }
      // Server returned tokens — set session in Supabase client
      if (data.session?.access_token && data.session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
      return { error: null };
    } catch {
      // Server unreachable — fall back to direct Supabase auth
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, metadata: Record<string, string>) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setTenant(null);
    // Clear legacy auth data
    sessionStorage.removeItem('aros-auth-token');
    sessionStorage.removeItem('aros-auth-user');
    localStorage.removeItem('aros-auth-token');
    localStorage.removeItem('aros-auth-user');
    localStorage.removeItem('aros-onboarding-complete');
    window.location.href = '/login';
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error: error?.message ?? null };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, tenant, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

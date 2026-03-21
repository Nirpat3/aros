import { useState, FormEvent } from 'react';
import { useAuth } from '../../admin/useAuth';

type AuthMode = 'login' | 'signup';

const API_BASE = (window as any).__AROS_API_URL__
  || (window.location.hostname === 'localhost'
    ? 'http://localhost:5457'
    : '');

export function AuthPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login'
        ? '/api/auth/sign-in/email'
        : '/api/auth/sign-up/email';
      const body = mode === 'login'
        ? { email, password }
        : { email, password, name };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = typeof data?.error === 'object' ? data.error.message : (data?.error || data?.message || 'Authentication failed');
        setError(errMsg);
        return;
      }

      // MIB007 uses session cookies — also store user info for UI gating
      const sessionData = data?.user || data?.data?.user || data;
      login('session', {
        sub: sessionData?.id || '',
        email: sessionData?.email || email,
        role: sessionData?.role || 'owner',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      // Redirect to onboarding for new signups (plan → payment → setup),
      // dashboard for returning users
      const redirectTo = mode === 'signup' ? '/onboarding' : '/dashboard';
      window.location.href = redirectTo;
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.logo}>AROS</div>
          <p style={styles.tagline}>Agentic Retail Operating System</p>
        </div>

        <div style={styles.card}>
          <div style={styles.tabs}>
            <button
              style={mode === 'login' ? styles.tabActive : styles.tab}
              onClick={() => { setMode('login'); setError(''); }}
            >
              Sign In
            </button>
            <button
              style={mode === 'signup' ? styles.tabActive : styles.tab}
              onClick={() => { setMode('signup'); setError(''); }}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            {mode === 'signup' && (
              <>
                <div style={styles.field}>
                  <label style={styles.label}>Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="John Smith"
                    required
                    style={styles.input}
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Company Name</label>
                  <input
                    type="text"
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    placeholder="Smith's Corner Market"
                    required
                    style={styles.input}
                  />
                </div>
              </>
            )}

            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@yourstore.com"
                required
                autoComplete="email"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Create a strong password' : 'Enter your password'}
                required
                minLength={mode === 'signup' ? 12 : undefined}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                style={styles.input}
              />
              {mode === 'signup' && (
                <span style={styles.hint}>Minimum 12 characters</span>
              )}
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <button
              type="submit"
              disabled={loading}
              style={loading ? { ...styles.button, opacity: 0.6 } : styles.button}
            >
              {loading
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Sign In'
                  : 'Create Account'}
            </button>
          </form>

          {mode === 'login' && (
            <p style={styles.footer}>
              Don't have an account?{' '}
              <a href="#" onClick={e => { e.preventDefault(); setMode('signup'); setError(''); }} style={styles.link}>
                Get started free
              </a>
            </p>
          )}
          {mode === 'signup' && (
            <p style={styles.footer}>
              Already have an account?{' '}
              <a href="#" onClick={e => { e.preventDefault(); setMode('login'); setError(''); }} style={styles.link}>
                Sign in
              </a>
            </p>
          )}
        </div>

        <p style={styles.legal}>
          By continuing, you agree to our{' '}
          <a href="https://nirtek.net/terms.html" style={styles.link} target="_blank" rel="noopener">Terms</a>
          {' '}and{' '}
          <a href="https://nirtek.net/privacy.html" style={styles.link} target="_blank" rel="noopener">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #f0f4ff 0%, #e8ecf8 50%, #f5f3ff 100%)',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 420,
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: 32,
  },
  logo: {
    fontSize: 32,
    fontWeight: 800,
    letterSpacing: -1,
    color: '#1a1a2e',
  },
  tagline: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '32px 28px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    border: '1px solid #e5e7eb',
  },
  tabs: {
    display: 'flex',
    gap: 0,
    marginBottom: 24,
    background: '#f3f4f6',
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    padding: '10px 0',
    border: 'none',
    background: 'transparent',
    fontSize: 14,
    fontWeight: 600,
    color: '#6b7280',
    cursor: 'pointer',
    borderRadius: 8,
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  },
  tabActive: {
    flex: 1,
    padding: '10px 0',
    border: 'none',
    background: '#fff',
    fontSize: 14,
    fontWeight: 600,
    color: '#1a1a2e',
    cursor: 'pointer',
    borderRadius: 8,
    fontFamily: 'inherit',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
  },
  input: {
    padding: '12px 14px',
    border: '1px solid #d1d5db',
    borderRadius: 10,
    fontSize: 15,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
  },
  error: {
    padding: '10px 14px',
    background: '#fef2f2',
    color: '#dc2626',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
  },
  button: {
    padding: '14px 0',
    background: '#3b5bdb',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: 4,
    transition: 'background 0.2s',
  },
  footer: {
    textAlign: 'center' as const,
    fontSize: 13,
    color: '#6b7280',
    marginTop: 20,
  },
  link: {
    color: '#3b5bdb',
    textDecoration: 'none',
    fontWeight: 600,
  },
  legal: {
    textAlign: 'center' as const,
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 20,
  },
};

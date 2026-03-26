import { useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function ResetPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: err } = await resetPassword(email);
      if (err) {
        setError(err);
        return;
      }
      setSent(true);
    } catch {
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
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div style={styles.iconCircle}>
                <span style={{ fontSize: 24 }}>&#9993;</span>
              </div>
              <h2 style={styles.cardTitle}>Check your email</h2>
              <p style={styles.cardDesc}>
                We sent a password reset link to <strong>{email}</strong>. Click the link in the email to set a new password.
              </p>
              <p style={{ ...styles.cardDesc, fontSize: 12, color: '#9ca3af' }}>
                Didn't receive it? Check your spam folder or try again.
              </p>
              <button
                onClick={() => { setSent(false); setEmail(''); }}
                style={{ ...styles.linkBtn, marginTop: 8 }}
              >
                Try a different email
              </button>
            </div>
          ) : (
            <>
              <h2 style={styles.cardTitle}>Reset your password</h2>
              <p style={styles.cardDesc}>
                Enter the email address associated with your account and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.field}>
                  <label style={styles.label}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@yourstore.com"
                    required
                    autoComplete="email"
                    autoFocus
                    style={styles.input}
                  />
                </div>

                {error && <div style={styles.error}>{error}</div>}

                <button
                  type="submit"
                  disabled={loading}
                  style={loading ? { ...styles.button, opacity: 0.6 } : styles.button}
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}

          <p style={styles.footer}>
            <a href="/login" style={styles.link}>Back to login</a>
          </p>
        </div>
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
  cardTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#1a1a2e',
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  cardDesc: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
    lineHeight: 1.5,
    textAlign: 'center' as const,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: '#f0f4ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
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
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#3b5bdb',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
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
};

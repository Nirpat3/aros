import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function VerifyEmail() {
  const params = new URLSearchParams(window.location.search);
  const email = params.get('email') || '';
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');

  async function handleResend() {
    if (!email) return;
    setError('');
    setLoading(true);

    try {
      const { error: err } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (err) {
        setError(err.message);
        return;
      }
      setResent(true);
    } catch {
      setError('Failed to resend. Please try again.');
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
          <div style={{ textAlign: 'center' }}>
            <div style={styles.iconCircle}>
              <span style={{ fontSize: 24 }}>&#9993;</span>
            </div>
            <h2 style={styles.cardTitle}>Verify your email</h2>
            <p style={styles.cardDesc}>
              We sent a verification link to{' '}
              {email ? <strong>{email}</strong> : 'your email address'}.
              {' '}Check your inbox and click the link to activate your account.
            </p>

            {error && <div style={styles.error}>{error}</div>}

            {resent ? (
              <p style={styles.success}>
                Verification email resent. Check your inbox.
              </p>
            ) : (
              <button
                onClick={handleResend}
                disabled={loading || !email}
                style={loading ? { ...styles.resendBtn, opacity: 0.6 } : styles.resendBtn}
              >
                {loading ? 'Sending...' : 'Resend verification email'}
              </button>
            )}

            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 16, lineHeight: 1.5 }}>
              Didn't receive it? Check your spam folder, or make sure you entered the correct email address.
            </p>
          </div>

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
  },
  cardDesc: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
    lineHeight: 1.5,
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
  error: {
    padding: '10px 14px',
    background: '#fef2f2',
    color: '#dc2626',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 16,
  },
  success: {
    padding: '10px 14px',
    background: '#f0fdf4',
    color: '#16a34a',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
  },
  resendBtn: {
    padding: '12px 24px',
    background: '#f3f4f6',
    color: '#374151',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.2s',
  },
  footer: {
    textAlign: 'center' as const,
    fontSize: 13,
    color: '#6b7280',
    marginTop: 24,
  },
  link: {
    color: '#3b5bdb',
    textDecoration: 'none',
    fontWeight: 600,
  },
};

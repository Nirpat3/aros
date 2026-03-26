import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE = (window as any).__AROS_API_URL__
  || (window.location.hostname === 'localhost' ? 'http://localhost:5457' : '');

interface BillingStatus {
  tenantId: string;
  plan: string;
  billingStatus: string;
  stripeCustomerId: string | null;
  subscription: {
    id: string;
    status: string;
    plan: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
  licenseTier: string;
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter ($49/mo)',
  pro: 'Pro ($149/mo)',
  enterprise: 'Business ($499/mo)',
};

export function BillingPage() {
  const { tenant, user } = useAuth();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState('');

  // Check URL params for payment callback
  const params = new URLSearchParams(window.location.search);
  const paymentStatus = params.get('status');

  useEffect(() => {
    if (!tenant?.id) return;
    fetch(`${API_BASE}/api/billing/status?tenantId=${tenant.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setBilling(data);
        }
      })
      .catch(() => setError('Failed to load billing info'))
      .finally(() => setLoading(false));
  }, [tenant?.id]);

  async function openPortal() {
    if (!billing?.stripeCustomerId) return;
    setPortalLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/billing/portal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stripeCustomerId: billing.stripeCustomerId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError('Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleUpgrade(plan: string) {
    if (!tenant) return;
    setPortalLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          plan,
          email: user?.email,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError('Failed to start checkout');
    } finally {
      setPortalLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={styles.wrapper}>
        <p style={{ color: '#6b7280' }}>Loading billing info...</p>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <h1 style={styles.title}>Billing & Subscription</h1>

      {paymentStatus === 'success' && (
        <div style={styles.successBanner}>
          Payment successful! Your plan has been upgraded.
        </div>
      )}
      {paymentStatus === 'cancelled' && (
        <div style={styles.warningBanner}>
          Payment was cancelled. Your plan has not changed.
        </div>
      )}
      {error && <div style={styles.errorBanner}>{error}</div>}

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Current Plan</h2>
        <div style={styles.planDisplay}>
          <span style={styles.planName}>{PLAN_LABELS[billing?.plan || 'free'] || billing?.plan || 'Free'}</span>
          <span style={styles.planStatus}>
            {billing?.billingStatus === 'active' ? 'Active' :
             billing?.billingStatus === 'payment_failed' ? 'Payment Failed' :
             billing?.billingStatus === 'cancelled' ? 'Cancelled' : 'Free Tier'}
          </span>
        </div>

        {billing?.subscription && (
          <div style={styles.subDetails}>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Next billing date</span>
              <span>{new Date(billing.subscription.currentPeriodEnd).toLocaleDateString()}</span>
            </div>
            {billing.subscription.cancelAtPeriodEnd && (
              <div style={{ ...styles.detailRow, color: '#dc2626' }}>
                <span style={styles.detailLabel}>Status</span>
                <span>Cancels at period end</span>
              </div>
            )}
          </div>
        )}

        {billing?.licenseTier && (
          <div style={styles.detailRow}>
            <span style={styles.detailLabel}>License Tier</span>
            <span style={{ textTransform: 'capitalize' }}>{billing.licenseTier}</span>
          </div>
        )}
      </div>

      <div style={styles.actions}>
        {billing?.stripeCustomerId ? (
          <button
            onClick={openPortal}
            disabled={portalLoading}
            style={styles.button}
          >
            {portalLoading ? 'Opening...' : 'Manage Subscription'}
          </button>
        ) : (
          <div style={styles.upgradeGrid}>
            {['starter', 'pro', 'enterprise'].map(plan => (
              <button
                key={plan}
                onClick={() => handleUpgrade(plan)}
                disabled={portalLoading || billing?.plan === plan}
                style={{
                  ...styles.upgradeBtn,
                  opacity: billing?.plan === plan ? 0.5 : 1,
                }}
              >
                {billing?.plan === plan ? 'Current' : `Upgrade to ${PLAN_LABELS[plan]?.split(' ')[0]}`}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    maxWidth: 640,
    margin: '0 auto',
    padding: '32px 24px',
  },
  title: {
    fontSize: 24,
    fontWeight: 800,
    color: '#1a1a2e',
    marginBottom: 24,
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: 24,
    border: '1px solid #e5e7eb',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#374151',
    marginBottom: 16,
  },
  planDisplay: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  planName: {
    fontSize: 20,
    fontWeight: 800,
    color: '#1a1a2e',
  },
  planStatus: {
    fontSize: 13,
    fontWeight: 600,
    padding: '4px 12px',
    borderRadius: 100,
    background: '#f0fdf4',
    color: '#16a34a',
  },
  subDetails: {
    borderTop: '1px solid #f3f4f6',
    paddingTop: 12,
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 14,
    color: '#374151',
    padding: '6px 0',
  },
  detailLabel: {
    color: '#6b7280',
  },
  actions: {
    marginTop: 8,
  },
  button: {
    width: '100%',
    padding: '14px 0',
    background: '#3b5bdb',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  upgradeGrid: {
    display: 'flex',
    gap: 12,
  },
  upgradeBtn: {
    flex: 1,
    padding: '12px 0',
    background: '#3b5bdb',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  successBanner: {
    padding: '12px 16px',
    background: '#f0fdf4',
    color: '#16a34a',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 16,
    border: '1px solid #bbf7d0',
  },
  warningBanner: {
    padding: '12px 16px',
    background: '#fffbeb',
    color: '#d97706',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 16,
    border: '1px solid #fde68a',
  },
  errorBanner: {
    padding: '12px 16px',
    background: '#fef2f2',
    color: '#dc2626',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 16,
    border: '1px solid #fecaca',
  },
};

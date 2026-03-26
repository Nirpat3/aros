import { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, tenant, loading } = useAuth();
  const path = window.location.pathname;

  // Loading state — show centered spinner
  if (loading) {
    return (
      <div style={styles.wrapper}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading...</p>
      </div>
    );
  }

  // No session — redirect to login
  if (!session) {
    window.location.href = '/login';
    return null;
  }

  // Session exists but no tenant, and not already on onboarding
  if (!tenant && !path.startsWith('/onboarding')) {
    window.location.href = '/onboarding';
    return null;
  }

  return <>{children}</>;
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #f0f4ff 0%, #e8ecf8 50%, #f5f3ff 100%)',
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #e5e7eb',
    borderTopColor: '#3b5bdb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: 500,
  },
};

// Inject keyframes for spinner animation
if (typeof document !== 'undefined' && !document.getElementById('protected-route-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'protected-route-styles';
  styleEl.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(styleEl);
}

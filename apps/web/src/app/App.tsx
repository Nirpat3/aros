import { WhitelabelProvider } from '../whitelabel/WhitelabelProvider';
import { ArosChat } from '../aros-ai/ArosChat';
import { Sidebar } from '../components/Sidebar';
import { Dashboard } from '../components/Dashboard';
import { SubmitPlugin } from '../admin/SubmitPlugin';
import { AuthPage } from '../pages/auth/AuthPage';
import { useAuth } from '../admin/useAuth';

const MARKETPLACE_ADMIN_URL = (window as any).__MARKETPLACE_URL__
  ? `${(window as any).__MARKETPLACE_URL__}/admin`
  : window.location.hostname === 'localhost'
    ? 'http://localhost:5458/admin'
    : 'https://marketplace.nirtek.net/admin';

function AppContent() {
  const { user, isAdmin } = useAuth();
  const path = window.location.pathname;

  // Auth pages are always accessible
  if (path.startsWith('/auth') || path.startsWith('/login') || path.startsWith('/signup')) {
    return <AuthPage />;
  }

  // All other pages require authentication
  if (!user) {
    return <AuthPage />;
  }

  // Admin panel lives at shre-marketplace — redirect there
  if (path.startsWith('/admin') && isAdmin) {
    window.location.href = MARKETPLACE_ADMIN_URL;
    return null;
  }

  if (path.startsWith('/submit-plugin')) {
    return <SubmitPlugin />;
  }

  return (
    <div className="aros-app">
      <Sidebar />
      <main className="aros-main">
        <Dashboard />
      </main>
      <ArosChat />
    </div>
  );
}

export function App() {
  return (
    <WhitelabelProvider>
      <AppContent />
    </WhitelabelProvider>
  );
}

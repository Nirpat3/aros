import { WhitelabelProvider } from '../whitelabel/WhitelabelProvider';
import { ArosChat } from '../aros-ai/ArosChat';
import { Sidebar } from '../components/Sidebar';
import { Dashboard } from '../components/Dashboard';
import { SubmitPlugin } from '../admin/SubmitPlugin';
import { useAuth } from '../admin/useAuth';

const MARKETPLACE_ADMIN_URL = (window as any).__MARKETPLACE_URL__
  ? `${(window as any).__MARKETPLACE_URL__}/admin`
  : window.location.hostname === 'localhost'
    ? 'http://localhost:5458/admin'
    : 'https://marketplace.nirtek.net/admin';

function AppContent() {
  const { isAdmin } = useAuth();
  const path = window.location.pathname;

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

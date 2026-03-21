import { WhitelabelProvider } from '../whitelabel/WhitelabelProvider';
import { ArosChat } from '../aros-ai/ArosChat';
import { Sidebar } from '../components/Sidebar';
import { Dashboard } from '../components/Dashboard';
import { AuthPage } from '../pages/auth/AuthPage';
import { OnboardingPage } from '../pages/onboarding/OnboardingPage';
import { MarketplacePage } from '../pages/marketplace/MarketplacePage';
import { DeveloperPortal } from '../pages/developers/DeveloperPortal';
import { LandingPage } from '../pages/landing/LandingPage';
import { CostsPage } from '../pages/costs/CostsPage';
import { useAuth } from '../admin/useAuth';

const MARKETPLACE_ADMIN_URL = (window as any).__MARKETPLACE_URL__
  ? `${(window as any).__MARKETPLACE_URL__}/admin`
  : window.location.hostname === 'localhost'
    ? 'http://localhost:5458/admin'
    : 'https://marketplace.nirtek.net/admin';

function isOnboardingComplete(): boolean {
  return localStorage.getItem('aros-onboarding-complete') === 'true'
    || sessionStorage.getItem('aros-onboarding-complete') === 'true';
}

function AppContent() {
  const { user, isAdmin } = useAuth();
  const path = window.location.pathname;

  // ── Public pages (no auth required) ────────────────────────
  // Landing page at root — only when NOT logged in
  if (path === '/' && !user) {
    return <LandingPage />;
  }

  // Auth pages
  if (path.startsWith('/login') || path.startsWith('/signup') || path.startsWith('/auth')) {
    // If already logged in, redirect to dashboard or onboarding
    if (user) {
      window.location.href = isOnboardingComplete() ? '/dashboard' : '/onboarding';
      return null;
    }
    return <AuthPage />;
  }

  // ── Auth-required pages ────────────────────────────────────
  if (!user) {
    // Redirect unauthenticated users to login
    window.location.href = '/login';
    return null;
  }

  // Onboarding — full-screen, no sidebar
  if (path.startsWith('/onboarding')) {
    return <OnboardingPage />;
  }

  // Gate: new users who haven't completed onboarding get redirected
  if (!isOnboardingComplete()) {
    const params = new URLSearchParams(window.location.search);
    if (params.has('payment')) {
      // Payment callback — show onboarding to handle it
      return <OnboardingPage />;
    }
    window.location.href = '/onboarding';
    return null;
  }

  // Admin panel → marketplace admin
  if (path.startsWith('/admin') && isAdmin) {
    window.location.href = MARKETPLACE_ADMIN_URL;
    return null;
  }

  // Developers portal
  if (path.startsWith('/developers') || path.startsWith('/submit-plugin')) {
    return (
      <div className="aros-app">
        <Sidebar />
        <main className="aros-main">
          <DeveloperPortal />
        </main>
        <ArosChat />
      </div>
    );
  }

  // Costs & Billing
  if (path.startsWith('/costs') || path.startsWith('/billing')) {
    return (
      <div className="aros-app">
        <Sidebar />
        <main className="aros-main">
          <CostsPage />
        </main>
        <ArosChat />
      </div>
    );
  }

  // Marketplace
  if (path.startsWith('/marketplace')) {
    return (
      <div className="aros-app">
        <Sidebar />
        <main className="aros-main">
          <MarketplacePage />
        </main>
        <ArosChat />
      </div>
    );
  }

  // Dashboard (default for logged-in users)
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

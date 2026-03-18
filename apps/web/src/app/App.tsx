import { WhitelabelProvider } from '../whitelabel/WhitelabelProvider';
import { ArosChat } from '../aros-ai/ArosChat';
import { Sidebar } from '../components/Sidebar';
import { Dashboard } from '../components/Dashboard';

export function App() {
  return (
    <WhitelabelProvider>
      <div className="aros-app">
        <Sidebar />
        <main className="aros-main">
          <Dashboard />
        </main>
        <ArosChat />
      </div>
    </WhitelabelProvider>
  );
}

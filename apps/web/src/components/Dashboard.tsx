import { useWhitelabel } from '../whitelabel/WhitelabelProvider';

export function Dashboard() {
  const { config } = useWhitelabel();

  return (
    <div className="aros-dashboard">
      <h1>Welcome to {config.brand.name}</h1>
      <p>{config.brand.tagline}</p>
      <div className="aros-dashboard-grid">
        <div className="aros-card">
          <h3>Installed Nodes</h3>
          <p className="aros-metric">0</p>
        </div>
        <div className="aros-card">
          <h3>Platform Version</h3>
          <p className="aros-metric">0.1.0</p>
        </div>
        <div className="aros-card">
          <h3>Status</h3>
          <p className="aros-metric aros-status-healthy">Healthy</p>
        </div>
      </div>
    </div>
  );
}

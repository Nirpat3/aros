// ── ConnectorSetup ──────────────────────────────────────────────
// UI for configuring Azure DB + RapidRMS API connectors.

import React, { useState, useCallback } from 'react';
import type { SecureFieldResult } from '../../../../../security/secure-field.js';
import { SecureField } from '../../../../../security/secure-field.js';

// ── Types ───────────────────────────────────────────────────────

interface ConnectorSetupProps {
  tenantId: string;
  onSave: (type: 'azure-db' | 'rapidrms-api', config: Record<string, unknown>) => void;
  onTest: (type: 'azure-db' | 'rapidrms-api', config: Record<string, unknown>) => Promise<TestResult>;
  onLinkStorePulse: (type: 'azure-db' | 'rapidrms-api', linked: boolean) => void;
}

interface TestResult {
  success: boolean;
  latencyMs?: number;
  error?: string;
}

// ── Component ───────────────────────────────────────────────────

export function ConnectorSetup({ tenantId, onSave, onTest, onLinkStorePulse }: ConnectorSetupProps) {
  return (
    <div className="connector-setup" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <AzureDbPanel tenantId={tenantId} onSave={onSave} onTest={onTest} onLinkStorePulse={onLinkStorePulse} />
      <RapidRmsPanel tenantId={tenantId} onSave={onSave} onTest={onTest} onLinkStorePulse={onLinkStorePulse} />
    </div>
  );
}

// ── Azure DB Panel ──────────────────────────────────────────────

function AzureDbPanel({ tenantId, onSave, onTest, onLinkStorePulse }: ConnectorSetupProps) {
  const [server, setServer] = useState('');
  const [database, setDatabase] = useState('');
  const [username, setUsername] = useState('');
  const [port, setPort] = useState('1433');
  const [password, setPassword] = useState<SecureFieldResult | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [linked, setLinked] = useState(false);

  const config = useCallback(() => ({
    server,
    database,
    username,
    port: parseInt(port, 10) || 1433,
    ssl: true,
    encrypt: true,
    passwordEncrypted: password?.encryptedValue ?? '',
  }), [server, database, username, port, password]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    const result = await onTest('azure-db', config());
    setTestResult(result);
    setTesting(false);
  }, [config, onTest]);

  const handleSave = useCallback(() => {
    onSave('azure-db', config());
  }, [config, onSave]);

  const toggleLink = useCallback(() => {
    const next = !linked;
    setLinked(next);
    onLinkStorePulse('azure-db', next);
  }, [linked, onLinkStorePulse]);

  return (
    <div className="connector-panel" style={panelStyle}>
      <h3 style={{ margin: '0 0 16px' }}>Azure SQL Database</h3>
      <StatusBadge result={testResult} />

      <label style={labelStyle}>Server</label>
      <input value={server} onChange={(e) => setServer(e.target.value)} placeholder="yourserver.database.windows.net" style={inputStyle} />

      <label style={labelStyle}>Database</label>
      <input value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="mydb" style={inputStyle} />

      <label style={labelStyle}>Username</label>
      <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" style={inputStyle} />

      <label style={labelStyle}>Port</label>
      <input value={port} onChange={(e) => setPort(e.target.value)} placeholder="1433" style={inputStyle} />

      <label style={labelStyle}>Password</label>
      <SecureField name="azure-password" alwaysSecure onChange={setPassword} />

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={handleTest} disabled={testing} style={btnStyle}>
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <button onClick={handleSave} style={{ ...btnStyle, background: '#2563eb', color: '#fff' }}>
          Save Connector
        </button>
      </div>

      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <input type="checkbox" checked={linked} onChange={toggleLink} />
        Link to StorePulse
      </label>
    </div>
  );
}

// ── RapidRMS Panel ──────────────────────────────────────────────

function RapidRmsPanel({ tenantId, onSave, onTest, onLinkStorePulse }: ConnectorSetupProps) {
  const [baseUrl, setBaseUrl] = useState('https://rapidrmsapi.azurewebsites.net');
  const [clientId, setClientId] = useState('');
  const [email, setEmail] = useState<SecureFieldResult | null>(null);
  const [password, setPassword] = useState<SecureFieldResult | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [linked, setLinked] = useState(false);

  const config = useCallback(() => ({
    baseUrl,
    clientId,
    sessionTimeout: 420,
    emailEncrypted: email?.encryptedValue ?? '',
    passwordEncrypted: password?.encryptedValue ?? '',
  }), [baseUrl, clientId, email, password]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    const result = await onTest('rapidrms-api', config());
    setTestResult(result);
    setTesting(false);
  }, [config, onTest]);

  const handleSave = useCallback(() => {
    onSave('rapidrms-api', config());
  }, [config, onSave]);

  const toggleLink = useCallback(() => {
    const next = !linked;
    setLinked(next);
    onLinkStorePulse('rapidrms-api', next);
  }, [linked, onLinkStorePulse]);

  return (
    <div className="connector-panel" style={panelStyle}>
      <h3 style={{ margin: '0 0 16px' }}>RapidRMS API</h3>
      <StatusBadge result={testResult} />

      <label style={labelStyle}>Base URL</label>
      <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://rapidrmsapi.azurewebsites.net" style={inputStyle} />

      <label style={labelStyle}>Client ID</label>
      <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="your-client-id" style={inputStyle} />

      <label style={labelStyle}>Email</label>
      <SecureField name="rapidrms-email" alwaysSecure onChange={setEmail} />

      <label style={labelStyle}>Password</label>
      <SecureField name="rapidrms-password" alwaysSecure onChange={setPassword} />

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={handleTest} disabled={testing} style={btnStyle}>
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <button onClick={handleSave} style={{ ...btnStyle, background: '#2563eb', color: '#fff' }}>
          Save Connector
        </button>
      </div>

      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <input type="checkbox" checked={linked} onChange={toggleLink} />
        Link to StorePulse
      </label>
    </div>
  );
}

// ── Status Badge ────────────────────────────────────────────────

function StatusBadge({ result }: { result: TestResult | null }) {
  if (!result) return null;

  const style: React.CSSProperties = {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 12,
  };

  if (result.success) {
    return (
      <span style={{ ...style, background: '#d1fae5', color: '#065f46' }}>
        Connected {result.latencyMs ? `(${result.latencyMs}ms)` : ''}
      </span>
    );
  }

  return (
    <span style={{ ...style, background: '#fee2e2', color: '#991b1b' }}>
      Error: {result.error ?? 'Connection failed'}
    </span>
  );
}

// ── Styles ──────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 20,
  background: '#fafafa',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: '#374151',
  marginTop: 12,
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  fontSize: 14,
  boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
};

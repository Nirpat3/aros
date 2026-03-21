import { useState, type FormEvent } from 'react';
import { useAuth } from './useAuth';

const MARKETPLACE_URL = (window as any).__MARKETPLACE_URL__
  ?? (window.location.hostname === 'localhost' ? 'http://localhost:5458' : 'https://marketplace.nirtek.net');

const CATEGORIES = [
  'pos', 'pos-connector', 'inventory', 'analytics', 'loyalty',
  'marketing', 'payments', 'shipping', 'crm', 'reporting',
  'database', 'integration', 'utility',
];

const font = '-apple-system, "SF Pro Text", BlinkMacSystemFont, "Helvetica Neue", system-ui, sans-serif';

interface FieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ label, required, children }: FieldProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#ececf1', fontFamily: font, outline: 'none', boxSizing: 'border-box',
};

export function SubmitPlugin() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('integration');
  const [changelog, setChangelog] = useState('');
  const [packageName, setPackageName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [demoUser, setDemoUser] = useState('');
  const [demoPass, setDemoPass] = useState('');
  const [demoEnv, setDemoEnv] = useState<'sandbox' | 'staging' | 'production'>('sandbox');
  const [demoInstructions, setDemoInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch(`${MARKETPLACE_URL}/api/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, version, description, category, changelog, packageName, sourceUrl,
          submitterId: user?.sub ?? 'anonymous',
          submitterEmail: user?.email ?? 'unknown',
          demoCredentials: {
            url: demoUrl, username: demoUser, password: demoPass,
            environment: demoEnv, instructions: demoInstructions || undefined,
          },
        }),
      });
      if (res.ok) {
        setResult({ ok: true, message: 'Plugin submitted for review. You will be notified when it is approved.' });
        setName(''); setVersion('1.0.0'); setDescription(''); setChangelog('');
        setPackageName(''); setSourceUrl('');
        setDemoUrl(''); setDemoUser(''); setDemoPass(''); setDemoInstructions('');
      } else {
        const err = await res.json().catch(() => ({ error: 'Submission failed' }));
        setResult({ ok: false, message: err.error ?? 'Submission failed' });
      }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Network error — is shre-marketplace running?' });
    }
    setSubmitting(false);
  };

  const canSubmit = name.trim() && version.trim() && description.trim() && packageName.trim()
    && demoUrl.trim() && demoUser.trim() && demoPass.trim();

  return (
    <div style={{ padding: 32, fontFamily: font, color: '#ececf1', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 4 }}>Submit a Plugin</h1>
      <p style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 8 }}>
        Submit your plugin for review. Like the App Store, you must provide demo credentials
        so reviewers can test your integration before it goes live.
      </p>

      {result && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 20, fontSize: 13,
          background: result.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${result.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
          color: result.ok ? '#6EE7B7' : '#FCA5A5',
        }}>
          {result.message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Plugin info */}
        <div style={{
          padding: 20, borderRadius: 14, marginBottom: 20,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#638dff', marginBottom: 16 }}>Plugin Information</div>
          <Field label="Plugin Name" required>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My POS Connector" style={inputStyle} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Version" required>
              <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.0" style={inputStyle} />
            </Field>
            <Field label="Category" required>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description" required>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              placeholder="What does this plugin do?" style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
          <Field label="Package Name" required>
            <input value={packageName} onChange={(e) => setPackageName(e.target.value)} placeholder="@acme/pos-connector" style={inputStyle} />
          </Field>
          <Field label="Source URL">
            <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://github.com/..." style={inputStyle} />
          </Field>
          <Field label="Changelog">
            <textarea value={changelog} onChange={(e) => setChangelog(e.target.value)} rows={2}
              placeholder="What's new in this version?" style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
        </div>

        {/* Demo credentials */}
        <div style={{
          padding: 20, borderRadius: 14, marginBottom: 24,
          background: 'rgba(99,141,255,0.04)', border: '1px solid rgba(99,141,255,0.12)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#638dff', marginBottom: 4 }}>Demo Credentials</div>
          <div style={{ fontSize: 12, color: '#6b6b76', marginBottom: 16 }}>
            Required for review. Provide a working environment where reviewers can test your plugin.
          </div>
          <Field label="Demo URL" required>
            <input value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} placeholder="https://demo.example.com" style={inputStyle} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Username" required>
              <input value={demoUser} onChange={(e) => setDemoUser(e.target.value)} placeholder="demo@example.com" style={inputStyle} />
            </Field>
            <Field label="Password" required>
              <input value={demoPass} onChange={(e) => setDemoPass(e.target.value)} type="password" placeholder="demo-password" style={inputStyle} />
            </Field>
          </div>
          <Field label="Environment">
            <select value={demoEnv} onChange={(e) => setDemoEnv(e.target.value as 'sandbox' | 'staging' | 'production')} style={{ ...inputStyle, appearance: 'auto' }}>
              <option value="sandbox">Sandbox</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </Field>
          <Field label="Testing Instructions">
            <textarea value={demoInstructions} onChange={(e) => setDemoInstructions(e.target.value)} rows={2}
              placeholder="Use store #1 for testing, test card: 4242..." style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
        </div>

        <button
          type="submit"
          disabled={!canSubmit || submitting}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 10, border: 'none',
            cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
            background: canSubmit && !submitting ? '#638dff' : 'rgba(255,255,255,0.08)',
            color: canSubmit && !submitting ? '#fff' : '#6b6b76',
            fontSize: 14, fontWeight: 600, fontFamily: font, transition: 'all 150ms',
          }}
        >
          {submitting ? 'Submitting...' : 'Submit for Review'}
        </button>
      </form>
    </div>
  );
}

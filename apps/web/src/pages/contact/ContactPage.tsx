import { useState, FormEvent } from 'react';

const LEADS_API = (window as any).__LEADS_API_URL__
  || (window.location.hostname === 'localhost' ? 'http://localhost:5453' : 'https://api.nirtek.net');

const INQUIRY_TYPES = [
  { value: '', label: 'What can we help with?' },
  { value: 'sales', label: 'Sales — I want a demo or pricing info' },
  { value: 'support', label: 'Support — I need help with AROS' },
  { value: 'partnership', label: 'Partnership — Business or integration' },
  { value: 'enterprise', label: 'Enterprise — Custom deployment' },
  { value: 'other', label: 'Other' },
];

const POS_SYSTEMS = [
  { value: '', label: 'Current POS system (optional)' },
  { value: 'rapidrms', label: 'RapidRMS' },
  { value: 'verifone-commander', label: 'Verifone Commander' },
  { value: 'other', label: 'Other' },
];

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [inquiryType, setInquiryType] = useState('');
  const [posSystem, setPosSystem] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch(`${LEADS_API}/api/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          business_name: company.trim() || undefined,
          posSystem: posSystem || undefined,
          source: `contact_form_${inquiryType || 'general'}`,
          utm_campaign: inquiryType || undefined,
          notes: message.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div style={styles.page}>
        <Nav />
        <div style={styles.wrapper}>
          <div style={styles.successCard}>
            <div style={styles.successIcon}>&#10003;</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Message received</h2>
            <p style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.6, marginBottom: 24 }}>
              Our team will get back to you within 1 business day.
              {inquiryType === 'sales' && ' We\'ll prepare a personalized demo for your business.'}
              {inquiryType === 'enterprise' && ' An enterprise specialist will reach out directly.'}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <a href="/" style={styles.btn}>Back to Home</a>
              <a href="/signup" style={styles.btnOutline}>Create Account</a>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <Nav />

      <section style={styles.hero}>
        <h1 style={styles.heroTitle}>Get in touch</h1>
        <p style={styles.heroDesc}>
          Have questions about AROS? Want a demo? Our team is here to help.
        </p>
      </section>

      <div style={styles.wrapper}>
        <div style={styles.grid}>
          {/* Contact Form */}
          <div style={styles.formCard}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Send us a message</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>
              Fill out the form and we'll get back to you within 1 business day.
            </p>

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Full Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="John Smith"
                    required
                    autoFocus
                    style={styles.input}
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Work Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@yourstore.com"
                    required
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.row}>
                <div style={styles.field}>
                  <label style={styles.label}>Company</label>
                  <input
                    type="text"
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    placeholder="Your business name"
                    style={styles.input}
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>POS System</label>
                  <select
                    value={posSystem}
                    onChange={e => setPosSystem(e.target.value)}
                    style={styles.input}
                  >
                    {POS_SYSTEMS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>How can we help? *</label>
                <select
                  value={inquiryType}
                  onChange={e => setInquiryType(e.target.value)}
                  required
                  style={styles.input}
                >
                  {INQUIRY_TYPES.map(t => (
                    <option key={t.value} value={t.value} disabled={!t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Message</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Tell us about your needs, number of stores, or any questions..."
                  rows={4}
                  style={{ ...styles.input, resize: 'vertical' as const }}
                />
              </div>

              {error && <div style={styles.error}>{error}</div>}

              <button
                type="submit"
                disabled={submitting}
                style={submitting ? { ...styles.submitBtn, opacity: 0.6 } : styles.submitBtn}
              >
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>

          {/* Info Cards */}
          <div style={styles.infoCol}>
            <div style={styles.infoCard}>
              <div style={styles.infoIcon}>S</div>
              <h3 style={styles.infoTitle}>Sales</h3>
              <p style={styles.infoDesc}>
                Get a personalized demo, pricing, or learn how AROS can transform your retail operations.
              </p>
              <button
                type="button"
                onClick={() => { setInquiryType('sales'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                style={styles.infoBtn}
              >
                Contact Sales
              </button>
            </div>

            <div style={styles.infoCard}>
              <div style={styles.infoIcon}>H</div>
              <h3 style={styles.infoTitle}>Support</h3>
              <p style={styles.infoDesc}>
                Need help with your account, integration, or agents? Our team has you covered.
              </p>
              <a href="https://support.nirtek.net" target="_blank" rel="noopener" style={styles.infoBtn}>
                Visit Support
              </a>
            </div>

            <div style={styles.infoCard}>
              <div style={styles.infoIcon}>P</div>
              <h3 style={styles.infoTitle}>Partnerships</h3>
              <p style={styles.infoDesc}>
                POS vendor, reseller, or integration partner? Let's build together.
              </p>
              <button
                type="button"
                onClick={() => { setInquiryType('partnership'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                style={styles.infoBtn}
              >
                Partner With Us
              </button>
            </div>

            <div style={styles.infoCard}>
              <div style={styles.infoIcon}>D</div>
              <h3 style={styles.infoTitle}>Developers</h3>
              <p style={styles.infoDesc}>
                Build integrations with our POS SDK. Multi-language support, full API docs.
              </p>
              <a href="https://developers.nirtek.net" target="_blank" rel="noopener" style={styles.infoBtn}>
                Developer Portal
              </a>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <nav style={styles.nav}>
      <div style={styles.navInner}>
        <a href="/" style={styles.navBrand}>AROS</a>
        <div style={styles.navLinks}>
          <a href="/#features" style={styles.navLink}>Features</a>
          <a href="/#pricing" style={styles.navLink}>Pricing</a>
          <a href="/contact" style={{ ...styles.navLink, color: '#3b5bdb' }}>Contact</a>
          <a href="/login" style={styles.navLink}>Sign In</a>
          <a href="/signup" style={styles.navCta}>Get Started</a>
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer style={styles.footer}>
      <div style={styles.footerInner}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>AROS</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>Agentic Retail Operating System</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>By Nirlab Inc.</div>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <a href="https://nirtek.net/terms.html" target="_blank" rel="noopener" style={styles.footerLink}>Terms</a>
          <a href="https://nirtek.net/privacy.html" target="_blank" rel="noopener" style={styles.footerLink}>Privacy</a>
          <a href="/contact" style={styles.footerLink}>Contact</a>
        </div>
      </div>
    </footer>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
    color: '#1a1a2e',
    background: '#fff',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  nav: {
    position: 'sticky' as const,
    top: 0,
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid #f0f0f0',
    zIndex: 100,
  },
  navInner: {
    maxWidth: 1100, margin: '0 auto', padding: '14px 24px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  navBrand: { fontSize: 22, fontWeight: 800, color: '#1a1a2e', textDecoration: 'none', letterSpacing: -0.5 },
  navLinks: { display: 'flex', alignItems: 'center', gap: 24 },
  navLink: { fontSize: 14, fontWeight: 500, color: '#6b7280', textDecoration: 'none' },
  navCta: {
    fontSize: 14, fontWeight: 600, color: '#fff', textDecoration: 'none',
    background: '#3b5bdb', padding: '8px 20px', borderRadius: 8,
  },
  hero: {
    padding: '60px 24px 32px', textAlign: 'center' as const,
    background: 'linear-gradient(135deg, #f0f4ff 0%, #e8ecf8 50%, #f5f3ff 100%)',
  },
  heroTitle: { fontSize: 40, fontWeight: 800, letterSpacing: -1, marginBottom: 12 },
  heroDesc: { fontSize: 17, color: '#4b5563', maxWidth: 500, margin: '0 auto', lineHeight: 1.6 },
  wrapper: { maxWidth: 1100, margin: '0 auto', padding: '48px 24px', flex: 1 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32, alignItems: 'start' },
  formCard: {
    background: '#fff', borderRadius: 16, padding: '32px 28px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb',
  },
  form: { display: 'flex', flexDirection: 'column' as const, gap: 16 },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  field: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  input: {
    padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 10,
    fontSize: 15, fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.2s',
  },
  error: {
    padding: '10px 14px', background: '#fef2f2', color: '#dc2626',
    borderRadius: 8, fontSize: 13, fontWeight: 500,
  },
  submitBtn: {
    padding: '14px 0', background: '#3b5bdb', color: '#fff', border: 'none',
    borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', marginTop: 4,
  },
  infoCol: { display: 'flex', flexDirection: 'column' as const, gap: 16 },
  infoCard: {
    background: '#f8f9fb', borderRadius: 14, padding: 20,
    border: '1px solid #f0f0f0',
  },
  infoIcon: {
    width: 36, height: 36, borderRadius: 8, background: 'rgba(59,91,219,0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, fontWeight: 800, color: '#3b5bdb', marginBottom: 10,
  },
  infoTitle: { fontSize: 15, fontWeight: 700, marginBottom: 4 },
  infoDesc: { fontSize: 13, color: '#6b7280', lineHeight: 1.5, marginBottom: 12, margin: '0 0 12px 0' },
  infoBtn: {
    display: 'inline-block', fontSize: 13, fontWeight: 600, color: '#3b5bdb',
    textDecoration: 'none', cursor: 'pointer', background: 'none', border: 'none',
    padding: 0, fontFamily: 'inherit',
  },
  successCard: {
    maxWidth: 480, margin: '80px auto', textAlign: 'center' as const,
    background: '#fff', borderRadius: 16, padding: '48px 32px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb',
  },
  successIcon: {
    width: 56, height: 56, borderRadius: 28, background: '#ecfdf5', color: '#059669',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 28, fontWeight: 800, margin: '0 auto 20px',
  },
  btn: {
    padding: '12px 28px', background: '#3b5bdb', color: '#fff', borderRadius: 10,
    fontSize: 14, fontWeight: 600, textDecoration: 'none',
  },
  btnOutline: {
    padding: '12px 28px', background: '#fff', color: '#374151', borderRadius: 10,
    fontSize: 14, fontWeight: 600, textDecoration: 'none', border: '1px solid #d1d5db',
  },
  footer: { borderTop: '1px solid #f0f0f0', padding: '32px 24px', background: '#fafbfc' },
  footerInner: {
    maxWidth: 1100, margin: '0 auto', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center',
  },
  footerLink: { fontSize: 13, color: '#6b7280', textDecoration: 'none' },
};

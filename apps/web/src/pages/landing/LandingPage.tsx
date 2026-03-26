export function LandingPage() {
  return (
    <div style={styles.page}>
      {/* Navbar */}
      <nav style={styles.nav}>
        <div style={styles.navInner}>
          <a href="/" style={styles.navBrand}>AROS</a>
          <div style={styles.navLinks}>
            <a href="#features" style={styles.navLink}>Features</a>
            <a href="#pricing" style={styles.navLink}>Pricing</a>
            <a href="/marketplace" style={styles.navLink}>Marketplace</a>
            <a href="/developers" style={styles.navLink}>Developers</a>
            <a href="https://nirtek.net/blog.html" style={styles.navLink} target="_blank" rel="noopener">Blog</a>
            <a href="https://support.nirtek.net" style={styles.navLink} target="_blank" rel="noopener">Support</a>
            <a href="/login" style={styles.navLink}>Sign In</a>
            <a href="/signup" style={styles.navCta}>Get Started</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={styles.hero}>
        <div style={styles.heroInner}>
          <div style={styles.badge}>AI-Powered Retail Platform</div>
          <h1 style={styles.heroTitle}>
            Your Store,<br />Run by AI Agents
          </h1>
          <p style={styles.heroDesc}>
            AROS is the operating system for modern retail. AI agents handle inventory,
            analytics, customer support, and operations — so you can focus on growing your business.
          </p>
          <div style={styles.heroBtns}>
            <a href="/signup" style={styles.heroBtn}>Start Free</a>
            <a href="#features" style={styles.heroBtnOutline}>See How It Works</a>
          </div>
          <p style={styles.heroNote}>No credit card required. Free plan includes 1 store.</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={styles.section}>
        <h2 style={styles.sectionTitle}>Everything your store needs</h2>
        <p style={styles.sectionDesc}>AI agents that work 24/7, learning and improving with every transaction.</p>
        <div style={styles.featureGrid}>
          {[
            { title: 'POS Integration', desc: 'Connect RapidRMS, Verifone Commander, and more — real-time transaction sync with automated inventory management.', icon: 'S' },
            { title: 'AI Analytics', desc: 'Daily sales reports, trend detection, cost breakdowns, and predictive reordering — generated automatically.', icon: 'A' },
            { title: 'Agent Workforce', desc: 'Up to 14 specialized AI agents handle support, analytics, operations, inventory, and marketing.', icon: 'W' },
            { title: 'Fleet Management', desc: 'Multi-store operators get unified dashboards, cross-location analytics, and centralized agent management.', icon: 'F' },
            { title: 'Marketplace', desc: 'Browse and install integrations — POS connectors, cloud storage, payments, messaging, and more.', icon: 'M' },
            { title: 'Self-Hosted Option', desc: 'Run AROS on your own server with Docker. Your data stays on your hardware. Full privacy, zero vendor lock-in.', icon: 'H' },
          ].map(f => (
            <div key={f.title} style={styles.featureCard}>
              <div style={styles.featureIcon}>{f.icon}</div>
              <h3 style={styles.featureTitle}>{f.title}</h3>
              <p style={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ ...styles.section, background: '#f8f9fb' }}>
        <h2 style={styles.sectionTitle}>Simple, transparent pricing</h2>
        <p style={styles.sectionDesc}>Start free. Scale as you grow. No hidden fees.</p>
        <div style={styles.pricingGrid}>
          {[
            { name: 'Free', price: '$0', period: 'forever', desc: 'Self-hosted, 1 store', features: ['1 store, 1 user', 'Local AI (Ollama)', 'Basic dashboards', 'Community support'], cta: 'Start Free', popular: false },
            { name: 'Starter', price: '$49', period: '/mo per store', desc: 'Managed hosting, cloud AI', features: ['1 store, 3 users', '5 AI agents', 'Cloud AI', 'Daily backups', 'Email support'], cta: 'Get Started', popular: true },
            { name: 'Pro', price: '$149', period: '/mo per store', desc: 'Advanced analytics', features: ['Up to 10 stores', '14 AI agents', 'Custom dashboards', 'API access', 'Priority support'], cta: 'Go Pro', popular: false },
            { name: 'Business', price: '$499', period: '/mo per store', desc: 'Fleet analytics, SSO', features: ['Up to 50 stores', 'All AI agents', 'Fleet analytics', 'SSO / SAML', 'White-label', 'Dedicated support'], cta: 'Contact Sales', popular: false },
          ].map(p => (
            <div key={p.name} style={{
              ...styles.pricingCard,
              border: p.popular ? '2px solid #3b5bdb' : '1px solid #e5e7eb',
            }}>
              {p.popular && <div style={styles.popularBadge}>Most Popular</div>}
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{p.name}</h3>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 800 }}>{p.price}</span>
                <span style={{ fontSize: 14, color: '#6b7280' }}>{p.period}</span>
              </div>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>{p.desc}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', flex: 1 }}>
                {p.features.map(f => (
                  <li key={f} style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>
                    <span style={{ color: '#059669', marginRight: 6 }}>&#10003;</span>{f}
                  </li>
                ))}
              </ul>
              <a href={p.cta === 'Contact Sales' ? '/contact' : '/signup'} style={{
                display: 'block', textAlign: 'center', padding: '12px 0', borderRadius: 10,
                fontWeight: 600, fontSize: 14, textDecoration: 'none',
                background: p.popular ? '#3b5bdb' : '#f3f4f6',
                color: p.popular ? '#fff' : '#374151',
              }}>
                {p.cta}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ ...styles.section, textAlign: 'center' }}>
        <h2 style={styles.sectionTitle}>Ready to automate your store?</h2>
        <p style={{ ...styles.sectionDesc, maxWidth: 500, margin: '0 auto 32px' }}>
          Join retailers using AI agents to run smarter, faster, and more profitable stores.
        </p>
        <a href="/signup" style={{
          ...styles.heroBtn, display: 'inline-block', padding: '16px 48px',
        }}>
          Get Started Free
        </a>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerInner}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>AROS</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Agentic Retail Operating System</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>By Nirlab Inc.</div>
          </div>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' as const }}>
            <div>
              <div style={styles.footerHeading}>Product</div>
              <a href="#features" style={styles.footerLink}>Features</a>
              <a href="#pricing" style={styles.footerLink}>Pricing</a>
              <a href="/marketplace" style={styles.footerLink}>Marketplace</a>
              <a href="https://status.nirtek.net" target="_blank" rel="noopener" style={styles.footerLink}>Status</a>
            </div>
            <div>
              <div style={styles.footerHeading}>Integrations</div>
              <a href="https://nirtek.net/pos/" target="_blank" rel="noopener" style={styles.footerLink}>POS Integrations</a>
              <a href="https://nirtek.net/pos/rapidrms.html" target="_blank" rel="noopener" style={styles.footerLink}>RapidRMS</a>
              <a href="https://nirtek.net/pos/verifone-commander.html" target="_blank" rel="noopener" style={styles.footerLink}>Verifone Commander</a>
              <a href="https://nirtek.net/partners.html" target="_blank" rel="noopener" style={styles.footerLink}>Partners</a>
            </div>
            <div>
              <div style={styles.footerHeading}>Developers</div>
              <a href="/developers" style={styles.footerLink}>Developer Portal</a>
              <a href="https://api.nirtek.net" target="_blank" rel="noopener" style={styles.footerLink}>API</a>
              <a href="https://developers.nirtek.net" target="_blank" rel="noopener" style={styles.footerLink}>SDK Docs</a>
              <a href="https://github.com/nirlab/aros" target="_blank" rel="noopener" style={styles.footerLink}>GitHub</a>
            </div>
            <div>
              <div style={styles.footerHeading}>Resources</div>
              <a href="https://nirtek.net/blog.html" target="_blank" rel="noopener" style={styles.footerLink}>Blog</a>
              <a href="https://support.nirtek.net" target="_blank" rel="noopener" style={styles.footerLink}>Support</a>
              <a href="https://nirtek.net/resources.html" target="_blank" rel="noopener" style={styles.footerLink}>Resources</a>
              <a href="https://nirtek.net/platform.html" target="_blank" rel="noopener" style={styles.footerLink}>Platform</a>
            </div>
            <div>
              <div style={styles.footerHeading}>Legal</div>
              <a href="https://nirtek.net/terms.html" target="_blank" rel="noopener" style={styles.footerLink}>Terms</a>
              <a href="https://nirtek.net/privacy.html" target="_blank" rel="noopener" style={styles.footerLink}>Privacy</a>
              <a href="/contact" style={styles.footerLink}>Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
    color: '#1a1a2e',
    background: '#fff',
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
    maxWidth: 1100,
    margin: '0 auto',
    padding: '14px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navBrand: {
    fontSize: 22, fontWeight: 800, color: '#1a1a2e', textDecoration: 'none', letterSpacing: -0.5,
  },
  navLinks: {
    display: 'flex', alignItems: 'center', gap: 24,
  },
  navLink: {
    fontSize: 14, fontWeight: 500, color: '#6b7280', textDecoration: 'none',
  },
  navCta: {
    fontSize: 14, fontWeight: 600, color: '#fff', textDecoration: 'none',
    background: '#3b5bdb', padding: '8px 20px', borderRadius: 8,
  },
  hero: {
    padding: '80px 24px 60px',
    textAlign: 'center' as const,
    background: 'linear-gradient(135deg, #f0f4ff 0%, #e8ecf8 50%, #f5f3ff 100%)',
  },
  heroInner: {
    maxWidth: 660, margin: '0 auto',
  },
  badge: {
    display: 'inline-block', fontSize: 12, fontWeight: 700, color: '#3b5bdb',
    background: 'rgba(59,91,219,0.1)', padding: '6px 16px', borderRadius: 100,
    marginBottom: 24, textTransform: 'uppercase' as const, letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 48, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1, marginBottom: 20,
  },
  heroDesc: {
    fontSize: 18, lineHeight: 1.6, color: '#4b5563', marginBottom: 32, maxWidth: 540, margin: '0 auto 32px',
  },
  heroBtns: {
    display: 'flex', justifyContent: 'center', gap: 12,
  },
  heroBtn: {
    padding: '14px 36px', background: '#3b5bdb', color: '#fff', borderRadius: 10,
    fontSize: 15, fontWeight: 700, textDecoration: 'none', border: 'none',
  },
  heroBtnOutline: {
    padding: '14px 36px', background: '#fff', color: '#374151', borderRadius: 10,
    fontSize: 15, fontWeight: 600, textDecoration: 'none', border: '1px solid #d1d5db',
  },
  heroNote: {
    fontSize: 13, color: '#9ca3af', marginTop: 16,
  },
  section: {
    padding: '72px 24px',
    maxWidth: 1100,
    margin: '0 auto',
  },
  sectionTitle: {
    fontSize: 32, fontWeight: 800, textAlign: 'center' as const, marginBottom: 8, letterSpacing: -0.5,
  },
  sectionDesc: {
    fontSize: 16, color: '#6b7280', textAlign: 'center' as const, marginBottom: 48,
  },
  featureGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20,
  },
  featureCard: {
    padding: 24, borderRadius: 14, background: '#fff', border: '1px solid #f0f0f0',
  },
  featureIcon: {
    width: 40, height: 40, borderRadius: 10, background: 'rgba(59,91,219,0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, fontWeight: 800, color: '#3b5bdb', marginBottom: 14,
  },
  featureTitle: {
    fontSize: 16, fontWeight: 700, marginBottom: 6,
  },
  featureDesc: {
    fontSize: 14, color: '#6b7280', lineHeight: 1.6, margin: 0,
  },
  pricingGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16, maxWidth: 960, margin: '0 auto',
  },
  pricingCard: {
    background: '#fff', borderRadius: 16, padding: '24px 20px',
    display: 'flex', flexDirection: 'column' as const, position: 'relative' as const,
  },
  popularBadge: {
    position: 'absolute' as const, top: -10, left: '50%', transform: 'translateX(-50%)',
    background: '#3b5bdb', color: '#fff', fontSize: 11, fontWeight: 700,
    padding: '4px 12px', borderRadius: 100, whiteSpace: 'nowrap' as const,
  },
  footer: {
    borderTop: '1px solid #f0f0f0', padding: '48px 24px 32px', background: '#fafbfc',
  },
  footerInner: {
    maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between',
    flexWrap: 'wrap' as const, gap: 40,
  },
  footerHeading: {
    fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase' as const,
  },
  footerLink: {
    display: 'block', fontSize: 13, color: '#6b7280', textDecoration: 'none', marginBottom: 8,
  },
};

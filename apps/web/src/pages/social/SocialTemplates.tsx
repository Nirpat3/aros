import { motion } from 'framer-motion';

/**
 * Social media content templates for AROS.
 * Open /social in the browser, then screenshot each card at the labeled size.
 * All templates are pixel-accurate to platform specs.
 */

const brand = {
  navy: '#0F172A',
  darkNavy: '#0B1120',
  blue: '#3B82F6',
  emerald: '#10B981',
  slate: '#94A3B8',
  white: '#FFFFFF',
};

const font = "Inter, -apple-system, system-ui, 'Segoe UI', sans-serif";

/* ─── shared mini-components ─── */
function Logo({ size = 32, color = brand.white }: { size?: number; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 40 40">
        <rect width="40" height="40" rx="8" fill={brand.navy} />
        <path d="M8 28 L16 14 L24 20 L32 10" stroke={brand.emerald} strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="32" cy="10" r="3" fill={brand.blue} />
      </svg>
      <span style={{ fontSize: size * 0.7, fontWeight: 800, color, letterSpacing: -1 }}>
        <span style={{ color: brand.emerald }}>A</span>ROS
      </span>
    </div>
  );
}

function GlowOrb({ x, y, size, color }: { x: string; y: string; size: number; color: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        filter: 'blur(60px)',
        pointerEvents: 'none',
      }}
    />
  );
}

function MiniChart({ height = 80 }: { height?: number }) {
  const bars = [55, 40, 70, 45, 85, 60, 90];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height }}>
      {bars.map((h, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          animate={{ height: `${h}%` }}
          transition={{ duration: 0.6, delay: i * 0.08 }}
          style={{
            flex: 1,
            borderRadius: 3,
            background:
              i === bars.length - 1
                ? 'linear-gradient(180deg, #3B82F6, #10B981)'
                : `rgba(59,130,246,${0.2 + i * 0.08})`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── template wrapper ─── */
function TemplateFrame({
  label,
  width,
  height,
  children,
}: {
  label: string;
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  // Scale down for display
  const scale = Math.min(1, 500 / width);
  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>
        {label} ({width}x{height})
      </div>
      <div
        style={{
          width: width * scale,
          height: height * scale,
          overflow: 'hidden',
          borderRadius: 8,
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          position: 'relative',
        }}
      >
        <div
          style={{
            width,
            height,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   TEMPLATES
   ═══════════════════════════════════════ */

/* 1. Instagram Post — Product Launch (1080x1080) */
function IGPost() {
  return (
    <TemplateFrame label="Instagram Post — Product Launch" width={1080} height={1080}>
      <div
        style={{
          width: 1080,
          height: 1080,
          background: brand.navy,
          fontFamily: font,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 80,
        }}
      >
        <GlowOrb x="10%" y="20%" size={300} color="rgba(59,130,246,0.12)" />
        <GlowOrb x="70%" y="60%" size={250} color="rgba(16,185,129,0.08)" />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <Logo size={48} />
          <div style={{ height: 48 }} />
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: brand.emerald,
              textTransform: 'uppercase',
              letterSpacing: 2,
              marginBottom: 24,
            }}
          >
            Now Available
          </div>
          <h1
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: brand.white,
              lineHeight: 1.1,
              letterSpacing: -2,
              marginBottom: 24,
            }}
          >
            Your Store,
            <br />
            <span
              style={{
                background: 'linear-gradient(135deg, #3B82F6, #10B981)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Run by AI
            </span>
          </h1>
          <p style={{ fontSize: 22, color: brand.slate, lineHeight: 1.5, maxWidth: 600 }}>
            14 AI agents. Real-time analytics.
            <br />
            One operating system for your store.
          </p>

          {/* mini dashboard preview */}
          <div
            style={{
              marginTop: 48,
              padding: '24px 32px',
              borderRadius: 16,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              width: 500,
            }}
          >
            <MiniChart height={100} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <span style={{ fontSize: 13, color: brand.slate }}>Mon</span>
              <span style={{ fontSize: 13, color: brand.slate }}>Sun</span>
            </div>
          </div>

          <div
            style={{
              marginTop: 48,
              display: 'inline-block',
              padding: '16px 48px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
              color: brand.white,
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            Start Free at nirtek.net
          </div>
        </div>
      </div>
    </TemplateFrame>
  );
}

/* 2. Instagram Story — Feature Highlight (1080x1920) */
function IGStory() {
  const features = [
    { icon: '📊', title: 'AI Analytics', desc: 'Real-time sales, trends & predictions' },
    { icon: '🤖', title: '14 AI Agents', desc: 'Support, inventory, marketing & more' },
    { icon: '🔗', title: 'POS Integration', desc: 'RapidRMS, Clover, Square, Toast' },
  ];

  return (
    <TemplateFrame label="Instagram Story — Features" width={1080} height={1920}>
      <div
        style={{
          width: 1080,
          height: 1920,
          background: brand.navy,
          fontFamily: font,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          padding: '100px 72px',
        }}
      >
        <GlowOrb x="60%" y="10%" size={350} color="rgba(59,130,246,0.1)" />
        <GlowOrb x="20%" y="70%" size={300} color="rgba(16,185,129,0.08)" />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <Logo size={40} />
          <div style={{ height: 80 }} />
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: brand.emerald,
              textTransform: 'uppercase',
              letterSpacing: 2,
              marginBottom: 20,
            }}
          >
            Everything Your Store Needs
          </div>
          <h1
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: brand.white,
              lineHeight: 1.15,
              letterSpacing: -1.5,
              marginBottom: 64,
            }}
          >
            AI Agents That
            <br />
            <span style={{ color: brand.blue }}>Work 24/7</span>
          </h1>

          {features.map((f, i) => (
            <div
              key={f.title}
              style={{
                padding: '36px 40px',
                borderRadius: 20,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                marginBottom: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 28,
              }}
            >
              <div style={{ fontSize: 48 }}>{f.icon}</div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: brand.white, marginBottom: 6 }}>
                  {f.title}
                </div>
                <div style={{ fontSize: 18, color: brand.slate }}>{f.desc}</div>
              </div>
            </div>
          ))}

          <div style={{ flex: 1 }} />

          <div
            style={{
              marginTop: 64,
              textAlign: 'center',
              padding: '20px 48px',
              borderRadius: 16,
              background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
              color: brand.white,
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            Try AROS Free &rarr;
          </div>
          <div style={{ textAlign: 'center', fontSize: 16, color: brand.slate, marginTop: 16 }}>
            nirtek.net &middot; No credit card required
          </div>
        </div>
      </div>
    </TemplateFrame>
  );
}

/* 3. Twitter/X Post Card (1200x675) */
function TwitterCard() {
  return (
    <TemplateFrame label="Twitter/X Post Card" width={1200} height={675}>
      <div
        style={{
          width: 1200,
          height: 675,
          background: brand.navy,
          fontFamily: font,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          padding: '0 80px',
        }}
      >
        <GlowOrb x="65%" y="30%" size={300} color="rgba(59,130,246,0.1)" />
        <GlowOrb x="30%" y="60%" size={200} color="rgba(16,185,129,0.06)" />

        <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
          <Logo size={36} />
          <div style={{ height: 32 }} />
          <h1
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: brand.white,
              lineHeight: 1.15,
              letterSpacing: -1.5,
              marginBottom: 16,
              maxWidth: 500,
            }}
          >
            Your store's data is talking.{' '}
            <span style={{ color: brand.emerald }}>AROS is listening.</span>
          </h1>
          <p style={{ fontSize: 20, color: brand.slate, maxWidth: 440, lineHeight: 1.5 }}>
            AI-powered retail OS. Real-time analytics. 14 agents working 24/7.
          </p>
        </div>

        <div style={{ position: 'relative', zIndex: 1, width: 380 }}>
          <div
            style={{
              padding: 28,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <MiniChart height={140} />
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              {[
                { label: 'Revenue', val: '$12.8K', color: brand.emerald },
                { label: 'Orders', val: '284', color: brand.blue },
              ].map((m) => (
                <div
                  key={m.label}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div style={{ fontSize: 11, color: brand.slate }}>{m.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </TemplateFrame>
  );
}

/* 4. LinkedIn Post (1200x627) */
function LinkedInPost() {
  return (
    <TemplateFrame label="LinkedIn Post — Company Update" width={1200} height={627}>
      <div
        style={{
          width: 1200,
          height: 627,
          background: `linear-gradient(135deg, ${brand.navy} 0%, #1E293B 100%)`,
          fontFamily: font,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <GlowOrb x="50%" y="40%" size={400} color="rgba(59,130,246,0.08)" />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <Logo size={40} />
          <div style={{ height: 36 }} />
          <h1
            style={{
              fontSize: 52,
              fontWeight: 800,
              color: brand.white,
              lineHeight: 1.15,
              letterSpacing: -1.5,
              marginBottom: 20,
            }}
          >
            The AI Operating System
            <br />
            for{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #3B82F6, #10B981)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Modern Retail
            </span>
          </h1>
          <p style={{ fontSize: 20, color: brand.slate, maxWidth: 600, margin: '0 auto' }}>
            14 AI agents &middot; Real-time POS analytics &middot; Self-improving models
          </p>

          <div style={{ display: 'flex', gap: 32, justifyContent: 'center', marginTop: 40 }}>
            {[
              { val: '200+', label: 'Stores Trained' },
              { val: '14', label: 'AI Agents' },
              { val: '99.9%', label: 'Uptime' },
            ].map((s) => (
              <div key={s.label}>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #3B82F6, #10B981)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {s.val}
                </div>
                <div style={{ fontSize: 13, color: brand.slate, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: 28,
            fontSize: 14,
            color: brand.slate,
            opacity: 0.6,
          }}
        >
          nirtek.net
        </div>
      </div>
    </TemplateFrame>
  );
}

/* 5. Open Graph / Link Preview (1200x630) */
function OGImage() {
  return (
    <TemplateFrame label="Open Graph / Link Preview" width={1200} height={630}>
      <div
        style={{
          width: 1200,
          height: 630,
          background: brand.navy,
          fontFamily: font,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <GlowOrb x="40%" y="30%" size={350} color="rgba(59,130,246,0.1)" />
        <GlowOrb x="60%" y="60%" size={250} color="rgba(16,185,129,0.07)" />

        {/* subtle grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.03,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <Logo size={52} />
          <div style={{ height: 28 }} />
          <h1
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: brand.white,
              lineHeight: 1.1,
              letterSpacing: -2,
            }}
          >
            Agentic Retail
            <br />
            Operating System
          </h1>
          <p style={{ fontSize: 20, color: brand.slate, marginTop: 16 }}>
            AI agents that run your store. Start free at nirtek.net
          </p>
        </div>
      </div>
    </TemplateFrame>
  );
}

/* 6. Twitter/X Header (1500x500) */
function TwitterHeader() {
  return (
    <TemplateFrame label="Twitter/X Header Banner" width={1500} height={500}>
      <div
        style={{
          width: 1500,
          height: 500,
          background: `linear-gradient(135deg, ${brand.darkNavy} 0%, ${brand.navy} 50%, #1E293B 100%)`,
          fontFamily: font,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <GlowOrb x="30%" y="40%" size={300} color="rgba(59,130,246,0.06)" />
        <GlowOrb x="70%" y="50%" size={250} color="rgba(16,185,129,0.05)" />

        {/* node line across width */}
        <svg
          width="1200"
          height="4"
          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.15 }}
        >
          <line x1="0" y1="2" x2="1200" y2="2" stroke={brand.blue} strokeWidth="1" />
        </svg>
        {[0, 150, 300, 450, 600, 750, 900, 1050, 1200].map((x, i) => (
          <div
            key={x}
            style={{
              position: 'absolute',
              left: `calc(50% - 600px + ${x}px)`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: i === 4 ? 16 : 8,
              height: i === 4 ? 16 : 8,
              borderRadius: '50%',
              background: i % 2 === 0 ? brand.blue : brand.emerald,
              opacity: i === 4 ? 1 : 0.4,
              boxShadow: i === 4 ? `0 0 20px ${brand.blue}` : 'none',
            }}
          />
        ))}

        <div style={{ position: 'relative', zIndex: 1 }}>
          <Logo size={44} />
        </div>
      </div>
    </TemplateFrame>
  );
}

/* ─── page that renders all templates ─── */
export function SocialTemplates() {
  return (
    <div
      style={{
        fontFamily: font,
        padding: '48px 32px',
        background: '#F1F5F9',
        minHeight: '100vh',
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 800, color: brand.navy, marginBottom: 8 }}>
        AROS Social Media Templates
      </h1>
      <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 48, maxWidth: 600 }}>
        Screenshot each template at the labeled dimensions. For best quality, use browser DevTools
        to set the viewport to the exact size, then capture. Or use the Gemini prompts in{' '}
        <code>content/gemini-image-prompts.md</code> to generate AI visuals for each.
      </p>

      <IGPost />
      <IGStory />
      <TwitterCard />
      <TwitterHeader />
      <LinkedInPost />
      <OGImage />
    </div>
  );
}

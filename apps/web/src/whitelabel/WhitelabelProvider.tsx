import { createContext, useContext, type ReactNode } from 'react';

interface WhitelabelConfig {
  brand: { name: string; tagline?: string; domain?: string };
  agent: { name: string; avatar?: string; greeting?: string };
  theme: { colors: Record<string, string>; fonts?: Record<string, string> };
  logo: { primary: string; icon?: string; darkMode?: string };
  layout?: { sidebar?: string; navigation?: string; density?: string; showBreadcrumbs?: boolean };
  features?: { marketplace?: boolean; updates?: boolean; analytics?: boolean; agentChat?: boolean; settings?: boolean };
  [key: string]: unknown;
}

interface WhitelabelContextValue {
  config: WhitelabelConfig;
}

const WhitelabelContext = createContext<WhitelabelContextValue | null>(null);

// Default config loaded at build time — replaced by whitelabel build step
const defaultConfig: WhitelabelConfig = {
  brand: { name: 'AROS', tagline: 'Agentic Retail Operating System' },
  agent: { name: 'AROS', greeting: 'What do you need?' },
  theme: {
    colors: {
      primary: '#0F172A',
      secondary: '#3B82F6',
      accent: '#10B981',
      background: '#FFFFFF',
      surface: '#F8FAFC',
      text: '#0F172A',
    },
  },
  logo: { primary: '/logo.svg' },
  features: { marketplace: true, updates: true, analytics: true, agentChat: true, settings: true },
};

export function WhitelabelProvider({ children, config }: { children: ReactNode; config?: WhitelabelConfig }) {
  const activeConfig = config ?? defaultConfig;

  // Inject CSS custom properties from theme
  const style = Object.entries(activeConfig.theme.colors).reduce(
    (acc, [key, value]) => {
      acc[`--aros-color-${key}`] = value;
      return acc;
    },
    {} as Record<string, string>
  );

  return (
    <WhitelabelContext.Provider value={{ config: activeConfig }}>
      <div style={style as React.CSSProperties}>{children}</div>
    </WhitelabelContext.Provider>
  );
}

export function useWhitelabel(): WhitelabelContextValue {
  const ctx = useContext(WhitelabelContext);
  if (!ctx) throw new Error('useWhitelabel must be used within a WhitelabelProvider');
  return ctx;
}

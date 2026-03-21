import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Read port from ports.json (single source of truth)
function getPort(): number {
  try {
    const portsPath = join(__dirname, '..', '..', '..', 'ports.json');
    const ports = JSON.parse(readFileSync(portsPath, 'utf8'));
    return ports.services?.['aros-platform']?.port ?? 5457;
  } catch {
    return 5457;
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: getPort(),
    host: '0.0.0.0',
  },
  preview: {
    port: getPort(),
    host: '0.0.0.0',
    allowedHosts: ['aros.nirtek.net', 'localhost', '127.0.0.1'],
  },
  build: {
    outDir: 'dist',
  },
});

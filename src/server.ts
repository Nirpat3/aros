/**
 * AROS Platform — Health Server
 *
 * Lightweight HTTP server providing /health and /readyz endpoints.
 * Uses Node built-in http module to avoid adding dependencies.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

const PORT = 5457;
const startedAt = new Date().toISOString();

function handler(req: IncomingMessage, res: ServerResponse): void {
  const url = req.url ?? '/';

  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'aros-platform',
      version: process.env.npm_package_version ?? '0.3.1',
      uptime: process.uptime(),
      startedAt,
    }));
    return;
  }

  if (url === '/readyz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ready: true }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
}

const server = createServer(handler);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[aros-platform] Health server listening on 0.0.0.0:${PORT}`);
});

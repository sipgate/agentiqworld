/**
 * Unified Node.js server
 *
 * Single process running multiple Express apps:
 * - Homepage (port 3000)
 * - Webapp (port 3001, or mounted on homepage)
 * - Admin (port 3002, or mounted on homepage)
 */

const express = require('express');
const path = require('path');
const os = require('os');
const http = require('http');
const fs = require('fs');
const { setupAgent } = require('./agent');

// =============================================================================
// Configuration
// =============================================================================

const HOMEPAGE_PORT = process.env.HOMEPAGE_PORT || 3000;
const WEBAPP_PORT = process.env.WEBAPP_PORT;
const WEBAPP_PATH = process.env.WEBAPP_PATH || '/';
const ADMIN_PORT = process.env.ADMIN_PORT;
const ADMIN_PATH = process.env.ADMIN_PATH || '/admin';
const API_URL = process.env.API_URL || 'http://localhost:8090';

// =============================================================================
// Logging utilities
// =============================================================================

const requestLogs = [];
const errorLogs = [];
const applicationLogs = [];
const MAX_LOGS = 100;
const MAX_APP_LOGS = 500;

const analyticsData = {
  requests: [],
  maxEntries: 1000
};

function addLog(logs, entry, max = MAX_LOGS) {
  logs.unshift({ ...entry, timestamp: new Date().toISOString() });
  if (logs.length > max) logs.pop();
}

function addAnalyticsEntry(entry) {
  analyticsData.requests.unshift({ ...entry, timestamp: Date.now() });
  if (analyticsData.requests.length > analyticsData.maxEntries) {
    analyticsData.requests.pop();
  }
}

// Log streaming clients (SSE)
const logStreamClients = new Set();

function broadcastLog(type, data) {
  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  logStreamClients.forEach(client => {
    client.write(`data: ${message}\n\n`);
  });
}

// Maintenance mode
let maintenanceMode = false;
const webappClients = new Set();

function broadcastToWebapp(type, data) {
  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  webappClients.forEach(client => {
    client.write(`data: ${message}\n\n`);
  });
}

// Capture application logs
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

function captureLog(level, message, source = 'app') {
  const entry = { level, message, source, timestamp: new Date().toISOString() };
  addLog(applicationLogs, entry, MAX_APP_LOGS);
  broadcastLog('log', entry);
}

console.log = (...args) => {
  originalConsole.log(...args);
  captureLog('info', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), 'node');
};

console.error = (...args) => {
  originalConsole.error(...args);
  captureLog('error', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), 'node');
};

console.warn = (...args) => {
  originalConsole.warn(...args);
  captureLog('warn', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), 'node');
};

// =============================================================================
// Admin utilities
// =============================================================================

function corsForHealth(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
}

async function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.slice(7);
  req.adminToken = token;

  try {
    const response = await fetch(`${API_URL}/api/collections/_superusers/auth-refresh`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    if (!response.ok) return res.status(401).json({ error: 'Invalid admin token' });
    next();
  } catch (err) {
    originalConsole.error('Auth verification error:', err.message);
    return res.status(503).json({ error: 'Cannot verify token with PocketBase' });
  }
}

async function requireAdminAuthSSE(req, res, next) {
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: 'Token required' });

  req.adminToken = token;

  try {
    const response = await fetch(`${API_URL}/api/collections/_superusers/auth-refresh`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    if (!response.ok) return res.status(401).json({ error: 'Invalid admin token' });
    next();
  } catch (err) {
    originalConsole.error('Auth verification error:', err.message);
    return res.status(503).json({ error: 'Cannot verify token with PocketBase' });
  }
}

function getSystemMetrics() {
  // Node.js process memory (actual app usage)
  const nodeMemory = process.memoryUsage();

  // Host system memory
  const hostTotal = os.totalmem();
  const hostFree = os.freemem();
  const hostUsed = hostTotal - hostFree;

  // Try to get container memory limit from cgroups
  let containerLimit = null;
  let containerUsage = null;
  try {
    // cgroup v2 (modern Docker)
    const limitPath = '/sys/fs/cgroup/memory.max';
    const usagePath = '/sys/fs/cgroup/memory.current';
    if (fs.existsSync(limitPath)) {
      const limit = fs.readFileSync(limitPath, 'utf8').trim();
      containerLimit = limit === 'max' ? null : parseInt(limit);
      containerUsage = parseInt(fs.readFileSync(usagePath, 'utf8').trim());
    }
  } catch (err) {
    // cgroup v1 fallback
    try {
      const limitPath = '/sys/fs/cgroup/memory/memory.limit_in_bytes';
      const usagePath = '/sys/fs/cgroup/memory/memory.usage_in_bytes';
      if (fs.existsSync(limitPath)) {
        containerLimit = parseInt(fs.readFileSync(limitPath, 'utf8').trim());
        containerUsage = parseInt(fs.readFileSync(usagePath, 'utf8').trim());
        // Check for "unlimited" (very large number)
        if (containerLimit > 9007199254740990) containerLimit = null;
      }
    } catch (err2) {}
  }

  // App memory = container usage if available, otherwise Node.js RSS
  const appMemory = containerUsage || nodeMemory.rss;
  const hostPercent = Math.round((appMemory / hostTotal) * 10000) / 100;

  return {
    cpu: { cores: os.cpus().length },
    memory: {
      app: appMemory,
      hostTotal: hostTotal,
      hostPercent: hostPercent,
      containerLimit: containerLimit,
      node: {
        rss: nodeMemory.rss,
        heapUsed: nodeMemory.heapUsed,
        heapTotal: nodeMemory.heapTotal,
        external: nodeMemory.external
      }
    },
    uptime: process.uptime(),
    containerized: containerLimit !== null
  };
}

function getDiskUsage() {
  try {
    const dataPath = path.join(__dirname, '../api/pb_data');
    if (fs.existsSync(dataPath) && fs.statfsSync) {
      const stats = fs.statfsSync(dataPath);
      return { total: stats.blocks * stats.bsize, free: stats.bfree * stats.bsize, used: (stats.blocks - stats.bfree) * stats.bsize };
    }
  } catch (err) {}
  return null;
}

async function checkServices() {
  const services = [
    { name: 'homepage', port: HOMEPAGE_PORT },
    { name: 'webapp', port: WEBAPP_PORT },
    { name: 'admin', port: ADMIN_PORT },
    { name: 'pocketbase', url: `${API_URL}/api/health` }
  ].filter(s => s.port || s.url);

  return Promise.all(services.map(async (service) => {
    try {
      const url = service.url || `http://localhost:${service.port}/health`;
      const response = await fetch(url, { timeout: 5000 });
      return { name: service.name, status: response.ok ? 'healthy' : 'unhealthy', statusCode: response.status };
    } catch (err) {
      return { name: service.name, status: 'unreachable', error: err.message };
    }
  }));
}

async function getCollections(token) {
  const response = await fetch(`${API_URL}/api/collections`, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Failed to fetch collections: ${response.status}`);

  const data = await response.json();
  const collections = data.items || data || [];

  const collectionsWithCounts = await Promise.all(
    collections.filter(c => !c.name.startsWith('_')).map(async (collection) => {
      try {
        const countResponse = await fetch(`${API_URL}/api/collections/${collection.name}/records?perPage=1`, { headers: { 'Authorization': `Bearer ${token}` } });
        const countData = await countResponse.json();
        return { name: collection.name, type: collection.type, recordCount: countData.totalItems || 0 };
      } catch (err) {
        return { name: collection.name, type: collection.type, recordCount: null, error: err.message };
      }
    })
  );

  let dbSize = null;
  try {
    const dbPath = path.join(__dirname, '../api/pb_data/data.db');
    if (fs.existsSync(dbPath)) dbSize = fs.statSync(dbPath).size;
  } catch (err) {}

  return { collections: collectionsWithCounts, totalCollections: collectionsWithCounts.length, databaseSize: dbSize };
}

function getAnalytics(period = '1h') {
  const now = Date.now();
  const periods = { '5m': 5 * 60 * 1000, '15m': 15 * 60 * 1000, '1h': 60 * 60 * 1000, '24h': 24 * 60 * 60 * 1000 };
  const cutoff = now - (periods[period] || periods['1h']);
  const recentRequests = analyticsData.requests.filter(r => r.timestamp > cutoff);

  if (recentRequests.length === 0) {
    return { period, totalRequests: 0, requestsPerMinute: 0, avgResponseTime: 0, errorRate: 0, statusCodes: {}, timeline: [] };
  }

  const totalRequests = recentRequests.length;
  const periodMinutes = (periods[period] || periods['1h']) / 60000;
  const avgResponseTime = Math.round(recentRequests.reduce((sum, r) => sum + (r.duration || 0), 0) / totalRequests);
  const errorRate = Math.round((recentRequests.filter(r => r.status >= 400).length / totalRequests) * 10000) / 100;

  const statusCodes = {};
  recentRequests.forEach(r => {
    const category = `${Math.floor(r.status / 100)}xx`;
    statusCodes[category] = (statusCodes[category] || 0) + 1;
  });

  const intervalMs = period === '24h' ? 60 * 60 * 1000 : 60 * 1000;
  const intervals = period === '24h' ? 24 : Math.min(60, Math.ceil(periodMinutes));
  const timeline = [];
  for (let i = 0; i < intervals; i++) {
    const intervalEnd = now - (i * intervalMs);
    const intervalStart = intervalEnd - intervalMs;
    timeline.unshift({ time: new Date(intervalStart).toISOString(), count: recentRequests.filter(r => r.timestamp >= intervalStart && r.timestamp < intervalEnd).length });
  }

  return { period, totalRequests, requestsPerMinute: Math.round((totalRequests / periodMinutes) * 100) / 100, avgResponseTime, errorRate, statusCodes, timeline };
}

function getEnvironmentInfo() {
  const safeEnvVars = ['NODE_ENV', 'HOMEPAGE_PORT', 'WEBAPP_PORT', 'WEBAPP_PATH', 'ADMIN_PORT', 'ADMIN_PATH', 'API_URL'];
  const env = {};
  safeEnvVars.forEach(key => { if (process.env[key]) env[key] = process.env[key]; });

  return { nodeVersion: process.version, platform: process.platform, arch: process.arch, pid: process.pid, uptime: process.uptime(), memoryUsage: process.memoryUsage(), env };
}

async function listBackups(token) {
  const response = await fetch(`${API_URL}/api/backups`, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Failed to list backups: ${response.status}`);
  return response.json();
}

async function createBackup(token, name) {
  const response = await fetch(`${API_URL}/api/backups`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name || `backup_${Date.now()}` })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Failed to create backup: ${response.status}`);
  }
  return response.json();
}

async function deleteBackup(token, key) {
  const response = await fetch(`${API_URL}/api/backups/${encodeURIComponent(key)}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Failed to delete backup: ${response.status}`);
  return { success: true };
}

// =============================================================================
// Admin router
// =============================================================================

function createAdminRouter() {
  const router = express.Router();

  // Proxy /pb/* → PocketBase so the browser can reach it regardless of port
  router.all('/pb/*', (req, res) => {
    const targetPath = req.path.replace(/^\/pb/, '');
    const proxyReq = http.request({
      hostname: 'localhost',
      port: 8090,
      path: targetPath + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''),
      method: req.method,
      headers: { ...req.headers, host: 'localhost:8090' }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', () => {
      if (!res.headersSent) res.status(502).json({ error: 'PocketBase unreachable' });
    });
    req.pipe(proxyReq);
  });

  router.get('/config.js', (req, res) => {
    res.type('application/javascript');
    res.send(`window.ADMIN_API_BASE = ${JSON.stringify(req.baseUrl)};`);
  });

  router.get('/health', corsForHealth, (req, res) => {
    res.json({ status: 'ok', service: 'admin', timestamp: new Date().toISOString() });
  });

  router.get('/api/system', requireAdminAuth, (req, res) => {
    res.json({ ...getSystemMetrics(), disk: getDiskUsage() });
  });

  router.get('/api/services', requireAdminAuth, async (req, res) => {
    try { res.json({ services: await checkServices() }); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/api/logs', requireAdminAuth, (req, res) => {
    const type = req.query.type || 'all';
    const limit = parseInt(req.query.limit) || 50;
    if (type === 'errors') res.json({ logs: errorLogs.slice(0, limit) });
    else if (type === 'requests') res.json({ logs: requestLogs.slice(0, limit) });
    else if (type === 'application') res.json({ logs: applicationLogs.slice(0, limit) });
    else res.json({ requests: requestLogs.slice(0, limit), errors: errorLogs.slice(0, limit), application: applicationLogs.slice(0, limit) });
  });

  router.get('/api/logs/stream', requireAdminAuthSSE, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);
    applicationLogs.slice(0, 20).reverse().forEach(log => res.write(`data: ${JSON.stringify({ type: 'log', data: log })}\n\n`));
    logStreamClients.add(res);
    const pingInterval = setInterval(() => res.write(`data: ${JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() })}\n\n`), 30000);
    req.on('close', () => { clearInterval(pingInterval); logStreamClients.delete(res); });
  });

  router.get('/api/collections', requireAdminAuth, async (req, res) => {
    try { res.json(await getCollections(req.adminToken)); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/api/analytics', requireAdminAuth, (req, res) => {
    res.json(getAnalytics(req.query.period || '1h'));
  });

  router.get('/api/environment', requireAdminAuth, async (req, res) => {
    const pbResponse = await fetch(`${API_URL}/api/health`).catch(() => null);
    res.json({ ...getEnvironmentInfo(), pocketbase: { status: pbResponse?.ok ? 'healthy' : 'unreachable', url: API_URL } });
  });

  router.get('/api/backups', requireAdminAuth, async (req, res) => {
    try { res.json(await listBackups(req.adminToken)); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.post('/api/backups', requireAdminAuth, async (req, res) => {
    try { res.json(await createBackup(req.adminToken, req.body?.name)); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.delete('/api/backups/:key', requireAdminAuth, async (req, res) => {
    try { res.json(await deleteBackup(req.adminToken, req.params.key)); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/api/backups/:key/download', requireAdminAuth, (req, res) => {
    res.redirect(`${API_URL}/api/backups/${encodeURIComponent(req.params.key)}`);
  });

  router.get('/api/maintenance', requireAdminAuth, (req, res) => {
    res.json({ maintenance: maintenanceMode, connectedUsers: webappClients.size });
  });

  router.post('/api/maintenance/on', requireAdminAuth, (req, res) => {
    maintenanceMode = true;
    broadcastToWebapp('maintenance', { active: true });
    originalConsole.log('Maintenance mode enabled by admin');
    res.json({ maintenance: maintenanceMode, connectedUsers: webappClients.size });
  });

  router.post('/api/maintenance/off', requireAdminAuth, (req, res) => {
    maintenanceMode = false;
    broadcastToWebapp('maintenance', { active: false });
    originalConsole.log('Maintenance mode disabled by admin');
    res.json({ maintenance: maintenanceMode, connectedUsers: webappClients.size });
  });

  router.use(express.static(path.join(__dirname, '../admin')));
  router.get('*', (req, res) => res.sendFile(path.join(__dirname, '../admin/index.html')));

  return router;
}

// =============================================================================
// Create Express apps
// =============================================================================

function createHomepageApp() {
  const app = express();

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'homepage', timestamp: new Date().toISOString() });
  });

  // Reverse proxy: /pb/* → PocketBase (before body parsing so streaming/SSE works)
  app.all('/pb/*', (req, res) => {
    const targetPath = req.originalUrl.replace(/^\/pb/, '');
    const proxyReq = http.request({
      hostname: 'localhost',
      port: 8090,
      path: targetPath,
      method: req.method,
      headers: { ...req.headers, host: 'localhost:8090' }
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', () => {
      if (!res.headersSent) res.status(502).json({ error: 'PocketBase unreachable' });
    });
    req.pipe(proxyReq);
  });

  // Mount webapp at path if WEBAPP_PORT is empty
  if (!WEBAPP_PORT && WEBAPP_PATH !== '/') {
    originalConsole.log(`Mounting webapp at ${WEBAPP_PATH}`);
    // Cache index.html with <base> tag so relative asset paths resolve correctly
    const webappHtml = fs.readFileSync(path.join(__dirname, '../webapp/index.html'), 'utf8')
      .replace('<head>', `<head>\n    <base href="${WEBAPP_PATH}/">`);
    app.use(WEBAPP_PATH, express.static(path.join(__dirname, '../webapp')));
    const sendWebappHtml = (req, res) => res.type('html').send(webappHtml);
    app.get(WEBAPP_PATH, sendWebappHtml);
    app.get(`${WEBAPP_PATH}/*`, sendWebappHtml);
  }

  // Mount admin at path if ADMIN_PORT is empty
  if (!ADMIN_PORT) {
    originalConsole.log(`Mounting admin at ${ADMIN_PATH}`);
    app.use(express.json());
    app.use(ADMIN_PATH, createAdminRouter());
  }

  // NOTE: homepage static files and catch-all are added by finalizeHomepage()
  // AFTER setupAgent() so that /api/agent/* routes take priority.
  return app;
}

function finalizeHomepage(app) {
  app.use(express.static(path.join(__dirname, '../homepage')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../homepage/index.html'), err => { if (err) res.status(404).send('Page not found'); });
  });
}

function createWebappApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', corsForHealth, (req, res) => {
    res.json({ status: 'ok', service: 'webapp', timestamp: new Date().toISOString() });
  });

  app.get('/api/status', (req, res) => {
    res.json({ maintenance: maintenanceMode });
  });

  app.get('/api/status/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.write(`data: ${JSON.stringify({ type: 'connected', maintenance: maintenanceMode, timestamp: new Date().toISOString() })}\n\n`);
    webappClients.add(res);
    const pingInterval = setInterval(() => res.write(`data: ${JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() })}\n\n`), 30000);
    req.on('close', () => { clearInterval(pingInterval); webappClients.delete(res); });
  });

  // NOTE: static files and catch-all are added AFTER setupAgent()
  // so that /api/agent/* routes take priority over the SPA fallback.
  return app;
}

function finalizeWebapp(app) {
  app.use(express.static(path.join(__dirname, '../webapp')));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../webapp/index.html')));
}

function createAdminApp() {
  const app = express();
  app.use(express.json());

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      addLog(requestLogs, { method: req.method, path: req.path, status: res.statusCode, duration });
      addAnalyticsEntry({ method: req.method, path: req.path, status: res.statusCode, duration, timestamp: Date.now() });
    });
    next();
  });

  app.use('/', createAdminRouter());
  return app;
}

// =============================================================================
// Start servers
// =============================================================================

originalConsole.log('Starting Node.js servers (single process)...');
originalConsole.log(`Configuration:`);
originalConsole.log(`  HOMEPAGE_PORT: ${HOMEPAGE_PORT}`);
originalConsole.log(`  WEBAPP_PORT: ${WEBAPP_PORT || '(mounted on homepage)'}`);
originalConsole.log(`  WEBAPP_PATH: ${WEBAPP_PATH}`);
originalConsole.log(`  ADMIN_PORT: ${ADMIN_PORT || '(mounted on homepage)'}`);
originalConsole.log(`  ADMIN_PATH: ${ADMIN_PATH}`);
originalConsole.log(`  API_URL: ${API_URL}`);
originalConsole.log('');

// Homepage (always starts)
const homepageApp = createHomepageApp();
const homepageServer = http.createServer(homepageApp);

// If webapp is mounted on homepage (no separate port), attach agent to homepage server
if (!WEBAPP_PORT) {
  homepageApp.use(express.json());
  setupAgent(homepageApp, homepageServer);

  homepageApp.get(`${WEBAPP_PATH}/api/status`, (req, res) => {
    res.json({ maintenance: maintenanceMode });
  });

  homepageApp.get(`${WEBAPP_PATH}/api/status/stream`, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.write(`data: ${JSON.stringify({ type: 'connected', maintenance: maintenanceMode, timestamp: new Date().toISOString() })}\n\n`);
    webappClients.add(res);
    const pingInterval = setInterval(() => res.write(`data: ${JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() })}\n\n`), 30000);
    req.on('close', () => { clearInterval(pingInterval); webappClients.delete(res); });
  });
}

// Finalize homepage AFTER agent routes so /api/agent/* takes priority over catch-all
finalizeHomepage(homepageApp);

homepageServer.listen(HOMEPAGE_PORT, () => {
  originalConsole.log(`Homepage server listening on port ${HOMEPAGE_PORT}`);
  if (!WEBAPP_PORT) {
    originalConsole.log(`sipgate flow WebSocket ready at ws://localhost:${HOMEPAGE_PORT}/ws/sipgate/:agentId`);
  }
});

// Webapp (if port configured) - with WebSocket support for sipgate flow
if (WEBAPP_PORT) {
  const webappApp = createWebappApp();
  const webappServer = http.createServer(webappApp);
  setupAgent(webappApp, webappServer);
  finalizeWebapp(webappApp);
  webappServer.listen(WEBAPP_PORT, () => {
    originalConsole.log(`Webapp server listening on port ${WEBAPP_PORT}`);
    originalConsole.log(`sipgate flow WebSocket ready at ws://localhost:${WEBAPP_PORT}/ws/sipgate/:agentId`);
  });
}

// Admin (if port configured)
if (ADMIN_PORT) {
  const adminApp = createAdminApp();
  adminApp.listen(ADMIN_PORT, () => {
    originalConsole.log(`Admin server listening on port ${ADMIN_PORT}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  originalConsole.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  originalConsole.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

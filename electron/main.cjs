const { app, BrowserWindow, shell, dialog, protocol } = require('electron');
const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
let autoUpdater = null;

// Some Windows setups fail during Crashpad registration and the app exits immediately.
// Disable crash reporter early to keep the desktop app opening reliably.
try {
  app.commandLine.appendSwitch('disable-crash-reporter');
  app.commandLine.appendSwitch('disable-features', 'Crashpad');
} catch {
  // ignore
}

// Provide a stable offline origin without relying on a localhost port (more reliable on locked-down PCs).
// Must be registered before app 'ready'.
try {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'zgrp',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
} catch {
  // ignore
}

const EARLY_LOG_PATH = (() => {
  const base = process.env.TEMP || process.env.TMP || process.cwd();
  return path.join(base, 'zgrp-desktop-early.log');
})();
const earlyLog = (...args) => {
  try {
    const line = `[${new Date().toISOString()}] ${args.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(' ')}\n`;
    fs.appendFileSync(EARLY_LOG_PATH, line);
  } catch {
    // ignore
  }
};
earlyLog('boot', { argv: process.argv, versions: process.versions });
app.on('will-finish-launching', () => earlyLog('event', 'will-finish-launching'));
app.on('ready', () => earlyLog('event', 'ready'));
app.on('before-quit', () => earlyLog('event', 'before-quit'));
app.on('will-quit', () => earlyLog('event', 'will-quit'));
app.on('quit', () => earlyLog('event', 'quit'));

const LIVE_URL = process.env.ELECTRON_START_URL || 'https://zgrp-portal-2026.vercel.app';
const LIVE_ORIGIN = (() => {
  try {
    return new URL(LIVE_URL).origin;
  } catch {
    return 'https://zgrp-portal-2026.vercel.app';
  }
})();
const ACCESS_TOKEN = process.env.ELECTRON_ACCESS_TOKEN;
// Default to allowing the bundled offline-capable portal so the desktop app works without internet.
// Set ELECTRON_ALLOW_OFFLINE_FALLBACK=0 to disable offline mode.
const ALLOW_OFFLINE_FALLBACK = process.env.ELECTRON_ALLOW_OFFLINE_FALLBACK !== '0';
const APP_USER_MODEL_ID = 'com.zayagroup.recruitmentportal';
const WINDOW_ICON_PATH = path.join(
  __dirname,
  '..',
  'assets',
  process.platform === 'win32' ? 'app-icon.ico' : 'app-icon.png'
);
const UPDATE_CHECK_INTERVAL_MS = 1000 * 60 * 60 * 4;
const UPDATE_STARTUP_TIMEOUT_MS = 3500;

let mainWindow = null;
let localServer = null;
let liveMetaSignature = '';
let currentMode = 'local'; // 'local' | 'live'
let logStream = null;
let pendingUpdateInstall = false;
let appStartedAt = Date.now();
let earlyWindowFailures = 0;
let portalProtocolReady = false;

const logLine = (level, ...args) => {
  const message = args.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(' ');
  const line = `[${new Date().toISOString()}] [${level}] ${message}\n`;
  try { process.stdout.write(line); } catch { /* ignore */ }
  try { logStream?.write(line); } catch { /* ignore */ }
};

const setupFileLogging = () => {
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    const logfile = path.join(dir, 'main.log');
    logStream = fs.createWriteStream(logfile, { flags: 'a' });
    logLine('info', 'logging to', logfile);
  } catch (err) {
    // ignore
  }

  process.on('uncaughtException', (err) => logLine('error', 'uncaughtException', err?.stack || err?.message || String(err)));
  process.on('unhandledRejection', (err) => logLine('error', 'unhandledRejection', err?.stack || err?.message || String(err)));
};

const markUpdateReady = (version) => {
  pendingUpdateInstall = true;
  logLine('info', 'update ready (downloaded):', version || '');
  // NOTE: Do not call quitAndInstall automatically.
  // It can look like the app "crashes/closes" right after opening.
  // With autoInstallOnAppQuit=true, the update will apply on the next normal app restart.
};

const promptRestartForUpdate = async (version) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!dialog?.showMessageBox) return;
  try {
    const res = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update Ready',
      message: 'An update has been downloaded and is ready to install.',
      detail: version ? `Version ${version} is ready. Restart now to apply it.` : 'Restart now to apply it.',
    });
    if (res?.response !== 0) return;
    const updater = getAutoUpdater();
    if (!updater) return;
    logLine('info', 'user accepted restart for update');
    updater.quitAndInstall(false, true);
  } catch (err) {
    logLine('error', 'promptRestartForUpdate failed:', err?.message || err);
  }
};

const getAutoUpdater = () => {
  if (autoUpdater) return autoUpdater;
  try {
    // Lazy-load to avoid startup exits caused by updater edge-cases on some machines.
    // (e.g. pending installers / permissions issues before the window shows)
    autoUpdater = require('electron-updater')?.autoUpdater || null;
  } catch (err) {
    autoUpdater = null;
    try {
      logLine('error', 'failed to load electron-updater:', err?.message || err);
    } catch {
      // ignore
    }
  }
  return autoUpdater;
};

const safeReloadIgnoringCache = (win) => {
  try {
    win.webContents.reloadIgnoringCache();
  } catch (err) {
    console.error('[main-window] reloadIgnoringCache failed:', err?.message || err);
    try {
      win.webContents.reload();
    } catch {
      // ignore
    }
  }
};

const clearHttpCacheBestEffort = async (win) => {
  try {
    await win.webContents.session.clearCache();
  } catch (err) {
    console.warn('[main-window] clearCache failed:', err?.message || err);
  }
};

const clearStorageBestEffort = async (win) => {
  try {
    await win.webContents.session.clearStorageData({
      storages: ['appcache', 'cachestorage', 'serviceworkers', 'localstorage', 'indexdb'],
    });
  } catch (err) {
    console.warn('[main-window] clearStorageData failed:', err?.message || err);
  }
};

const guessMime = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.ico') return 'image/x-icon';
  if (ext === '.woff') return 'font/woff';
  if (ext === '.woff2') return 'font/woff2';
  if (ext === '.ttf') return 'font/ttf';
  return 'application/octet-stream';
};

const startLocalStaticServer = (distDir) =>
  new Promise((resolve, reject) => {
    if (!fs.existsSync(distDir)) {
      reject(new Error(`dist folder not found at ${distDir}`));
      return;
    }

    const server = http.createServer((req, res) => {
      try {
        const host = req.headers.host || '127.0.0.1';
        const url = new URL(req.url || '/', `http://${host}`);
        let requestPath = decodeURIComponent(url.pathname || '/');
        if (requestPath === '/') requestPath = '/index.html';

        const safePath = path.normalize(requestPath).replace(/^([A-Za-z]:)?[\\/]+/, '');
        const filePath = path.join(distDir, safePath);

        const sendFile = (p) => {
          try {
            const data = fs.readFileSync(p);
            res.statusCode = 200;
            res.setHeader('Content-Type', guessMime(p));
            res.setHeader('Cache-Control', 'no-store');
            res.end(data);
          } catch {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end('Not found');
          }
        };

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          sendFile(filePath);
          return;
        }

        // SPA fallback: serve index.html for unknown routes.
        sendFile(path.join(distDir, 'index.html'));
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(err?.message || 'Server error');
      }
    });

    const basePort = Number.parseInt(process.env.ELECTRON_LOCAL_PORT || '4174', 10) || 4174;
    const portCandidates = Array.from({ length: 11 }, (_, i) => basePort + i);

    const onError = (err) => {
      const code = String(err?.code || '');
      if (code === 'EADDRINUSE' || code === 'EACCES') {
        const nextPort = portCandidates.shift();
        if (typeof nextPort === 'number') {
          try {
            server.listen(nextPort, '127.0.0.1');
            return;
          } catch {
            // continue trying
          }
        }
      }
      reject(err);
    };

    server.on('error', onError);
    server.on('listening', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : basePort;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((done) => {
            try {
              server.close(() => done());
            } catch {
              done();
            }
          }),
      });
    });

    const firstPort = portCandidates.shift();
    server.listen(firstPort, '127.0.0.1');
  });

const PORTAL_CACHE_ROOT = () => path.join(app.getPath('userData'), 'portal-cache');
const PORTAL_CACHE_CURRENT = () => path.join(PORTAL_CACHE_ROOT(), 'current.json');

const readJsonSafe = (p) => {
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
};

const writeJsonSafe = (p, value) => {
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(value, null, 2), 'utf-8');
  } catch {
    // ignore
  }
};

const sha256Short = (value) => crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex').slice(0, 16);

const normalizeAssetPath = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (s.startsWith('data:')) return null;
  if (s.startsWith('http://') || s.startsWith('https://')) {
    try {
      const u = new URL(s);
      if (u.origin !== LIVE_ORIGIN) return null;
      return u.pathname;
    } catch {
      return null;
    }
  }
  if (s.startsWith('/')) return s;
  if (s.startsWith('./')) return `/${s.slice(2)}`;
  return `/${s}`;
};

const extractLiveAssetPaths = (html) => {
  const assets = new Set();
  const re = /(src|href)=["']([^"']+)["']/gi;
  let match = null;
  while ((match = re.exec(String(html || '')))) {
    const p = normalizeAssetPath(match[2]);
    if (!p) continue;
    if (p.startsWith('/assets/')) assets.add(p);
  }
  // Always include the app shell.
  assets.add('/index.html');
  return Array.from(assets.values());
};

const fetchBuffer = (url) =>
  new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request(
        {
          protocol: u.protocol,
          hostname: u.hostname,
          port: u.port || (u.protocol === 'https:' ? 443 : 80),
          path: `${u.pathname}${u.search}`,
          method: 'GET',
          headers: {
            'User-Agent': `ZayaGroupPortal/${app.getVersion()}`,
            'Cache-Control': 'no-cache',
          },
          timeout: 9000,
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}`));
            res.resume();
            return;
          }
          const chunks = [];
          res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        }
      );
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', reject);
      req.end();
    } catch (err) {
      reject(err);
    }
  });

const getCachedPortalDistDir = () => {
  try {
    const current = readJsonSafe(PORTAL_CACHE_CURRENT());
    const sig = String(current?.signature || '').trim();
    if (!sig) return null;
    const dir = path.join(PORTAL_CACHE_ROOT(), 'versions', sig);
    const index = path.join(dir, 'index.html');
    if (!fs.existsSync(index)) return null;
    return dir;
  } catch {
    return null;
  }
};

const registerPortalProtocol = () =>
  new Promise((resolve, reject) => {
    if (!ALLOW_OFFLINE_FALLBACK) {
      portalProtocolReady = false;
      resolve(false);
      return;
    }
    try {
      protocol.registerBufferProtocol(
        'zgrp',
        (request, respond) => {
          try {
            const u = new URL(String(request?.url || 'zgrp://portal/'));
            const host = String(u.hostname || '').toLowerCase();
            if (host !== 'portal' && host !== 'action') {
              respond({ statusCode: 404, data: Buffer.from('Not found'), mimeType: 'text/plain; charset=utf-8' });
              return;
            }

            // Action URLs are handled in BrowserWindow's will-navigate.
            if (host === 'action') {
              respond({ statusCode: 204, data: Buffer.from(''), mimeType: 'text/plain; charset=utf-8' });
              return;
            }

            const bundledDist = path.join(app.getAppPath(), 'dist');
            const cachedDist = getCachedPortalDistDir();
            const distDir = cachedDist || bundledDist;

            let requestPath = decodeURIComponent(u.pathname || '/');
            if (requestPath === '/') requestPath = '/index.html';
            const safePath = path.normalize(requestPath).replace(/^([A-Za-z]:)?[\\/]+/, '');
            let filePath = path.join(distDir, safePath);

            if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
              filePath = path.join(distDir, 'index.html');
            }

            const data = fs.readFileSync(filePath);
            respond({ statusCode: 200, data, mimeType: guessMime(filePath) });
          } catch (err) {
            respond({
              statusCode: 500,
              data: Buffer.from(err?.message || 'protocol error'),
              mimeType: 'text/plain; charset=utf-8',
            });
          }
        },
        (err) => {
          if (err) {
            portalProtocolReady = false;
            reject(err);
            return;
          }
          portalProtocolReady = true;
          resolve(true);
        }
      );
    } catch (err) {
      portalProtocolReady = false;
      reject(err);
    }
  });

const downloadLivePortalToCache = async () => {
  const cacheRoot = PORTAL_CACHE_ROOT();
  const current = readJsonSafe(PORTAL_CACHE_CURRENT());
  const currentSig = String(current?.signature || '').trim();

  // Fetch current live HTML first.
  const liveIndexUrl = `${LIVE_ORIGIN}/index.html`;
  const htmlBuf = await fetchBuffer(liveIndexUrl);
  const html = htmlBuf.toString('utf-8');
  const signature = sha256Short(html);
  if (signature && signature === currentSig) {
    return { updated: false, signature };
  }

  const versionDir = path.join(cacheRoot, 'versions', signature);
  const tmpDir = `${versionDir}.tmp-${Date.now()}`;

  // Best-effort cleanup of temp dir.
  try {
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
  fs.mkdirSync(tmpDir, { recursive: true });

  const paths = extractLiveAssetPaths(html);
  // Download all assets to tmp dir, preserving structure.
  for (const p of paths) {
    const normalized = normalizeAssetPath(p);
    if (!normalized) continue;
    const url = `${LIVE_ORIGIN}${normalized}`;
    const outPath = path.join(tmpDir, normalized.replace(/^\/+/, ''));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const buf = normalized === '/index.html' ? htmlBuf : await fetchBuffer(url);
    fs.writeFileSync(outPath, buf);
  }

  writeJsonSafe(path.join(tmpDir, 'meta.json'), {
    signature,
    updatedAt: new Date().toISOString(),
    origin: LIVE_ORIGIN,
    assets: paths,
  });

  // Move tmp -> version atomically (best effort).
  try {
    fs.mkdirSync(path.dirname(versionDir), { recursive: true });
    if (fs.existsSync(versionDir)) {
      // Keep existing version if present.
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    } else {
      fs.renameSync(tmpDir, versionDir);
    }
  } catch (err) {
    logLine('error', '[portal-cache] finalize failed:', err?.message || err);
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    throw err;
  }

  writeJsonSafe(PORTAL_CACHE_CURRENT(), {
    signature,
    updatedAt: new Date().toISOString(),
    origin: LIVE_ORIGIN,
  });

  return { updated: true, signature };
};

const restartLocalServerIfNeeded = async (desiredDistDir) => {
  if (!ALLOW_OFFLINE_FALLBACK) return null;
  const currentDist = localServer?.distDir || null;
  if (currentDist && desiredDistDir && path.resolve(currentDist) === path.resolve(desiredDistDir)) return localServer;

  try {
    if (localServer?.close) {
      await localServer.close();
    }
  } catch {
    // ignore
  }

  const next = await startLocalStaticServer(desiredDistDir);
  next.distDir = desiredDistDir;
  localServer = next;
  logLine('info', 'local server (re)started at', localServer?.url || '', 'dist', desiredDistDir);
  return next;
};

const buildLiveUrl = ({ accessToken }) => {
  try {
    const liveUrl = new URL(LIVE_URL);
    if (accessToken) liveUrl.searchParams.set('access', accessToken);
    liveUrl.searchParams.set('client', 'desktop');
    liveUrl.searchParams.set('v', app.getVersion());
    liveUrl.searchParams.set('t', String(Date.now()));
    return liveUrl.toString();
  } catch {
    const fallback = accessToken ? `${LIVE_URL}?access=${encodeURIComponent(accessToken)}` : LIVE_URL;
    const joiner = fallback.includes('?') ? '&' : '?';
    return `${fallback}${joiner}client=desktop&v=${encodeURIComponent(app.getVersion())}&t=${Date.now()}`;
  }
};

const buildLocalUrl = ({ baseUrl, accessToken }) => {
  try {
    const localUrl = new URL(baseUrl);
    if (accessToken) localUrl.searchParams.set('access', accessToken);
    localUrl.searchParams.set('client', 'desktop');
    localUrl.searchParams.set('v', app.getVersion());
    localUrl.searchParams.set('t', String(Date.now()));
    return localUrl.toString();
  } catch {
    const fallback = accessToken ? `${baseUrl}?access=${encodeURIComponent(accessToken)}` : baseUrl;
    const joiner = fallback.includes('?') ? '&' : '?';
    return `${fallback}${joiner}client=desktop&v=${encodeURIComponent(app.getVersion())}&t=${Date.now()}`;
  }
};

const buildProtocolUrl = ({ accessToken }) => {
  try {
    const u = new URL('zgrp://portal/');
    if (accessToken) u.searchParams.set('access', accessToken);
    u.searchParams.set('client', 'desktop');
    u.searchParams.set('v', app.getVersion());
    u.searchParams.set('t', String(Date.now()));
    return u.toString();
  } catch {
    const q = accessToken ? `?access=${encodeURIComponent(accessToken)}` : '?';
    return `zgrp://portal/${q}${accessToken ? '&' : ''}client=desktop&v=${encodeURIComponent(app.getVersion())}&t=${Date.now()}`;
  }
};

const resolveBundledToken = () => {
  try {
    const pkgPath = path.join(app.getAppPath(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return pkg?.electronAccessToken || pkg?.build?.extraMetadata?.electronAccessToken || null;
    }
  } catch {
    return null;
  }
  return null;
};

const fetchText = (url) =>
  new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request(
        {
          protocol: u.protocol,
          hostname: u.hostname,
          port: u.port || (u.protocol === 'https:' ? 443 : 80),
          path: `${u.pathname}${u.search}`,
          method: 'GET',
          headers: {
            'User-Agent': `ZayaGroupPortal/${app.getVersion()}`,
            'Cache-Control': 'no-cache',
          },
          timeout: 6500,
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}`));
            res.resume();
            return;
          }
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve(data));
        }
      );
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', reject);
      req.end();
    } catch (err) {
      reject(err);
    }
  });

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    icon: WINDOW_ICON_PATH,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // The renderer sandbox can cause instant window/process exits on some locked-down Windows setups.
      // Reliability matters more for this kiosk-style desktop wrapper.
      sandbox: false,
    },
  });

  // Desktop users expect the Vercel UI to reflect changes immediately. Chromium can keep an HTTP cache
  // even when the app stays on the same URL, so clear cache on each launch and provide a hard reload.
  clearHttpCacheBestEffort(win).catch(() => {});

  win.webContents.on('before-input-event', (event, input) => {
    if (!input) return;
    const key = String(input.key || '').toLowerCase();

    // Emergency reset for stubborn "old users" / offline DB: Ctrl+Shift+R (or Cmd+Shift+R on macOS).
    const wantsReset = key === 'r' && (input.control || input.meta) && input.shift;
    if (wantsReset) {
      event.preventDefault();
      Promise.resolve()
        .then(() => clearHttpCacheBestEffort(win))
        .then(() => clearStorageBestEffort(win))
        .finally(() => safeReloadIgnoringCache(win));
      return;
    }

    const isReload = key === 'f5' || (key === 'r' && (input.control || input.meta));
    if (!isReload) return;
    event.preventDefault();
    safeReloadIgnoringCache(win);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    logLine('error', '[renderer] gone:', details?.reason || '', String(details?.exitCode ?? ''));
  });

  win.webContents.on('child-process-gone', (_event, details) => {
    logLine('error', '[child-process] gone:', details?.type || '', details?.reason || '', String(details?.exitCode ?? ''));
  });

  win.webContents.on('will-navigate', (event, url) => {
    const raw = String(url || '');
    if (raw.startsWith('zgrp://action/')) {
      event.preventDefault();
      handleNavAction(raw).catch(() => {});
      return;
    }

    const isAllowed =
      raw.startsWith(LIVE_ORIGIN) ||
      raw.startsWith('http://127.0.0.1:') ||
      raw.startsWith('http://127.0.0.1:4173') ||
      raw.startsWith('zgrp://portal/');
    if (!isAllowed) {
      event.preventDefault();
      shell.openExternal(raw);
    }
  });

  const token = ACCESS_TOKEN || resolveBundledToken();
  const getLocalUrl = () => buildLocalUrl({ baseUrl: localServer?.url || 'http://127.0.0.1:0', accessToken: token });
  const getProtocolUrl = () => buildProtocolUrl({ accessToken: token });
  const getLiveUrl = () => buildLiveUrl({ accessToken: token });
  const hasDevUrl = Boolean(process.env.ELECTRON_START_URL);
  const localBuild = path.join(app.getAppPath(), 'dist', 'index.html');

  const showOffline = async () => {
    const safeLocal = String(getLocalUrl()).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeProtocol = String(getProtocolUrl()).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeLive = String(getLiveUrl()).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const logsPath = (() => {
      try {
        return path.join(app.getPath('userData'), 'logs', 'main.log');
      } catch {
        return '';
      }
    })();
    const safeLogs = String(logsPath).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html =
      `<!doctype html><html><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>Zaya Group Portal</title>` +
      `<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#0b1431;color:#fff;margin:0;padding:24px}` +
      `.card{max-width:720px;margin:40px auto;background:rgba(255,255,255,0.06);border:1px solid rgba(96,165,250,0.2);border-radius:18px;padding:20px}` +
      `button{background:#D4AF37;color:#003366;border:0;border-radius:12px;padding:12px 14px;font-weight:800;cursor:pointer}` +
      `a{color:#93c5fd;word-break:break-all}</style></head><body>` +
      `<div class="card">` +
      `<h2 style="margin:0 0 10px 0">Unable to Start</h2>` +
      `<p style="margin:0 0 14px 0;opacity:0.9">The desktop portal failed to load. You can retry, reset local cache, or open the live portal in a browser.</p>` +
      `<p style="margin:0 0 14px 0;opacity:0.85">Offline portal: <a href="${safeProtocol}">${safeProtocol}</a></p>` +
      `<p style="margin:0 0 14px 0;opacity:0.9">Local app: <a href="${safeLocal}">${safeLocal}</a></p>` +
      `<p style="margin:0 0 14px 0;opacity:0.9">Live portal: <a href="${safeLive}">${safeLive}</a></p>` +
      (safeLogs ? `<p style="margin:0 0 14px 0;opacity:0.75">Logs: <code>${safeLogs}</code></p>` : '') +
      `<div style="display:flex;gap:10px;flex-wrap:wrap">` +
      `<button onclick="location.href='zgrp://action/retry'">Retry</button>` +
      `<button onclick="location.href='zgrp://action/reset'">Reset & Retry</button>` +
      `<button onclick="location.href='zgrp://action/open-local'">Open Offline Portal</button>` +
      `<button onclick="window.open('${safeLive}')">Open Live In Browser</button>` +
      `</div>` +
      `</div>` +
      `</body></html>`;
    await win.loadURL(`data:text/html,${encodeURIComponent(html)}`);
  };

  // Dev mode uses the live dev server.
  if (hasDevUrl) {
    win.loadURL(buildLiveUrl({ accessToken: token })).catch(async () => showOffline());
    return;
  }

  const loadLocal = async () => {
    // Prefer the custom protocol (stable origin, no ports). If unavailable, fall back to HTTP server then loadFile.
    if (portalProtocolReady) {
      await win.loadURL(getProtocolUrl());
    } else if (localServer?.url) {
      await win.loadURL(getLocalUrl());
    } else if (fs.existsSync(localBuild)) {
      const q = token ? { query: { access: token, client: 'desktop' } } : { query: { client: 'desktop' } };
      await win.loadFile(localBuild, q);
    } else {
      await showOffline();
      return;
    }
    currentMode = 'local';
  };

  const loadLive = async () => {
    await win.loadURL(getLiveUrl());
    currentMode = 'live';
  };

  const loadWithTimeout = async (loader, timeoutMs) => {
    let timer = null;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('load-timeout')), timeoutMs);
      });
      await Promise.race([loader(), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const handleNavAction = async (rawUrl) => {
    const action = String(rawUrl || '').replace('zgrp://action/', '').split(/[?#]/)[0];

    if (action === 'open-live') {
      shell.openExternal(getLiveUrl());
      return;
    }

    if (action === 'open-local') {
      await loadLocal();
      return;
    }

    const reset = action === 'reset';
    if (reset) {
      await clearHttpCacheBestEffort(win);
      await clearStorageBestEffort(win);
      try {
        fs.rmSync(PORTAL_CACHE_ROOT(), { recursive: true, force: true });
      } catch {
        // ignore
      }
      try {
        if (ALLOW_OFFLINE_FALLBACK) {
          const bundledDist = path.join(app.getAppPath(), 'dist');
          localServer = await startLocalStaticServer(bundledDist);
          localServer.distDir = bundledDist;
        }
      } catch (err) {
        logLine('error', '[local-server] reset restart failed:', err?.message || err);
      }
    }

    // Prefer live first so UI updates appear; fall back to local if offline.
    try {
      await loadWithTimeout(loadLive, 8000);
    } catch {
      await loadLocal().catch(() => {});
    }
  };

  // Prefer live (Vercel) so UI updates appear immediately; fall back to local so offline still works.
  // IMPORTANT: Use a stable local origin so IndexedDB/localStorage (offline cache + outbox) are consistent.
  // The app still syncs data via Supabase when online, matching what the live portal shows.
  loadWithTimeout(loadLive, 8000).catch(() => loadLocal().catch(showOffline));

  win.webContents.on('did-fail-load', async (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    if (!validatedURL || validatedURL.startsWith('file://')) return;
    logLine('error', '[main-window] load failed:', errorCode, errorDescription, validatedURL);
    const url = String(validatedURL || '');
    if (ALLOW_OFFLINE_FALLBACK && url.startsWith(LIVE_ORIGIN)) {
      await loadLocal().catch(showOffline);
      return;
    }
    await showOffline();
  });

  // Optional: if you want the UI to hard-reload periodically while online.
  // Defaults off to avoid interrupting offline-first workflows.
  const pollTimer = process.env.ELECTRON_AUTO_RELOAD_LIVE === '1'
    ? setInterval(() => safeReloadIgnoringCache(win), 1000 * 60 * 15)
    : null;
  win.on('closed', () => { if (pollTimer) clearInterval(pollTimer); });

  mainWindow = win;

  win.on('closed', () => {
    mainWindow = null;
    const ageMs = Date.now() - appStartedAt;
    if (ageMs < 15000) {
      earlyWindowFailures += 1;
      logLine('error', '[main-window] closed early (ms):', String(ageMs), 'failures:', String(earlyWindowFailures));
      // Try to keep the app alive even if the first window closes immediately.
      // Avoid infinite loops by limiting retries.
      if (earlyWindowFailures <= 3) {
        setTimeout(() => {
          if (!BrowserWindow.getAllWindows().length) {
            try {
              createMainWindow();
            } catch (err) {
              logLine('error', 'recreate window failed:', err?.message || err);
            }
          }
        }, 600);
      }
    }
  });
}

function setupAutoUpdates() {
  if (!app.isPackaged) return;
  if (process.env.DISABLE_AUTO_UPDATES === '1') return;

  const updater = getAutoUpdater();
  if (!updater) return;

  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = true;

  updater.on('error', (error) => {
    console.error('[auto-updater] error:', error?.message || error);
  });

  updater.on('update-available', (info) => {
    console.log('[auto-updater] update available:', info?.version);
  });

  updater.on('update-not-available', () => {
    console.log('[auto-updater] no update available');
  });

  updater.on('download-progress', (progress) => {
    if (!mainWindow) return;
    if (typeof progress?.percent !== 'number') return;
    mainWindow.setProgressBar(Math.max(0, Math.min(1, progress.percent / 100)));
  });

  updater.on('update-downloaded', async (info) => {
    if (mainWindow) {
      mainWindow.setProgressBar(-1);
    }
    markUpdateReady(info?.version);
    await promptRestartForUpdate(info?.version);
  });

  const check = () => {
    updater.checkForUpdates().catch((error) => {
      console.error('[auto-updater] check failed:', error?.message || error);
    });
  };

  check();
  setInterval(check, UPDATE_CHECK_INTERVAL_MS);
}

app.whenReady().then(async () => {
  app.setName('Zaya Group Portal');
  if (process.platform === 'win32') {
    app.setAppUserModelId(APP_USER_MODEL_ID);
  }

  setupFileLogging();
  logLine('info', 'app version', app.getVersion(), 'packaged', app.isPackaged);
  app.on('before-quit', () => logLine('info', 'before-quit', pendingUpdateInstall ? '(update-ready)' : ''));
  app.on('will-quit', () => logLine('info', 'will-quit', pendingUpdateInstall ? '(update-ready)' : ''));
  app.on('quit', () => logLine('info', 'quit', pendingUpdateInstall ? '(update-ready)' : ''));

  try {
    await registerPortalProtocol();
    if (portalProtocolReady) {
      logLine('info', '[protocol] zgrp://portal registered');
    }
  } catch (err) {
    logLine('error', '[protocol] register failed:', err?.message || err);
  }

  try {
    if (ALLOW_OFFLINE_FALLBACK) {
      const bundledDist = path.join(app.getAppPath(), 'dist');
      const cachedDist = getCachedPortalDistDir();
      const distDir = cachedDist || bundledDist;
      localServer = await startLocalStaticServer(distDir);
      localServer.distDir = distDir;
      logLine('info', 'local server started at', localServer?.url || '', 'dist', distDir);
    } else {
      localServer = null;
    }
  } catch (err) {
    logLine('error', '[local-server] failed to start:', err?.message || err);
    localServer = null;
  }

  createMainWindow();
  // Never block startup on updates. Check only after the UI is visible.
  setTimeout(() => setupAutoUpdates(), 8000);

  // Background: mirror the live portal into a local offline cache (no installers needed for portal UI changes).
  // Once the portal has been opened online at least once, the cached UI is available offline on subsequent launches.
  const schedulePortalCacheUpdate = () => {
    setTimeout(async () => {
      try {
        const res = await downloadLivePortalToCache();
        if (!res?.updated) return;
        const distDir = getCachedPortalDistDir();
        if (!distDir) return;
        await restartLocalServerIfNeeded(distDir);
        if (mainWindow && !mainWindow.isDestroyed()) {
          // Reload into local mode so the offline cache immediately matches the live portal version.
          const token = ACCESS_TOKEN || resolveBundledToken();
          const nextUrl = portalProtocolReady
            ? buildProtocolUrl({ accessToken: token })
            : buildLocalUrl({ baseUrl: localServer?.url || 'http://127.0.0.1:0', accessToken: token });
          mainWindow.loadURL(nextUrl).catch(() => {});
        }
      } catch (err) {
        logLine('error', '[portal-cache] update failed:', err?.message || err);
      }
    }, UPDATE_STARTUP_TIMEOUT_MS);
  };

  schedulePortalCacheUpdate();
  setInterval(schedulePortalCacheUpdate, 1000 * 60 * 30);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  Promise.resolve()
    .then(() => localServer?.close?.())
    .catch(() => {});
  if (process.platform !== 'darwin') app.quit();
});

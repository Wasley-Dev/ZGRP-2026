const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

const LIVE_URL = process.env.ELECTRON_START_URL || 'https://zgrp-portal-2026.vercel.app';
const ACCESS_TOKEN = process.env.ELECTRON_ACCESS_TOKEN;
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
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const isAllowed =
      url.startsWith('https://zgrp-portal-2026.vercel.app') ||
      url.startsWith('http://127.0.0.1:4173');
    if (!isAllowed) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  const localBuild = path.join(app.getAppPath(), 'dist', 'index.html');
  const token = ACCESS_TOKEN || resolveBundledToken();
  const url = buildLiveUrl({ accessToken: token });
  const hasDevUrl = Boolean(process.env.ELECTRON_START_URL);
  const localLoadOptions = token ? { query: { access: token } } : undefined;

  // Dev mode uses the live dev server.
  if (hasDevUrl) {
    win.loadURL(url).catch(async () => {
      if (fs.existsSync(localBuild)) {
        await win.loadFile(localBuild, localLoadOptions);
      } else {
        await win.loadURL('data:text/html,<h2>Unable to load app.</h2>');
      }
    });
    return;
  }

  // Packaged apps load the live Vercel deployment first so all installed machines pick up
  // the latest UI immediately. If the network is down, fall back to the bundled build.
  win.loadURL(url).catch(async () => {
    if (fs.existsSync(localBuild)) {
      await win.loadFile(localBuild, localLoadOptions);
      return;
    }
    await win.loadURL('data:text/html,<h2>Unable to load app.</h2>');
  });

  win.webContents.on('did-fail-load', async (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    if (!validatedURL || validatedURL.startsWith('file://')) return;
    if (fs.existsSync(localBuild)) {
      console.error('[main-window] live content load failed:', errorCode, errorDescription);
      await win.loadFile(localBuild, localLoadOptions);
      return;
    }
    await win.loadURL('data:text/html,<h2>Unable to load app.</h2>');
  });

  mainWindow = win;
}

function setupAutoUpdates() {
  if (!app.isPackaged) return;
  if (process.env.DISABLE_AUTO_UPDATES === '1') return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (error) => {
    console.error('[auto-updater] error:', error?.message || error);
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[auto-updater] update available:', info?.version);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[auto-updater] no update available');
  });

  autoUpdater.on('download-progress', (progress) => {
    if (!mainWindow) return;
    if (typeof progress?.percent !== 'number') return;
    mainWindow.setProgressBar(Math.max(0, Math.min(1, progress.percent / 100)));
  });

  autoUpdater.on('update-downloaded', async (info) => {
    if (mainWindow) {
      mainWindow.setProgressBar(-1);
    }
    const response = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: `Version ${info?.version || 'new'} is ready to install.`,
      detail: 'The app will restart to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  const check = () => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.error('[auto-updater] check failed:', error?.message || error);
    });
  };

  check();
  setInterval(check, UPDATE_CHECK_INTERVAL_MS);
}

const checkAndInstallUpdatesBeforeLaunch = () => {
  if (!app.isPackaged) return Promise.resolve(false);
  if (process.env.DISABLE_AUTO_UPDATES === '1') return Promise.resolve(false);

  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      autoUpdater.removeListener('update-not-available', onNotAvailable);
      autoUpdater.removeListener('update-downloaded', onDownloaded);
      autoUpdater.removeListener('error', onError);
      resolve(value);
    };

    const onNotAvailable = () => done(false);
    const onError = () => done(false);
    const onDownloaded = () => {
      // Install immediately so users always start on the latest release.
      done(true);
      setTimeout(() => autoUpdater.quitAndInstall(true, true), 50);
    };

    autoUpdater.once('update-not-available', onNotAvailable);
    autoUpdater.once('update-downloaded', onDownloaded);
    autoUpdater.once('error', onError);

    autoUpdater.checkForUpdates().catch(() => done(false));
    setTimeout(() => done(false), UPDATE_STARTUP_TIMEOUT_MS);
  });
};

app.whenReady().then(async () => {
  app.setName('Zaya Group Portal');
  if (process.platform === 'win32') {
    app.setAppUserModelId(APP_USER_MODEL_ID);
  }

  // Check for updates before showing the main window (best-effort with timeout).
  // If an update is already cached/downloaded, it will be installed immediately.
  const installedNow = await checkAndInstallUpdatesBeforeLaunch();
  if (installedNow) return;

  createMainWindow();
  setupAutoUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

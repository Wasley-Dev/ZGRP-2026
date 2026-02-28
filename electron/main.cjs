const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

const LIVE_URL = process.env.ELECTRON_START_URL || 'https://zgrp-portal-2026.vercel.app';
const ACCESS_TOKEN = process.env.ELECTRON_ACCESS_TOKEN;
const APP_USER_MODEL_ID = 'com.zayagroup.recruitmentportal';
const WINDOW_ICON_PATH = path.join(__dirname, '..', 'assets', 'app-icon.png');
const UPDATE_CHECK_INTERVAL_MS = 1000 * 60 * 60 * 4;

let mainWindow = null;

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
  const url = token ? `${LIVE_URL}?access=${encodeURIComponent(token)}` : LIVE_URL;
  const hasDevUrl = Boolean(process.env.ELECTRON_START_URL);

  // Dev mode uses URL; packaged app also prefers live URL so older installers receive latest UI/features.
  if (hasDevUrl) {
    win.loadURL(url).catch(async () => {
      if (fs.existsSync(localBuild)) {
        await win.loadFile(localBuild);
      } else {
        await win.loadURL('data:text/html,<h2>Unable to load app.</h2>');
      }
    });
    return;
  }

  win.loadURL(url).catch(async () => {
    if (fs.existsSync(localBuild)) {
      await win.loadFile(localBuild);
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

app.whenReady().then(() => {
  app.setName('ZAYA Recruitment Portal');
  if (process.platform === 'win32') {
    app.setAppUserModelId(APP_USER_MODEL_ID);
  }
  createMainWindow();
  setupAutoUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

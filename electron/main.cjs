const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const LIVE_URL = process.env.ELECTRON_START_URL || 'https://zgrp-portal-2026.vercel.app';
const ACCESS_TOKEN = process.env.ELECTRON_ACCESS_TOKEN;
const APP_USER_MODEL_ID = 'com.zayagroup.recruitmentportal';
const WINDOW_ICON_PATH = path.join(__dirname, '..', 'assets', 'app-icon.png');

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
}

app.whenReady().then(() => {
  app.setName('ZAYA Recruitment Portal');
  if (process.platform === 'win32') {
    app.setAppUserModelId(APP_USER_MODEL_ID);
  }
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

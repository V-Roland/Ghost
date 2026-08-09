import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, dialog, session, shell } from 'electron';

let apiServer;
let applicationUrl;

function desktopConfig() {
  const configPath = path.join(app.getAppPath(), '.desktop-build', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    throw new Error('The desktop build is missing its public Supabase configuration.');
  }
  return config;
}

function applyConfiguration(config) {
  process.env.NODE_ENV = 'production';
  process.env.SUPABASE_URL = config.supabaseUrl;
  process.env.SUPABASE_PUBLISHABLE_KEY = config.supabasePublishableKey;
  process.env.REQUEST_BODY_LIMIT = config.requestBodyLimit || '256kb';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function listen(expressApp) {
  return new Promise((resolve, reject) => {
    const server = expressApp.listen(0, '127.0.0.1');
    server.once('error', reject);
    server.once('listening', () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

function trustedApplicationUrl(targetUrl) {
  try {
    return new URL(targetUrl).origin === applicationUrl;
  } catch {
    return false;
  }
}

function openExternalUrl(targetUrl) {
  try {
    const parsedUrl = new URL(targetUrl);
    if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') {
      shell.openExternal(parsedUrl.toString()).catch(() => undefined);
    }
  } catch {}
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0a0d20',
    webPreferences: {
      contextIsolation: true,
      devTools: !app.isPackaged,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (trustedApplicationUrl(url)) return;
    event.preventDefault();
    openExternalUrl(url);
  });
  window.once('ready-to-show', () => window.show());
  window.loadURL(applicationUrl);
  return window;
}

function configureDownloads() {
  session.defaultSession.on('will-download', (_event, item) => {
    item.pause();
    const options = {
      title: 'Save Ghost export',
      defaultPath: path.join(app.getPath('downloads'), path.basename(item.getFilename()))
    };
    const parentWindow = BrowserWindow.getFocusedWindow();
    const saveDialog = parentWindow
      ? dialog.showSaveDialog(parentWindow, options)
      : dialog.showSaveDialog(options);
    saveDialog
      .then(({ canceled, filePath }) => {
        if (canceled || !filePath) {
          item.cancel();
          return;
        }
        item.setSavePath(filePath);
        item.resume();
      })
      .catch(() => item.cancel());
  });
}

async function startDesktop() {
  applyConfiguration(desktopConfig());
  const frontendPath = path.join(app.getAppPath(), 'apps', 'frontend', 'dist');
  const { createGhostApiApp } = await import('../../api/src/app.js');
  const embeddedApp = createGhostApiApp({
    allowedOrigins: [],
    desktopMode: true,
    frontendPath,
    isProduction: true
  });
  const listener = await listen(embeddedApp);
  apiServer = listener.server;
  applicationUrl = listener.url;
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  configureDownloads();
  createWindow();
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  app.whenReady()
    .then(startDesktop)
    .catch((error) => {
      dialog.showErrorBox('Ghost could not start', error.message);
      app.quit();
    });
}

app.on('activate', () => {
  if (applicationUrl && BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => apiServer?.close());

const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

let mainWindow = null;
let tray = null;
let serverProcess = null;
const PORT = 3456;
const SERVER_URL = `http://127.0.0.1:${PORT}`;

function startServer() {
  const exePath = process.env.ULTRON_EXE || path.join(__dirname, '..', 'dist', 'ultron.exe');
  const nodePath = path.join(__dirname, '..', 'dist', 'index.js');

  const useExe = require('fs').existsSync(exePath);
  if (useExe) {
    serverProcess = spawn(exePath, ['--web', '--port', String(PORT)], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
      env: { ...process.env },
    });
  } else {
    serverProcess = spawn(process.execPath, [nodePath, '--web', '--port', String(PORT)], {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'production' },
    });
  }

  serverProcess.stdout.on('data', (data) => {
    console.log(`[ultron] ${data.toString().trim()}`);
  });
  serverProcess.stderr.on('data', (data) => {
    console.error(`[ultron] ${data.toString().trim()}`);
  });
  serverProcess.on('close', (code) => {
    console.log(`[ultron] Server exited with code ${code}`);
    if (!app.isQuitting) startServer();
  });
}

function waitForServer(retries = 30) {
  return new Promise((resolve, reject) => {
    function check() {
      http.get(`${SERVER_URL}/healthz`, (res) => {
        if (res.statusCode === 200) return resolve();
        if (--retries > 0) setTimeout(check, 500);
        else reject(new Error('Server did not start'));
      }).on('error', () => {
        if (--retries > 0) setTimeout(check, 500);
        else reject(new Error('Server did not start'));
      });
    }
    check();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'ULTRON',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#1a1b1e',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 10 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(SERVER_URL);
  mainWindow.setTitle('ULTRON');

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('page-title-updated', (e) => e.preventDefault());
}

function createTray() {
  const iconSize = 16;
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon.resize({ width: iconSize, height: iconSize }));

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show ULTRON', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        if (serverProcess) { serverProcess.kill(); serverProcess = null; }
        app.quit();
      },
    },
  ]);

  tray.setToolTip('ULTRON');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
}

app.isQuitting = false;

app.whenReady().then(async () => {
  startServer();
  try {
    await waitForServer();
  } catch (e) {
    console.error('Failed to start server:', e.message);
  }
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  // Don't quit on close — minimize to tray
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (serverProcess) { serverProcess.kill(); serverProcess = null; }
});

app.on('activate', () => {
  if (mainWindow) mainWindow.show();
});

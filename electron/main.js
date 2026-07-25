const { app, BrowserWindow, Menu, Tray, nativeImage } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PORT = 3456;
const SERVER_URL = `http://127.0.0.1:${PORT}`;

let mainWindow = null;
let splashWindow = null;
let serverProcess = null;
let tray = null;

function getServerPath() {
  const isDev = !app.isPackaged;

  if (isDev) {
    // Development: use dist/ultron.exe
    const exe = path.join(__dirname, '..', 'dist', 'ultron.exe');
    if (fs.existsSync(exe)) return { exe, cwd: path.join(__dirname, '..') };
    // Fallback: use node with index.js
    const js = path.join(__dirname, '..', 'dist', 'index.js');
    if (fs.existsSync(js)) return { exe: process.execPath, args: [js], cwd: path.join(__dirname, '..') };
    return null;
  }

  // Production: look for ultron.exe next to the app or in resources
  const candidates = [
    path.join(process.resourcesPath, 'ultron.exe'),
    path.join(path.dirname(app.getPath('exe')), 'ultron.exe'),
    path.join(path.dirname(app.getPath('exe')), 'resources', 'ultron.exe'),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return { exe: c, cwd: path.dirname(c) };
  }

  return null;
}

function startServer() {
  const info = getServerPath();
  if (!info) return false;

  const args = info.args || ['--serve', '--port', String(PORT), '--bind', '127.0.0.1'];

  const env = { ...process.env, NODE_ENV: 'production' };

  // Load .env
  const envFile = path.join(info.cwd, '.env');
  if (fs.existsSync(envFile)) {
    const content = fs.readFileSync(envFile, 'utf8');
    for (const line of content.split('\n')) {
      const eq = line.indexOf('=');
      if (eq > 0) {
        const k = line.slice(0, eq).trim();
        const v = line.slice(eq + 1).trim();
        if (k && v && !env[k]) env[k] = v;
      }
    }
  }

  try {
    serverProcess = spawn(info.exe, args, {
      cwd: info.cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    serverProcess.stdout.on('data', (data) => {
      // Silently consume server logs
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[server] ${data.toString().trim()}`);
    });

    serverProcess.on('exit', (code) => {
      serverProcess = null;
    });

    serverProcess.on('error', () => {
      serverProcess = null;
    });

    return true;
  } catch {
    return false;
  }
}

function waitForServer(maxAttempts = 30) {
  return new Promise((resolve) => {
    let attempts = 0;

    function check() {
      attempts++;
      const req = http.get(`${SERVER_URL}/healthz`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve(true);
        else if (attempts < maxAttempts) setTimeout(check, 1000);
        else resolve(false);
      });

      req.on('error', () => {
        if (attempts < maxAttempts) setTimeout(check, 1000);
        else resolve(false);
      });

      req.setTimeout(2000, () => {
        req.destroy();
        if (attempts < maxAttempts) setTimeout(check, 1000);
        else resolve(false);
      });
    }

    check();
  });
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 500, height: 400, center: true,
    resizable: false, frame: false, alwaysOnTop: true,
    backgroundColor: '#1c1917',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html>
    <html><head><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{background:#1c1917;color:#e7e5e4;font-family:'Segoe UI',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:24px;overflow:hidden}
      .logo{font-size:28px;font-weight:700;letter-spacing:6px;color:#d97706;text-transform:uppercase}
      .sub{font-size:11px;color:#78716c;letter-spacing:1.5px;text-transform:uppercase;font-weight:300}
      .loader{display:flex;gap:5px}
      .dot{width:5px;height:5px;border-radius:50%;background:#d97706;animation:pulse 1.2s ease-in-out infinite}
      .dot:nth-child(2){animation-delay:.2s;background:#10b981}
      .dot:nth-child(3){animation-delay:.4s;background:#d97706}
      @keyframes pulse{0%,100%{opacity:.2;transform:scale(.7)}50%{opacity:1;transform:scale(1)}}
      .status{font-size:10px;color:#78716c;font-weight:300}
    </style></head>
    <body>
      <div class="logo"><span>U</span>LTRON</div>
      <div class="sub">Neural Intelligence Platform</div>
      <div class="loader"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
      <div class="status" id="status">Starting...</div>
      <script>let d=0;setInterval(()=>{d=(d+1)%4;document.getElementById('status').textContent='Starting'+'.'.repeat(d)},600)</script>
    </body></html>
  `)}`);
}

function showError(title, msg) {
  if (!splashWindow) return;
  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <!DOCTYPE html><html><body style="background:#1c1917;color:#e7e5e4;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;flex-direction:column;gap:12px;padding:24px;text-align:center">
    <h2 style="color:#ef4444;font-size:16px">${title}</h2>
    <p style="color:#78716c;font-size:11px">${msg}</p>
    </body></html>
  `)}`);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 800, minHeight: 600,
    center: true, show: false, backgroundColor: '#1a1b1e',
    title: 'ULTRON',
    icon: path.join(process.resourcesPath, 'public', 'favicon.ico'),
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  mainWindow.loadURL(SERVER_URL);
  mainWindow.once('ready-to-show', () => {
    if (splashWindow) { splashWindow.close(); splashWindow = null; }
    mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (mainWindow && !app.isQuitting) { e.preventDefault(); mainWindow.hide(); }
  });
}

function createTray() {
  const iconPath = path.join(process.resourcesPath, 'public', 'favicon.ico');
  let icon;
  try { icon = nativeImage.createFromPath(iconPath); if (icon.isEmpty()) icon = nativeImage.createEmpty(); } catch { icon = nativeImage.createEmpty(); }

  tray = new Tray(icon);
  tray.setToolTip('ULTRON');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open ULTRON', click: () => { if (mainWindow) mainWindow.show(); else createMainWindow(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; if (tray) tray.destroy(); if (serverProcess) serverProcess.kill(); app.exit(0); } },
  ]));
  tray.on('click', () => { if (mainWindow) mainWindow.show(); else createMainWindow(); });
}

app.on('ready', async () => {
  createSplashWindow();

  const started = startServer();
  if (!started) { showError('Server binary not found', 'Run bun run compile first, or place ultron.exe next to this app.'); return; }

  const ready = await waitForServer(30);
  if (!ready) { showError('Connection failed', `Server not responding on port ${PORT} after 30s. Check if port ${PORT} is available.`); return; }

  createMainWindow();
  createTray();

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'ULTRON', submenu: [
      { label: 'About', role: 'about' },
      { type: 'separator' },
      { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => { app.isQuitting = true; if (tray) tray.destroy(); if (serverProcess) serverProcess.kill(); app.exit(0); } },
    ]},
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'forceReload' }, { type: 'separator' }, { role: 'toggleDevTools' }] },
  ]));
});

app.on('window-all-closed', () => {});
app.on('before-quit', (e) => {
  if (!app.isQuitting) {
    app.isQuitting = true;
    e.preventDefault();
    if (tray) { tray.destroy(); tray = null; }
    if (serverProcess) { serverProcess.kill(); serverProcess = null; }
    setTimeout(() => app.exit(0), 1000);
  }
});
app.on('activate', () => { if (mainWindow) mainWindow.show(); else createMainWindow(); });

// Thin wrapper: opens the live game, so every update you push to GitHub reaches players automatically.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const URL_GAME = 'https://jayzuri1.github.io/emberfall-rpg/';

function offlinePage() {
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(
    '<body style="margin:0;height:100vh;display:grid;place-items:center;background:#050608;color:#eee8dc;font-family:system-ui;text-align:center">' +
    '<div><h1 style="color:#f2c35b;letter-spacing:4px">EMBERFALL</h1><p>Can\'t reach the server. Check your internet connection.</p>' +
    '<button onclick="location.href=\'' + URL_GAME + '\'" style="padding:12px 22px;font-size:16px;background:#6e4c20;color:#ffe4a0;border:1px solid #f2c35b;border-radius:6px;cursor:pointer">Retry</button></div></body>');
}

function createWindow() {
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 640, minHeight: 400, backgroundColor: '#050608', autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.ico'), webPreferences: { contextIsolation: true, sandbox: true }
  });
  win.loadURL(URL_GAME);
  win.webContents.on('did-fail-load', (_e, code, _d, url, isMain) => { if (isMain && code !== -3 && url.startsWith('http')) win.loadURL(offlinePage()); });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('before-input-event', (e, i) => { if (i.type === 'keyDown' && i.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); } });
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

const { app, BrowserWindow, ipcMain, net } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const sqlite3 = require('sqlite3').verbose();
const { liveAppUrl: configuredLiveAppUrl } = require('./config.cjs');

const liveAppUrl = process.env.LIVE_APP_URL || configuredLiveAppUrl;
let mainWindow;
let database;
let terminalConfig;
let showingTerminalLock = false;
const configPath = path.join(app.getPath('userData'), 'terminal-config.json');

function getHardwareId() {
  const macAddresses = Object.values(os.networkInterfaces())
    .flatMap((interfaces) => interfaces || [])
    .filter((network) => !network.internal && network.mac && network.mac !== '00:00:00:00:00:00')
    .map((network) => network.mac.toLowerCase())
    .filter((mac, index, values) => values.indexOf(mac) === index)
    .sort();
  const identity = macAddresses.length ? macAddresses.join('|') : os.hostname();
  return crypto.createHash('sha256').update(identity).digest('hex');
}

function createDatabase() {
  database = new sqlite3.Database(path.join(app.getPath('userData'), 'spaza-pos.db'));
  database.serialize(() => {
    database.run(`
      CREATE TABLE IF NOT EXISTS offline_sales (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        synced_at TEXT
      )
    `);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'All In One POS',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (!liveAppUrl || !liveAppUrl.startsWith('https://')) {
    mainWindow.loadURL('data:text/html,<h1>LIVE_APP_URL is not configured</h1><p>Set LIVE_APP_URL before starting Electron.</p>');
    return;
  }
  try {
    terminalConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (terminalConfig.hardwareId !== getHardwareId()) {
      terminalConfig = undefined;
      mainWindow.loadFile(path.join(__dirname, 'activate.html'));
      return;
    }
    void refreshTerminalStatus().then(() => loadLiveApp());
  } catch {
    mainWindow.loadFile(path.join(__dirname, 'activate.html'));
  }
}

function saveTerminalConfig() {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(terminalConfig), { encoding: 'utf8', mode: 0o600 });
}

function getLocalTerminalStatus() {
  const leaseExpiresAt = Number(terminalConfig?.leaseExpiresAt || 0);
  const locked = !terminalConfig?.terminalToken || !leaseExpiresAt || terminalConfig?.lockState === 'locked' || Date.now() >= leaseExpiresAt;
  return {
    online: net.isOnline(),
    lockState: locked ? 'locked' : 'unlocked',
    leaseExpiresAt: leaseExpiresAt || null,
    shopId: terminalConfig?.shopId,
    shopName: terminalConfig?.shopName,
  };
}

async function refreshTerminalStatus() {
  if (!terminalConfig?.shopId || !terminalConfig?.hardwareId || !terminalConfig?.terminalToken || !net.isOnline()) {
    return getLocalTerminalStatus();
  }
  try {
    const response = await fetch(`${liveAppUrl}/api/terminal-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: terminalConfig.shopId,
        hardwareId: terminalConfig.hardwareId,
        terminalToken: terminalConfig.terminalToken,
      }),
    });
    const result = await response.json();
    if (response.ok && result.success) {
      terminalConfig = { ...terminalConfig, ...result.status };
      saveTerminalConfig();
      return getLocalTerminalStatus();
    }
    const errorText = String(result.error || '').toLowerCase();
    terminalConfig = { ...terminalConfig, lockState: 'locked', lockReason: errorText.includes('monthly') || errorText.includes('payment') ? 'billing' : 'lease' };
    saveTerminalConfig();
  } catch {
    // Offline operation uses the last server-issued lease.
  }
  return getLocalTerminalStatus();
}

function showTerminalLock(status) {
  showingTerminalLock = true;
  const connection = status.online ? 'Online - Locked' : 'Offline - Locked';
  const message = status.lockReason === 'billing' ? 'The monthly payment is due. Please contact the administrator to pay the monthly fee.' : "This terminal's four-day offline lease has expired or the shop is locked.";
  mainWindow.loadURL(`data:text/html,${encodeURIComponent(`<h1>${connection}</h1><p>${message}</p><p>Reconnect this computer to the internet after payment so the terminal can unlock.</p>`)}`);
}

function loadLiveApp() {
  const status = getLocalTerminalStatus();
  if (status.lockState === 'locked') {
    showTerminalLock(status);
    return;
  }
  showingTerminalLock = false;
  mainWindow.loadURL(liveAppUrl).catch(() => loadOfflineNotice());
}

function loadOfflineNotice() {
  mainWindow.loadURL(`data:text/html,${encodeURIComponent('<h1>Network unavailable</h1><p>Reconnect this computer to use the online POS.</p>')}`);
}

function syncOfflineSales(config = {}) {
  if (!database || !liveAppUrl || !net.isOnline()) return Promise.resolve({ synced: 0 });
  return new Promise((resolve, reject) => {
    database.all('SELECT * FROM offline_sales WHERE synced_at IS NULL ORDER BY created_at', async (error, rows) => {
      if (error) return reject(error);
      let synced = 0;
      for (const row of rows) {
        try {
          const payload = JSON.parse(row.payload);
          if (config.idToken) payload.idToken = config.idToken;
          const response = await fetch(`${liveAppUrl}/api/sync-offline-sale`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!response.ok) break;
          await new Promise((markResolved, markRejected) => database.run(
            'UPDATE offline_sales SET synced_at = ? WHERE id = ?',
            [new Date().toISOString(), row.id],
            (markError) => markError ? markRejected(markError) : markResolved()
          ));
          synced += 1;
        } catch {
          break;
        }
      }
      resolve({ synced });
    });
  });
}

ipcMain.handle('save-offline-sale', (_event, sale) => new Promise((resolve, reject) => {
  const id = sale.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  database.run(
    'INSERT INTO offline_sales (id, payload, created_at) VALUES (?, ?, ?)',
    [id, JSON.stringify({ ...sale, id }), new Date().toISOString()],
    (error) => error ? reject(error) : resolve({ success: true, id })
  );
}));

ipcMain.handle('get-offline-sale-count', () => new Promise((resolve, reject) => {
  database.get('SELECT COUNT(*) AS count FROM offline_sales WHERE synced_at IS NULL', (error, row) => {
    if (error) reject(error);
    else resolve(row.count);
  });
}));

ipcMain.handle('get-terminal-status', async () => refreshTerminalStatus());

ipcMain.handle('redeem-activation-token', async (_event, token) => {
  if (typeof token !== 'string' || !token.trim()) return { success: false, message: 'Enter an activation token.' };
  const hardwareId = getHardwareId();
  try {
    const response = await fetch(`${liveAppUrl}/api/activate-terminal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.trim(), hardwareId }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) return { success: false, message: result.message || 'Activation failed.' };
    terminalConfig = {
      shopId: result.shopId,
      shopName: result.shopName,
      hardwareId,
      terminalToken: result.terminalToken,
      leaseExpiresAt: Date.now() + 4 * 24 * 60 * 60 * 1000,
      lockState: 'unlocked',
    };
    saveTerminalConfig();
    loadLiveApp();
    return { success: true, shopName: result.shopName };
  } catch {
    return { success: false, message: 'Activation requires an internet connection.' };
  }
});

ipcMain.handle('sync-offline-sales', (_event, config) => new Promise((resolve, reject) => {
  syncOfflineSales(config || {}).then(resolve, reject);
}));

app.whenReady().then(() => {
  createDatabase();
  createWindow();
  setInterval(async () => {
    const status = await refreshTerminalStatus();
    if (status.lockState === 'locked') {
      if (!showingTerminalLock) showTerminalLock(status);
    } else if (showingTerminalLock) {
      loadLiveApp();
    } else {
      syncOfflineSales().catch(() => {});
    }
  }, 30000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (database) database.close();
  if (process.platform !== 'darwin') app.quit();
});
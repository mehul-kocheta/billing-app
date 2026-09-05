import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Construct paths inside user data dir
const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'billing_config.json');
const historyPath = path.join(userDataPath, 'billing_history.json');
const dbPath = path.join(userDataPath, 'billing.db');

let db;

async function initDatabase() {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  
  // Create table if not exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      timestamp INTEGER,
      invoice_no TEXT,
      client_name TEXT,
      client_address TEXT,
      invoice_date TEXT,
      total_amount REAL,
      search_text TEXT,
      full_data TEXT
    )
  `);

  // Migration from JSON to SQLite
  if (fs.existsSync(historyPath)) {
    try {
      const data = fs.readFileSync(historyPath, 'utf-8');
      const oldHistory = JSON.parse(data);
      if (Array.isArray(oldHistory) && oldHistory.length > 0) {
        for (const inv of oldHistory) {
          const d = inv.invoiceData || {};
          const search = [d.billToName, d.billToAddress, d.invoiceDate, d.invoiceNo, d.documentType === 'credit-note' ? 'credit note' : '', d.referenceInvoiceNo].filter(Boolean).join(' ').toLowerCase();
          await db.run(`
            INSERT OR IGNORE INTO invoices (id, timestamp, invoice_no, client_name, client_address, invoice_date, total_amount, search_text, full_data) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            inv.id,
            inv.timestamp || Date.now(),
            d.invoiceNo || '',
            d.billToName || '',
            d.billToAddress || '',
            d.invoiceDate || '',
            inv.totalAmount || 0,
            search,
            JSON.stringify(inv)
          ]);
        }
      }
      fs.renameSync(historyPath, historyPath + '.bak');
      console.log('Successfully migrated history to SQLite');
    } catch (err) {
      console.error('Migration failed:', err);
    }
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Check if we are running in dev or prod
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  await initDatabase();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers for JSON Config
ipcMain.handle('read-config', async () => {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('Failed to read config:', error);
    return null;
  }
});

ipcMain.handle('write-config', async (event, data) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('Failed to write config:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('print-to-pdf', async (event) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return { success: false, error: 'No focused window' };

    try {
        win.webContents.print({ printBackground: true });
        return { success: true };
    } catch(err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('get-history-page', async (event, { query, page, limit }) => {
  try {
    let invoices = [];
    let totalCount = 0;
    const offset = (page - 1) * limit;

    if (query) {
      const search = `%${query.toLowerCase()}%`;
      const countRes = await db.get(`SELECT COUNT(*) as count FROM invoices WHERE search_text LIKE ?`, search);
      totalCount = countRes.count;
      invoices = await db.all(`SELECT full_data FROM invoices WHERE search_text LIKE ? ORDER BY timestamp DESC LIMIT ? OFFSET ?`, search, limit, offset);
    } else {
      const countRes = await db.get(`SELECT COUNT(*) as count FROM invoices`);
      totalCount = countRes.count;
      invoices = await db.all(`SELECT full_data FROM invoices ORDER BY timestamp DESC LIMIT ? OFFSET ?`, limit, offset);
    }

    return {
      success: true,
      data: invoices.map(row => JSON.parse(row.full_data)),
      totalCount
    };
  } catch (err) {
    console.error('Failed to get history page:', err);
    return { success: false, data: [], totalCount: 0, error: err.message };
  }
});

ipcMain.handle('save-invoice', async (event, inv) => {
  try {
    const d = inv.invoiceData || {};
    const search = [d.billToName, d.billToAddress, d.invoiceDate, d.invoiceNo, d.documentType === 'credit-note' ? 'credit note' : '', d.referenceInvoiceNo].filter(Boolean).join(' ').toLowerCase();
    
    let targetId = inv.id;
    if (d.invoiceNo && d.invoiceNo.trim()) {
      const existingByNo = await db.get('SELECT id FROM invoices WHERE invoice_no = ?', d.invoiceNo.trim());
      if (existingByNo && existingByNo.id) {
        targetId = existingByNo.id;
        inv.id = targetId;
      }
    }

    await db.run(`
      INSERT OR REPLACE INTO invoices (id, timestamp, invoice_no, client_name, client_address, invoice_date, total_amount, search_text, full_data) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      targetId,
      inv.timestamp || Date.now(),
      d.invoiceNo || '',
      d.billToName || '',
      d.billToAddress || '',
      d.invoiceDate || '',
      inv.totalAmount || 0,
      search,
      JSON.stringify(inv)
    ]);
    return { success: true, id: targetId };
  } catch (err) {
    console.error('Failed to save invoice:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('delete-invoice', async (event, id) => {
  try {
    await db.run('DELETE FROM invoices WHERE id = ?', id);
    return { success: true };
  } catch (err) {
    console.error('Failed to delete invoice:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-all-history', async () => {
  try {
    const rows = await db.all('SELECT full_data FROM invoices ORDER BY timestamp DESC');
    return rows.map(r => JSON.parse(r.full_data));
  } catch (err) {
    console.error('Failed to get all history:', err);
    return [];
  }
});

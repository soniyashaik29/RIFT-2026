/**
 * main.js – Electron main process
 *
 * Responsibilities:
 *   1. Spawn the Python FastAPI backend (uvicorn) as a child process
 *   2. Create the main BrowserWindow (1200×800)
 *   3. Set global __ELECTRON__ = true so React uses localhost:8000 directly
 *   4. Clean up child process on quit
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow = null;
let backendProc = null;

// ── Backend spawning ──────────────────────────────────────────────────────
function startBackend() {
    const backendDir = isDev
        ? path.join(__dirname, '..', 'backend')
        : path.join(process.resourcesPath, 'backend');

    const isWin = process.platform === 'win32';
    const uvicornPath = isDev
        ? path.join(backendDir, '.venv', isWin ? 'Scripts' : 'bin', isWin ? 'uvicorn.exe' : 'uvicorn')
        : path.join(process.resourcesPath, 'backend', '.venv', isWin ? 'Scripts' : 'bin', isWin ? 'uvicorn.exe' : 'uvicorn');

    console.log('[Electron] Checking if backend is running on :8000...');

    // Check if backend is already running
    const http = require('http');
    const req = http.get('http://127.0.0.1:8000/health', (res) => {
        console.log(`[Electron] Backend is already running (status: ${res.statusCode}). Skipping spawn.`);
    });

    req.on('error', (e) => {
        console.log('[Electron] Backend not found on :8000. Spawning new process...');
        console.log('[Electron] Uvicorn path:', uvicornPath);

        // Spawn new backend process
        try {
            backendProc = spawn(uvicornPath, ['main:app', '--host', '127.0.0.1', '--port', '8000'], {
                cwd: backendDir,
                stdio: 'pipe',
                windowsHide: true,
            });

            backendProc.stdout.on('data', d => console.log('[backend]', d.toString().trim()));
            backendProc.stderr.on('data', d => console.error('[backend]', d.toString().trim()));
            backendProc.on('error', err => console.error('[Electron] Backend spawn error:', err));
            backendProc.on('exit', code => console.log('[Electron] Backend exited with code:', code));
        } catch (err) {
            console.error('[Electron] Failed to spawn backend:', err);
        }
    });

    req.end();
}

function stopBackend() {
    if (backendProc) {
        try {
            // Kill the entire process tree on Windows
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', String(backendProc.pid), '/f', '/t']);
            } else {
                backendProc.kill('SIGTERM');
            }
        } catch (e) {
            console.error('Failed to kill backend:', e);
        }
        backendProc = null;
    }
}

// ── Window creation ───────────────────────────────────────────────────────
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'RIFT 2026 – CI/CD Healing Agent',
        icon: path.join(__dirname, 'assets', 'icon.png'),
        backgroundColor: '#0d0f1a',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: true,
        },
    });

    // Inject the ELECTRON flag into the renderer
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.executeJavaScript('window.__ELECTRON__ = true;');
    });

    // Load the built React app
    const indexPath = isDev
        ? 'http://localhost:3000'           // CRA dev server
        : path.join(__dirname, '..', 'frontend-react', 'build', 'index.html');

    if (isDev) {
        mainWindow.loadURL(indexPath);
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(indexPath);
    }

    // Open external links in the default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => { mainWindow = null; });
}

// ── App lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(() => {
    startBackend();

    // Give the backend ~2 s to start before loading UI
    setTimeout(createWindow, 2000);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        stopBackend();
        app.quit();
    }
});

app.on('before-quit', stopBackend);

// ── IPC handlers (called from renderer via preload) ───────────────────────
ipcMain.handle('get-backend-url', () => 'http://127.0.0.1:8000');

const { app, BrowserWindow } = require('electron');
const path = require('path');

const path = require('path');
const { spawn } = require('child_process');

function startServer() {
  // Launch the Python backend
  const serverPath = path.join(__dirname, '..', 'server.py');
  const server = spawn('python3', [serverPath], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
  server.on('exit', (code) => console.log(`Server exited with code ${code}`));
  return server;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.removeMenu();
  return win;
}

let serverProcess;
app.whenReady().then(() => {
  serverProcess = startServer();
  createWindow();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
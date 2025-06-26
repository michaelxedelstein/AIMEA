const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');

function startServer() {
  // Launch the Python backend
  let server;
  const projectRoot = path.resolve(__dirname, '..');
  if (app.isPackaged) {
    // Packaged mode: launch the embedded server executable
    const execName = process.platform === 'win32' ? 'server.exe' : 'server';
    const serverExec = path.join(process.resourcesPath, 'server', execName);
    if (fs.existsSync(serverExec)) {
      server = spawn(serverExec, [], { stdio: 'inherit' });
    } else {
      console.error(`Packaged server binary not found at ${serverExec}`);
      throw new Error('Server binary missing in packaged app');
    }
  } else {
    // Dev mode: spawn Python script from project root
    const serverPath = path.join(projectRoot, 'server.py');
    let pythonExec = 'python3';
    // Prefer the Python in the venv
    const venvDir = path.join(projectRoot, '.venv');
    const venvPy = process.platform === 'win32'
      ? path.join(venvDir, 'Scripts', 'python.exe')
      : path.join(venvDir, 'bin', 'python3');
    if (fs.existsSync(venvPy)) pythonExec = venvPy;
    server = spawn(pythonExec, [serverPath], { cwd: projectRoot, stdio: 'inherit' });
  }
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
/**
 * Check if a TCP port is in use
 */
function isPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.connect(port, host);
  });
}

app.whenReady().then(async () => {
  // Only start backend server if port 8000 is not already in use
  const busy = await isPortInUse(8000);
  if (!busy) {
    serverProcess = startServer();
  } else {
    console.log('Detected existing server on port 8000; skipping spawn.');
  }
  createWindow();
  // Ensure virtual audio driver is installed
  // Determine installer path: packaged vs dev
  const pkgName = process.platform === 'darwin' ? 'BlackHole2ch.pkg' : 'VB-Cable_Setup.exe';
  let pkgPath;
  if (app.isPackaged) {
    pkgPath = path.join(process.resourcesPath, 'resources', pkgName);
  } else {
    pkgPath = path.join(__dirname, 'resources', pkgName);
  }
  // Simple detection: attempt to list audio devices via pyaudio in backend
  // If the driver is absent, prompt user to install
  // For simplicity, always prompt on first run
  dialog.showMessageBox({
    type: 'info',
    buttons: ['Install Driver', 'Skip'],
    defaultId: 0,
    message: 'AIMEA requires a virtual audio driver to capture system audio.',
    detail: `Click Install Driver to run the installer: ${pkgName}`
  }).then(({ response }) => {
    if (response === 0) {
      // Launch installer
      if (fs.existsSync(pkgPath)) {
        const installerCmd = process.platform === 'darwin' ? 'open' : pkgPath;
        const installerArgs = process.platform === 'darwin' ? [pkgPath] : [];
        spawn(installerCmd, installerArgs, { detached: true });
      } else {
        dialog.showErrorBox('Installer not found', `Could not locate ${pkgName} in resources.`);
      }
    }
  });
});


// When all windows are closed, quit the app and kill the server
app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Ensure the Python server process is terminated when the app quits
// Ensure server is terminated on quit or unexpected exit
app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

// Handle SIGINT (e.g., Ctrl+C) and other termination signals
process.on('SIGINT', () => {
  if (serverProcess) serverProcess.kill();
  process.exit();
});
process.on('SIGTERM', () => {
  if (serverProcess) serverProcess.kill();
  process.exit();
});
process.on('exit', () => {
  if (serverProcess) serverProcess.kill();
});
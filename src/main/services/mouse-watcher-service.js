const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');

/**
 * MouseWatcherService
 * Listens for global OS-level mouse left-clicks using the lightweight native helper.
 * Zero CPU usage when idle; notifies Pointy when user clicks the requested target.
 */
class MouseWatcherService extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.exePath = path.join(__dirname, '../native/mouse-watcher.exe');
    this.csPath = path.join(__dirname, '../native/mouse-watcher.cs');
    this.isActive = false;
  }

  ensureCompiled() {
    if (fs.existsSync(this.exePath)) return true;
    const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
    if (!fs.existsSync(cscPath)) {
      console.warn('[MouseWatcher] csc.exe not found at standard path.');
      return false;
    }
    try {
      console.log('[MouseWatcher] Compiling native mouse watcher helper...');
      execSync(`"${cscPath}" /r:System.Windows.Forms.dll /out:"${this.exePath}" "${this.csPath}"`, {
        stdio: 'ignore'
      });
      return fs.existsSync(this.exePath);
    } catch (err) {
      console.error('[MouseWatcher] Compilation failed:', err.message);
      return false;
    }
  }

  start() {
    if (this.process || this.isActive) return;
    if (!this.ensureCompiled()) {
      console.warn('[MouseWatcher] Cannot start: binary missing.');
      return;
    }

    try {
      this.process = spawn(this.exePath, [], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.isActive = true;

      this.process.stdout.on('data', (buf) => {
        const text = buf.toString();
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed === 'READY') {
            console.log('[MouseWatcher] Native click listener READY');
          } else if (trimmed.startsWith('CLICK')) {
            const parts = trimmed.split(' ');
            const x = parseInt(parts[1], 10) || 0;
            const y = parseInt(parts[2], 10) || 0;
            this.emit('click', { x, y });
          }
        }
      });

      this.process.on('close', () => {
        this.process = null;
        this.isActive = false;
      });

      this.process.on('error', (err) => {
        console.warn('[MouseWatcher] Process error:', err.message);
        this.process = null;
        this.isActive = false;
      });

    } catch (err) {
      console.error('[MouseWatcher] Failed to start:', err.message);
    }
  }

  stop() {
    this.isActive = false;
    if (this.process) {
      try {
        this.process.kill();
      } catch {}
      this.process = null;
    }
  }
}

module.exports = { MouseWatcherService };

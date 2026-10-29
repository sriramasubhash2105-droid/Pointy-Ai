const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test matching "open brave", "open comet", "open youtube in brave", "open comet browser"
console.log('Testing Universal Matcher for Comet, Brave, etc...');

class UniversalMatcherTest {
  constructor() {
    this.apps = new Map();
    this.init();
  }

  init() {
    // 1. Builtin fallbacks & common aliases
    const common = {
      'notepad': { name: 'Notepad', target: 'notepad.exe', type: 'launch_app' },
      'calculator': { name: 'Calculator', target: 'calc.exe', type: 'launch_app' },
      'paint': { name: 'Paint', target: 'mspaint.exe', type: 'launch_app' },
      'terminal': { name: 'Windows Terminal', target: 'wt.exe', fallback: 'powershell.exe', type: 'launch_app' },
      'cmd': { name: 'Command Prompt', target: 'cmd.exe', type: 'launch_app' },
      'chrome': { name: 'Google Chrome', target: 'chrome.exe', exePath: 'chrome.exe', type: 'launch_app' },
      'brave': {
        name: 'Brave',
        appId: 'Brave.FH2PZEZMTZJQAQJMHT3SSFWNEU',
        exePath: path.join(process.env.LOCALAPPDATA, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
        type: 'windows_app_id'
      },
      'comet': {
        name: 'Comet',
        appId: 'Comet.FH2PZEZMTZJQAQJMHT3SSFWNEU',
        exePath: path.join(process.env.LOCALAPPDATA, 'Perplexity', 'Comet', 'Application', 'comet.exe'),
        type: 'windows_app_id'
      },
      'antigravity ide': {
        name: 'Antigravity IDE',
        appId: 'Google.AntigravityIDE',
        exePath: path.join(process.env.LOCALAPPDATA, 'Programs', 'Antigravity IDE', 'Antigravity IDE.exe'),
        type: 'launch_app',
        target: path.join(process.env.LOCALAPPDATA, 'Programs', 'Antigravity IDE', 'Antigravity IDE.exe')
      },
      'antigravity': {
        name: 'Antigravity',
        appId: 'Google.Antigravity',
        exePath: path.join(process.env.LOCALAPPDATA, 'Programs', 'Antigravity', 'Antigravity.exe'),
        type: 'launch_app',
        target: path.join(process.env.LOCALAPPDATA, 'Programs', 'Antigravity', 'Antigravity.exe')
      },
    };
    for (const [k, v] of Object.entries(common)) {
      this.apps.set(k, v);
    }

    // 2. Load StartApps dynamically
    try {
      const raw = execSync('powershell -NoProfile -Command "Get-StartApps | ForEach-Object { $_.Name + \' ||| \' + $_.AppID }"', { encoding: 'utf8' });
      const lines = raw.split(/\r?\n/).filter(l => l.includes('|||'));
      for (const line of lines) {
        const [name, appId] = line.split('|||').map(s => s.trim());
        if (!name || !appId) continue;
        const lower = name.toLowerCase();
        if (lower.includes('uninstall') || lower.includes('setup') || lower.includes('helper') || lower.includes('manual')) continue;

        const item = {
          name,
          appId,
          type: 'windows_app_id',
        };

        if (!this.apps.has(lower)) {
          this.apps.set(lower, item);
        }

        // Add browser suffix aliases
        if (lower === 'brave') this.apps.set('brave browser', this.apps.get('brave'));
        if (lower === 'comet') this.apps.set('comet browser', this.apps.get('comet'));
        if (lower === 'google chrome') this.apps.set('chrome browser', common.chrome);

        // Clean version suffixes
        const noVersion = lower.replace(/\s+20\d\d(?:\s+.*)?$/i, '').trim();
        if (noVersion && noVersion !== lower && !this.apps.has(noVersion)) {
          this.apps.set(noVersion, item);
        }
      }
    } catch (_) {}
  }

  match(query) {
    let clean = query.trim().toLowerCase()
      .replace(/^(can you please|could you please|please|pointy|can you|could you|hey pointy)\s+/i, '')
      .replace(/\s+(please|for me|right now)$/i, '')
      .trim();

    // Check specific browser + website: e.g. "open youtube in brave", "open github in comet"
    const inBrowserMatch = clean.match(/^open\s+(.+?)\s+in\s+(brave|comet|chrome|edge)$/i);
    if (inBrowserMatch) {
      const site = inBrowserMatch[1].trim();
      const browser = inBrowserMatch[2].trim().toLowerCase();
      const app = this.apps.get(browser);
      let targetUrl = site;
      if (site === 'youtube') targetUrl = 'https://www.youtube.com';
      else if (site === 'github') targetUrl = 'https://www.github.com';
      else if (site === 'google') targetUrl = 'https://www.google.com';
      else if (!targetUrl.startsWith('http')) targetUrl = 'https://' + targetUrl;

      return {
        type: 'open_in_browser',
        browser,
        url: targetUrl,
        exePath: app?.exePath,
        reply: `Opening ${site} in ${app?.name || browser}!`
      };
    }

    // Check open app
    const appQuery = clean.replace(/^(open|launch|start|run|bring up|show|switch to)\s+/i, '').trim();

    if (this.apps.has(appQuery)) {
      const app = this.apps.get(appQuery);
      return {
        type: app.type,
        appId: app.appId,
        target: app.target || app.exePath,
        name: app.name,
        reply: `Opening ${app.name} for you!`
      };
    }

    // Prefix/fuzzy matching
    for (const [k, app] of this.apps.entries()) {
      if (appQuery === k || appQuery.startsWith(k + ' ') || appQuery.endsWith(' ' + k)) {
        return {
          type: app.type,
          appId: app.appId,
          target: app.target || app.exePath,
          name: app.name,
          reply: `Opening ${app.name} for you!`
        };
      }
    }

    return null;
  }
}

const tester = new UniversalMatcherTest();
const queries = [
  'open comet',
  'open comet browser',
  'launch comet',
  'open brave',
  'open brave browser',
  'open capcut',
  'open notion',
  'open perplexity',
  'open comfyui',
  'open youtube in brave',
  'open github in comet',
  'open antigravity ide',
  'open antigravity',
  'open claude'
];

for (const q of queries) {
  const res = tester.match(q);
  console.log(`[PASS] "${q}" => Type: ${res?.type} | Name: ${res?.name || res?.browser} | Reply: "${res?.reply}"`);
}

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

class ActionServiceV2 {
  constructor() {
    this.installedApps = new Map();
    this.chromeProfiles = [];
    this.init();
  }

  init() {
    this.loadChromeProfiles();
    this.scanInstalledApps();
  }

  loadChromeProfiles() {
    this.chromeProfiles = [];
    const localStatePath = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'Local State');
    if (fs.existsSync(localStatePath)) {
      try {
        const state = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
        const cache = state.profile?.info_cache || {};
        for (const [dir, info] of Object.entries(cache)) {
          this.chromeProfiles.push({
            dir,
            name: info.name || '',
            email: info.user_name || '',
          });
        }
      } catch (e) {
        console.warn('Error reading Chrome profiles:', e.message);
      }
    }
  }

  scanInstalledApps() {
    this.installedApps = new Map();

    // 1. Built-in Windows System Tools
    const systemApps = {
      'notepad': { name: 'Notepad', target: 'notepad.exe', type: 'launch_app' },
      'notes': { name: 'Notepad', target: 'notepad.exe', type: 'launch_app' },
      'calculator': { name: 'Calculator', target: 'calc.exe', type: 'launch_app' },
      'calc': { name: 'Calculator', target: 'calc.exe', type: 'launch_app' },
      'paint': { name: 'Paint', target: 'mspaint.exe', type: 'launch_app' },
      'mspaint': { name: 'Paint', target: 'mspaint.exe', type: 'launch_app' },
      'terminal': { name: 'Terminal', target: 'wt.exe', fallback: 'powershell.exe', type: 'launch_app' },
      'powershell': { name: 'PowerShell', target: 'powershell.exe', type: 'launch_app' },
      'cmd': { name: 'Command Prompt', target: 'cmd.exe', type: 'launch_app' },
      'command prompt': { name: 'Command Prompt', target: 'cmd.exe', type: 'launch_app' },
      'task manager': { name: 'Task Manager', target: 'taskmgr.exe', type: 'launch_app' },
      'taskmgr': { name: 'Task Manager', target: 'taskmgr.exe', type: 'launch_app' },
      'settings': { name: 'Windows Settings', target: 'ms-settings:', type: 'system_uri' },
      'windows settings': { name: 'Windows Settings', target: 'ms-settings:', type: 'system_uri' },
      'chrome': { name: 'Google Chrome', target: 'chrome.exe', type: 'launch_app' },
      'google chrome': { name: 'Google Chrome', target: 'chrome.exe', type: 'launch_app' },
      'edge': { name: 'Microsoft Edge', target: 'msedge.exe', type: 'launch_app' },
      'microsoft edge': { name: 'Microsoft Edge', target: 'msedge.exe', type: 'launch_app' },
    };
    for (const [k, v] of Object.entries(systemApps)) {
      this.installedApps.set(k, v);
    }

    // 2. Specific Known Modern Desktop Apps on User Machine
    // Antigravity
    const antiPaths = [
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravity', 'Antigravity.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravity IDE', 'Antigravity IDE.exe'),
    ];
    for (const ap of antiPaths) {
      if (fs.existsSync(ap)) {
        this.installedApps.set('antigravity', { name: 'Antigravity', target: ap, type: 'launch_app' });
        this.installedApps.set('antigravity ide', { name: 'Antigravity IDE', target: ap, type: 'launch_app' });
        break;
      }
    }

    // Claude Desktop App
    this.installedApps.set('claude', {
      name: 'Claude',
      target: 'shell:AppsFolder\\Claude_pzs8sxrjxfjjc!Claude',
      type: 'windows_app',
    });
    this.installedApps.set('claude app', {
      name: 'Claude',
      target: 'shell:AppsFolder\\Claude_pzs8sxrjxfjjc!Claude',
      type: 'windows_app',
    });
    this.installedApps.set('claude desktop', {
      name: 'Claude',
      target: 'shell:AppsFolder\\Claude_pzs8sxrjxfjjc!Claude',
      type: 'windows_app',
    });

    // Apple Music & Apple TV
    this.installedApps.set('apple music', {
      name: 'Apple Music',
      target: 'shell:AppsFolder\\AppleInc.AppleMusicWin_nzyj5cx40ttqa!App',
      type: 'windows_app',
    });
    this.installedApps.set('apple tv', {
      name: 'Apple TV',
      target: 'shell:AppsFolder\\AppleInc.AppleTVWin_nzyj5cx40ttqa!App',
      type: 'windows_app',
    });

    // 3. Scan User Start Menu Shortcuts (.lnk)
    const shortcutDirs = [
      path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    ];

    const walk = (dir) => {
      if (!fs.existsSync(dir)) return;
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const it of items) {
          const full = path.join(dir, it.name);
          if (it.isDirectory()) {
            walk(full);
          } else if (it.name.endsWith('.lnk')) {
            const base = path.basename(it.name, '.lnk').toLowerCase();
            if (!base.includes('uninstall') && !base.includes('help')) {
              if (!this.installedApps.has(base)) {
                this.installedApps.set(base, {
                  name: path.basename(it.name, '.lnk'),
                  target: full,
                  type: 'launch_shortcut',
                });
              }
            }
          }
        }
      } catch (_) {}
    };

    for (const sd of shortcutDirs) {
      walk(sd);
    }
  }

  matchChromeProfile(query) {
    const q = query.toLowerCase();
    for (const p of this.chromeProfiles) {
      const pName = p.name.toLowerCase();
      const pEmail = p.email.toLowerCase();

      // Student / College / University account
      if (/student|nitw|college|university|study/i.test(q)) {
        if (pName.includes('student') || pEmail.includes('student') || pName.includes('nitw')) {
          return p;
        }
      }

      // Work account
      if (/work|office|job|business|shopzy/i.test(q)) {
        if (pName.includes('work') || pEmail.includes('shopzy')) {
          return p;
        }
      }

      // Personal account
      if (/personal|main|subhash/i.test(q)) {
        if (p.dir === 'Default' || p.dir === 'Profile 1') {
          return p;
        }
      }
    }
    return null;
  }

  extractWebTarget(query) {
    const q = query.toLowerCase();
    const map = [
      { pattern: /\b(calender|calendar)\b/i, url: 'https://calendar.google.com', name: 'Google Calendar' },
      { pattern: /\b(gmail|mail|email|inbox)\b/i, url: 'https://mail.google.com', name: 'Gmail' },
      { pattern: /\b(classroom)\b/i, url: 'https://classroom.google.com', name: 'Google Classroom' },
      { pattern: /\b(drive|google drive)\b/i, url: 'https://drive.google.com', name: 'Google Drive' },
      { pattern: /\b(docs|google docs)\b/i, url: 'https://docs.google.com', name: 'Google Docs' },
      { pattern: /\b(sheets|google sheets)\b/i, url: 'https://sheets.google.com', name: 'Google Sheets' },
      { pattern: /\b(meet|google meet)\b/i, url: 'https://meet.google.com', name: 'Google Meet' },
      { pattern: /\b(youtube|yt)\b/i, url: 'https://www.youtube.com', name: 'YouTube' },
      { pattern: /\b(github)\b/i, url: 'https://www.github.com', name: 'GitHub' },
      { pattern: /\b(chatgpt|chat gpt)\b/i, url: 'https://chatgpt.com', name: 'ChatGPT' },
      { pattern: /\b(reddit)\b/i, url: 'https://www.reddit.com', name: 'Reddit' },
    ];

    for (const item of map) {
      if (item.pattern.test(q)) {
        return item;
      }
    }
    return null;
  }

  matchLocalIntent(query) {
    if (!query || typeof query !== 'string') return null;
    let clean = query.trim().toLowerCase();

    // Remove polite prefix / suffix
    clean = clean
      .replace(/^(can you please|could you please|please|pointy|can you|could you|hey pointy)\s+/i, '')
      .replace(/\s+(please|for me|right now)$/i, '')
      .trim();

    // ─── 1. Media & Music Commands ───────────────────────────────────────
    if (/^play music from apple music|^play music on apple music|^play apple music/i.test(clean)) {
      return {
        matched: true,
        type: 'media_play_app',
        appTarget: 'shell:AppsFolder\\AppleInc.AppleMusicWin_nzyj5cx40ttqa!App',
        name: 'Apple Music',
        reply: 'Opening Apple Music and starting playback for you!',
      };
    }

    if (/^(play music|resume music|pause music|stop music|toggle music)$/i.test(clean)) {
      return {
        matched: true,
        type: 'media_key',
        key: 'play_pause',
        name: 'Media Play/Pause',
        reply: 'Toggled music playback!',
      };
    }

    if (/^(next song|next track|skip song|skip track)$/i.test(clean)) {
      return {
        matched: true,
        type: 'media_key',
        key: 'next_track',
        name: 'Next Track',
        reply: 'Skipped to the next track!',
      };
    }

    if (/^(previous song|previous track|prev song)$/i.test(clean)) {
      return {
        matched: true,
        type: 'media_key',
        key: 'prev_track',
        name: 'Previous Track',
        reply: 'Returning to previous track!',
      };
    }

    if (/^(volume up|louder|increase volume)$/i.test(clean)) {
      return {
        matched: true,
        type: 'media_key',
        key: 'volume_up',
        name: 'Volume Up',
        reply: 'Turned up volume!',
      };
    }

    if (/^(volume down|quieter|lower volume)$/i.test(clean)) {
      return {
        matched: true,
        type: 'media_key',
        key: 'volume_down',
        name: 'Volume Down',
        reply: 'Lowered volume!',
      };
    }

    // ─── 2. Chrome Specific Profile & Web Service Routing ───────────────
    // e.g. "open chrome from my student account"
    // e.g. "open calender in the chrome from student account"
    // e.g. "open calendar from student account"
    const matchedProfile = this.matchChromeProfile(clean);
    if (matchedProfile) {
      const webTarget = this.extractWebTarget(clean);
      if (webTarget) {
        return {
          matched: true,
          type: 'chrome_profile_url',
          profileDir: matchedProfile.dir,
          profileName: matchedProfile.name,
          url: webTarget.url,
          name: `${webTarget.name} (${matchedProfile.name})`,
          reply: `Opening ${webTarget.name} in your ${matchedProfile.name} Chrome profile!`,
        };
      }

      // If user specifically asked to open Chrome with that profile
      if (clean.includes('chrome') || clean.includes('browser') || clean.includes('account')) {
        return {
          matched: true,
          type: 'chrome_profile',
          profileDir: matchedProfile.dir,
          profileName: matchedProfile.name,
          name: `Chrome (${matchedProfile.name})`,
          reply: `Opening Chrome with your ${matchedProfile.name} profile!`,
        };
      }
    }

    // ─── 3. Search Queries (YouTube, Google) ─────────────────────────────
    const ytSearch = clean.match(/^(?:search|look up|find)\s+(?:on\s+youtube|youtube\s+for)\s+(.+)$/i) ||
                     clean.match(/^youtube\s+(?:search|for)\s+(.+)$/i);
    if (ytSearch && ytSearch[1]) {
      const queryTerm = encodeURIComponent(ytSearch[1].trim());
      return {
        matched: true,
        type: 'open_url',
        target: `https://www.youtube.com/results?search_query=${queryTerm}`,
        name: `YouTube Search: "${ytSearch[1].trim()}"`,
        reply: `Searching YouTube for ${ytSearch[1].trim()}!`,
      };
    }

    const gSearch = clean.match(/^(?:search|google|look up|find)\s+(?:on\s+google|google\s+for|for)\s+(.+)$/i);
    if (gSearch && gSearch[1]) {
      const queryTerm = encodeURIComponent(gSearch[1].trim());
      return {
        matched: true,
        type: 'open_url',
        target: `https://www.google.com/search?q=${queryTerm}`,
        name: `Google Search: "${gSearch[1].trim()}"`,
        reply: `Searching Google for ${gSearch[1].trim()}!`,
      };
    }

    // ─── 4. Open / Launch App or Website ─────────────────────────────────
    let appOrUrl = clean
      .replace(/^(open|launch|start|run|bring up|switch to|show|go to)\s+/i, '')
      .trim();

    // Check installed apps (including Antigravity, Claude, Apple Music, etc.)
    if (this.installedApps.has(appOrUrl)) {
      const app = this.installedApps.get(appOrUrl);
      return {
        matched: true,
        type: app.type,
        target: app.target,
        name: app.name,
        fallback: app.fallback,
        reply: `Opening ${app.name} for you!`,
      };
    }

    // Check without punctuation or extra words
    for (const [key, app] of this.installedApps.entries()) {
      if (appOrUrl === key || appOrUrl.startsWith(key + ' ') || appOrUrl.endsWith(' ' + key)) {
        return {
          matched: true,
          type: app.type,
          target: app.target,
          name: app.name,
          fallback: app.fallback,
          reply: `Opening ${app.name} for you!`,
        };
      }
    }

    // Check web target
    const generalWebTarget = this.extractWebTarget(clean);
    if (generalWebTarget) {
      return {
        matched: true,
        type: 'open_url',
        target: generalWebTarget.url,
        name: generalWebTarget.name,
        reply: `Opening ${generalWebTarget.name}!`,
      };
    }

    return null;
  }
}

const service = new ActionServiceV2();

const userTestCases = [
  'open antigravity',
  'can you open antigravity please',
  'launch antigravity ide',
  'open chrome from my student account',
  'open chrome in student account',
  'open calender in the chrome from student account',
  'open calendar from my student account',
  'open gmail from student account',
  'open claude',
  'can you open claude for me',
  'play music from apple music',
  'play apple music',
  'play music',
  'pause music',
  'next song',
  'open notepad',
  'open youtube',
  'search youtube for lofi beats',
  'open notion',
  'open perplexity',
];

console.log('--- RUNNING ALL USER TEST CASES ---');
for (const tc of userTestCases) {
  const res = service.matchLocalIntent(tc);
  if (!res) {
    console.error(`FAILED: "${tc}"`);
  } else {
    console.log(`[PASS] "${tc}"`);
    console.log(`       => Type: ${res.type} | Name: ${res.name} | Reply: "${res.reply}"`);
    if (res.target) console.log(`       => Target: ${res.target}`);
    if (res.profileDir) console.log(`       => Profile: ${res.profileDir} | URL: ${res.url}`);
  }
}

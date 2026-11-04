const { shell, clipboard } = require('electron');
const { exec, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const https = require('https');

/**
 * ActionService
 * Universal Windows Desktop Automation & Application Execution Engine.
 * 
 * Capabilities:
 * 1. Multi-Browser Ecosystem: Brave, Comet (Perplexity), Google Chrome, Microsoft Edge
 * 2. Multi-Browser Profiles: Dynamically indexes user profiles for Chrome, Brave, Comet, Edge
 * 3. In-Browser Routing: "open youtube in brave", "open github in comet", "open calendar in brave"
 * 4. Multi-Browser Search: "search react in brave", "ask comet how far is mars", "search in chrome"
 * 5. Media & Song Playback Across Apps:
 *    - YouTube Autoplay in Brave: "play honeypie in brave", "play honeypie from youtube in brave"
 *    - YouTube Autoplay in Comet: "play honeypie in comet"
 *    - Spotify Integration: "play honeypie on spotify"
 *    - Apple Music Integration: "play blinding lights on apple music"
 *    - Universal YouTube Playback: "play honeypie from youtube", "play lofi"
 * 6. Windows StartApps Universal Indexer: dynamically indexes all 190+ Windows desktop apps,
 *    Appx packages, and PWAs (VLC, CapCut, Notion, Perplexity, LM Studio, Kimi, AutoCAD, C4D, etc.)
 * 7. Antigravity IDE vs Antigravity launcher separation
 * 8. Zero-latency non-blocking OS process dispatch
 */
class ActionService {
  constructor() {
    this.installedApps = new Map();
    this.browserProfiles = { chrome: [], brave: [], comet: [], edge: [] };
    this.chromeProfiles = []; // Backwards compatibility
    this.websites = {};
    this.folders = {};
    this.init();
  }

  init() {
    this.loadBrowserProfiles();
    this.scanInstalledApps();
    this.initWebsitesAndFolders();
  }

  /**
   * Load and parse user profiles across all installed Chromium browsers
   * (Google Chrome, Brave Browser, Perplexity Comet, Microsoft Edge).
   */
  loadBrowserProfiles() {
    this.browserProfiles = { chrome: [], brave: [], comet: [], edge: [] };

    const browserStatePaths = {
      chrome: path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'Local State'),
      brave: path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware', 'Brave-Browser', 'User Data', 'Local State'),
      comet: path.join(process.env.LOCALAPPDATA || '', 'Perplexity', 'Comet', 'User Data', 'Local State'),
      edge: path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data', 'Local State'),
    };

    for (const [browserKey, statePath] of Object.entries(browserStatePaths)) {
      if (fs.existsSync(statePath)) {
        try {
          const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
          const cache = state.profile?.info_cache || {};
          for (const [dir, info] of Object.entries(cache)) {
            this.browserProfiles[browserKey].push({
              browser: browserKey,
              dir,
              name: info.name || '',
              email: info.user_name || '',
            });
          }
          console.log(`[ActionService] ✅ Loaded ${this.browserProfiles[browserKey].length} ${browserKey} profile(s)`);
        } catch (e) {
          console.warn(`[ActionService] Notice reading ${browserKey} profiles:`, e.message);
        }
      }
    }

    // Keep chromeProfiles reference for backwards compatibility
    this.chromeProfiles = this.browserProfiles.chrome;
  }

  /**
   * Universal Windows App Indexer:
   * Dynamically loads all installed Windows applications, Appx packages,
   * desktop programs, and Start Menu shortcuts.
   */
  scanInstalledApps() {
    this.installedApps = new Map();

    // ─── 1. Major Web Browsers with Executables and AppIDs ─────────────────
    const braveExe = path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe');
    const braveItem = {
      name: 'Brave',
      browserKey: 'brave',
      appId: 'Brave.FH2PZEZMTZJQAQJMHT3SSFWNEU',
      target: braveExe,
      exePath: braveExe,
      type: fs.existsSync(braveExe) ? 'launch_app' : 'windows_app_id',
    };
    this.installedApps.set('brave', braveItem);
    this.installedApps.set('brave browser', braveItem);

    const cometExe = path.join(process.env.LOCALAPPDATA || '', 'Perplexity', 'Comet', 'Application', 'comet.exe');
    const cometItem = {
      name: 'Comet',
      browserKey: 'comet',
      appId: 'Comet.FH2PZEZMTZJQAQJMHT3SSFWNEU',
      target: cometExe,
      exePath: cometExe,
      type: fs.existsSync(cometExe) ? 'launch_app' : 'windows_app_id',
    };
    this.installedApps.set('comet', cometItem);
    this.installedApps.set('comet browser', cometItem);

    const chromeItem = {
      name: 'Google Chrome',
      browserKey: 'chrome',
      target: 'chrome.exe',
      exePath: 'chrome.exe',
      type: 'launch_app',
    };
    this.installedApps.set('chrome', chromeItem);
    this.installedApps.set('google chrome', chromeItem);
    this.installedApps.set('chrome browser', chromeItem);

    const edgeItem = {
      name: 'Microsoft Edge',
      browserKey: 'edge',
      target: 'msedge.exe',
      exePath: 'msedge.exe',
      type: 'launch_app',
    };
    this.installedApps.set('edge', edgeItem);
    this.installedApps.set('microsoft edge', edgeItem);
    this.installedApps.set('edge browser', edgeItem);

    // ─── 2. Antigravity & Antigravity IDE (Separate standalone apps!) ─────
    const antiAppPath = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravity', 'Antigravity.exe');
    const antiIdePath = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravity IDE', 'Antigravity IDE.exe');

    if (fs.existsSync(antiAppPath)) {
      this.installedApps.set('antigravity', { name: 'Antigravity', target: antiAppPath, type: 'launch_app' });
      this.installedApps.set('antigravity app', { name: 'Antigravity', target: antiAppPath, type: 'launch_app' });
    }
    if (fs.existsSync(antiIdePath)) {
      const ideItem = { name: 'Antigravity IDE', target: antiIdePath, type: 'launch_app' };
      this.installedApps.set('antigravity ide', ideItem);
      this.installedApps.set('ide', ideItem);
      this.installedApps.set('antigravity code', ideItem);
      this.installedApps.set('antigravity editor', ideItem);
    }

    // ─── 3. Media Players & Streaming Apps ─────────────────────────────────
    // VLC Media Player
    const vlcExePaths = [
      'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
      'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe',
      path.join(process.env.PROGRAMFILES || '', 'VideoLAN', 'VLC', 'vlc.exe'),
    ];
    let vlcFoundPath = vlcExePaths.find(p => fs.existsSync(p));
    const vlcItem = {
      name: 'VLC Media Player',
      target: vlcFoundPath || 'vlc.exe',
      type: 'launch_app',
    };
    this.installedApps.set('vlc', vlcItem);
    this.installedApps.set('vlc media player', vlcItem);
    this.installedApps.set('vlc player', vlcItem);

    // Spotify
    const spotifyItem = {
      name: 'Spotify',
      appId: 'SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify',
      target: 'spotify:',
      type: 'system_uri',
    };
    this.installedApps.set('spotify', spotifyItem);
    this.installedApps.set('spotify music', spotifyItem);

    // Apple Music & Apple TV (Windows Store Apps + Protocol Activation)
    const appleMusicItem = {
      name: 'Apple Music',
      appId: 'AppleInc.AppleMusicWin_nzyj5cx40ttqa!App',
      protocol: 'music:',
      type: 'apple_app',
    };
    this.installedApps.set('apple music', appleMusicItem);
    this.installedApps.set('apple music app', appleMusicItem);
    this.installedApps.set('music app', appleMusicItem);

    const appleTvItem = {
      name: 'Apple TV',
      appId: 'AppleInc.AppleTVWin_nzyj5cx40ttqa!App',
      protocol: 'videos:',
      type: 'apple_app',
    };
    this.installedApps.set('apple tv', appleTvItem);
    this.installedApps.set('apple tv app', appleTvItem);
    this.installedApps.set('appletv', appleTvItem);
    this.installedApps.set('apple tv plus', appleTvItem);
    this.installedApps.set('apple tv+', appleTvItem);

    // ─── 4. Native AI & Productivity Desktop Apps ──────────────────────────
    // ChatGPT Desktop Apps (Modern Codex App & Classic Desktop)
    const chatGptItem = {
      name: 'ChatGPT',
      appId: 'OpenAI.Codex_2p2nqsd0c76g0!App',
      fallbackAppId: 'OpenAI.ChatGPT-Desktop_2p2nqsd0c76g0!ChatGPT',
      type: 'windows_app_id',
    };
    this.installedApps.set('chatgpt', chatGptItem);
    this.installedApps.set('chat gpt', chatGptItem);
    this.installedApps.set('chat-gpt', chatGptItem);
    this.installedApps.set('chatgpt app', chatGptItem);
    this.installedApps.set('chat gpt app', chatGptItem);
    this.installedApps.set('chatgpt desktop', chatGptItem);
    this.installedApps.set('chat gpt desktop', chatGptItem);
    this.installedApps.set('openai', chatGptItem);
    this.installedApps.set('openai app', chatGptItem);
    this.installedApps.set('openai chatgpt', chatGptItem);
    this.installedApps.set('chatgpt classic', {
      name: 'ChatGPT Classic',
      appId: 'OpenAI.ChatGPT-Desktop_2p2nqsd0c76g0!ChatGPT',
      type: 'windows_app_id',
    });

    // Claude Desktop App
    const claudeItem = {
      name: 'Claude',
      appId: 'Claude_pzs8sxrjxfjjc!Claude',
      type: 'windows_app_id',
    };
    this.installedApps.set('claude', claudeItem);
    this.installedApps.set('claude app', claudeItem);
    this.installedApps.set('claude desktop', claudeItem);

    // Perplexity Desktop App
    const perplexityItem = {
      name: 'Perplexity',
      appId: 'com.todesktop.25020447d4kq915',
      type: 'windows_app_id',
    };
    this.installedApps.set('perplexity', perplexityItem);
    this.installedApps.set('perplexity ai', perplexityItem);
    this.installedApps.set('perplexity app', perplexityItem);

    // LM Studio & Kimi
    this.installedApps.set('lm studio', { name: 'LM Studio', appId: 'ai.elementlabs.lmstudio', type: 'windows_app_id' });
    this.installedApps.set('lmstudio', { name: 'LM Studio', appId: 'ai.elementlabs.lmstudio', type: 'windows_app_id' });
    this.installedApps.set('kimi', { name: 'Kimi', appId: 'com.moonshot.kimichat', type: 'windows_app_id' });
    this.installedApps.set('kimi chat', { name: 'Kimi', appId: 'com.moonshot.kimichat', type: 'windows_app_id' });

    // Notion
    this.installedApps.set('notion', { name: 'Notion', appId: 'com.electron.notion', type: 'windows_app_id' });

    // Creative Software
    this.installedApps.set('capcut', {
      name: 'CapCut',
      appId: 'c:.users.srira.appdata.local.capcut.apps.8.9.1.3802.capcut.exe',
      type: 'windows_app_id'
    });
    this.installedApps.set('autocad', {
      name: 'AutoCAD 2026',
      appId: 'Microsoft.AutoGenerated.{4DEF128D-A66F-F7C6-FA94-35A55A89477D}',
      type: 'windows_app_id'
    });
    this.installedApps.set('cinema 4d', {
      name: 'Cinema 4D 2025',
      appId: '{6D809377-6AF0-444B-8957-A3773F02200E}\\Maxon Cinema 4D 2025\\Cinema 4D.exe',
      type: 'windows_app_id'
    });
    this.installedApps.set('c4d', this.installedApps.get('cinema 4d'));

    // Messaging & Communication
    this.installedApps.set('whatsapp', { name: 'WhatsApp', appId: '5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App', type: 'windows_app_id' });
    this.installedApps.set('teams', { name: 'Microsoft Teams', appId: 'MSTeams_8wekyb3d8bbwe!MSTeams', type: 'windows_app_id' });
    this.installedApps.set('microsoft teams', this.installedApps.get('teams'));
    this.installedApps.set('zoom', { name: 'Zoom Workplace', appId: 'zoom.us.Zoom Video Meetings', type: 'windows_app_id' });
    this.installedApps.set('zoom workplace', this.installedApps.get('zoom'));

    // ─── 5. Built-in Windows System Tools ──────────────────────────────────
    const systemApps = {
      'notepad': { name: 'Notepad', target: 'notepad.exe', type: 'launch_app' },
      'note': { name: 'Notepad', target: 'notepad.exe', type: 'launch_app' },
      'notes': { name: 'Notepad', target: 'notepad.exe', type: 'launch_app' },
      'calculator': { name: 'Calculator', target: 'calc.exe', type: 'launch_app' },
      'calc': { name: 'Calculator', target: 'calc.exe', type: 'launch_app' },
      'paint': { name: 'Paint', target: 'mspaint.exe', type: 'launch_app' },
      'mspaint': { name: 'Paint', target: 'mspaint.exe', type: 'launch_app' },
      'terminal': { name: 'Windows Terminal', target: 'wt.exe', fallback: 'powershell.exe', type: 'launch_app' },
      'powershell': { name: 'PowerShell', target: 'powershell.exe', type: 'launch_app' },
      'cmd': { name: 'Command Prompt', target: 'cmd.exe', type: 'launch_app' },
      'command prompt': { name: 'Command Prompt', target: 'cmd.exe', type: 'launch_app' },
      'task manager': { name: 'Task Manager', target: 'taskmgr.exe', type: 'launch_app' },
      'taskmgr': { name: 'Task Manager', target: 'taskmgr.exe', type: 'launch_app' },
      'settings': { name: 'Windows Settings', target: 'ms-settings:', type: 'system_uri' },
      'windows settings': { name: 'Windows Settings', target: 'ms-settings:', type: 'system_uri' },
      'vscode': { name: 'Visual Studio Code', target: 'code', type: 'launch_app' },
      'vs code': { name: 'Visual Studio Code', target: 'code', type: 'launch_app' },
      'code': { name: 'Visual Studio Code', target: 'code', type: 'launch_app' },
      'visual studio code': { name: 'Visual Studio Code', target: 'code', type: 'launch_app' },
      'discord': { name: 'Discord', target: 'discord:', type: 'system_uri' },
      'steam': { name: 'Steam', target: 'steam://', type: 'system_uri' },
      'word': { name: 'Microsoft Word', target: 'winword', type: 'launch_app' },
      'excel': { name: 'Microsoft Excel', target: 'excel', type: 'launch_app' },
      'powerpoint': { name: 'Microsoft PowerPoint', target: 'powerpnt', type: 'launch_app' },
      'ppt': { name: 'Microsoft PowerPoint', target: 'powerpnt', type: 'launch_app' },
      'onenote': { name: 'OneNote', target: 'onenote', type: 'launch_app' },
      'todo': { name: 'Microsoft To Do', appId: 'Microsoft.Todos_8wekyb3d8bbwe!App', type: 'windows_app_id' },
      'to do': { name: 'Microsoft To Do', appId: 'Microsoft.Todos_8wekyb3d8bbwe!App', type: 'windows_app_id' },
    };
    for (const [k, v] of Object.entries(systemApps)) {
      this.installedApps.set(k, v);
    }

    // ─── 6. Dynamic Scan of Windows StartApps (190+ Windows Applications) ──
    try {
      const raw = execSync('powershell -NoProfile -Command "Get-StartApps | ForEach-Object { $_.Name + \' ||| \' + $_.AppID }"', { encoding: 'utf8' });
      const lines = raw.split(/\r?\n/).filter(l => l.includes('|||'));
      for (const line of lines) {
        const [name, appId] = line.split('|||').map(s => s.trim());
        if (!name || !appId) continue;
        const lower = name.toLowerCase();

        // Skip uninstallers, helpers, documentation, and skinned variants
        if (
          lower.includes('uninstall') ||
          lower.includes('setup') ||
          lower.includes('helper') ||
          lower.includes('manual') ||
          lower.includes('documentation') ||
          lower.includes('website') ||
          lower.includes('reset preferences') ||
          lower.includes('skinned')
        ) {
          continue;
        }

        const item = { name, appId, type: 'windows_app_id' };

        if (!this.installedApps.has(lower)) {
          this.installedApps.set(lower, item);
        }

        // Clean versions & suffixes:
        // e.g. "AutoCAD 2026 - English" -> "autocad 2026", "autocad"
        // e.g. "Adobe Premiere Pro 2026" -> "adobe premiere pro", "premiere pro", "premiere"
        // e.g. "Zoom Workplace" -> "zoom"
        const cleanName = lower
          .replace(/\s+-\s+[a-z]+$/i, '')
          .replace(/\s+20\d\d(?:\s+.*)?$/i, '')
          .replace(/\s+\(.*\)$/i, '')
          .trim();

        if (cleanName && !this.installedApps.has(cleanName)) {
          this.installedApps.set(cleanName, item);
        }

        // Brand/prefix stripping (e.g. "Maxon Cinema 4D" -> "cinema 4d")
        const noPrefix = cleanName.replace(/^(adobe|autodesk|microsoft|maxon)\s+/i, '').trim();
        if (noPrefix && !this.installedApps.has(noPrefix)) {
          this.installedApps.set(noPrefix, item);
        }
      }
    } catch (startAppsErr) {
      console.warn('[ActionService] Notice scanning StartApps:', startAppsErr.message);
    }

    console.log(`[ActionService] ✅ Indexed ${this.installedApps.size} applications & aliases across all tools`);
  }

  initWebsitesAndFolders() {
    this.websites = {
      'youtube': { url: 'https://www.youtube.com', name: 'YouTube' },
      'yt': { url: 'https://www.youtube.com', name: 'YouTube' },
      'google': { url: 'https://www.google.com', name: 'Google' },
      'github': { url: 'https://www.github.com', name: 'GitHub' },
      'chatgpt': { url: 'https://chatgpt.com', name: 'ChatGPT' },
      'openai': { url: 'https://openai.com', name: 'OpenAI' },
      'gmail': { url: 'https://mail.google.com', name: 'Gmail' },
      'calendar': { url: 'https://calendar.google.com', name: 'Google Calendar' },
      'calender': { url: 'https://calendar.google.com', name: 'Google Calendar' },
      'classroom': { url: 'https://classroom.google.com', name: 'Google Classroom' },
      'drive': { url: 'https://drive.google.com', name: 'Google Drive' },
      'docs': { url: 'https://docs.google.com', name: 'Google Docs' },
      'sheets': { url: 'https://sheets.google.com', name: 'Google Sheets' },
      'meet': { url: 'https://meet.google.com', name: 'Google Meet' },
      'reddit': { url: 'https://www.reddit.com', name: 'Reddit' },
      'twitter': { url: 'https://x.com', name: 'X (Twitter)' },
      'x': { url: 'https://x.com', name: 'X' },
      'netflix': { url: 'https://www.netflix.com', name: 'Netflix' },
      'amazon': { url: 'https://www.amazon.com', name: 'Amazon' },
      'wikipedia': { url: 'https://www.wikipedia.org', name: 'Wikipedia' },
      'instagram': { url: 'https://www.instagram.com', name: 'Instagram' },
      'linkedin': { url: 'https://www.linkedin.com', name: 'LinkedIn' },
      'stackoverflow': { url: 'https://stackoverflow.com', name: 'Stack Overflow' },
    };

    this.folders = {
      'downloads': path.join(os.homedir(), 'Downloads'),
      'my downloads': path.join(os.homedir(), 'Downloads'),
      'documents': path.join(os.homedir(), 'Documents'),
      'my documents': path.join(os.homedir(), 'Documents'),
      'pictures': path.join(os.homedir(), 'Pictures'),
      'photos': path.join(os.homedir(), 'Pictures'),
      'desktop': path.join(os.homedir(), 'Desktop'),
      'music folder': path.join(os.homedir(), 'Music'),
      'my music': path.join(os.homedir(), 'Music'),
      'videos': path.join(os.homedir(), 'Videos'),
      'home': os.homedir(),
    };
  }

  /**
   * Resolves common site names, web services, or raw domains to full HTTPS URLs.
   */
  resolveUrl(target) {
    if (!target) return 'https://www.google.com';
    const t = target.toLowerCase().trim();
    if (this.websites[t]) return this.websites[t].url;
    if (t === 'calendar' || t === 'calender') return 'https://calendar.google.com';
    if (t === 'classroom') return 'https://classroom.google.com';
    if (t === 'gmail' || t === 'email' || t === 'mail' || t === 'inbox') return 'https://mail.google.com';
    if (t === 'drive') return 'https://drive.google.com';
    if (t === 'meet') return 'https://meet.google.com';
    if (t === 'docs') return 'https://docs.google.com';
    if (t === 'sheets') return 'https://sheets.google.com';
    if (t.startsWith('http://') || t.startsWith('https://')) return target;
    if (/^[a-zA-Z0-9-]+\.(?:com|org|io|net|edu|ai|gov|dev|app|co|me)(?:\/.*)?$/i.test(t)) {
      return 'https://' + target;
    }
    return 'https://' + target;
  }

  /**
   * Matches browser user profiles (Chrome, Brave, Comet, Edge) based on natural language expressions.
   */
  matchBrowserProfile(query, preferredBrowser = null) {
    const q = query.toLowerCase();

    // Determine target browser
    let targetBrowser = preferredBrowser;
    if (!targetBrowser) {
      if (q.includes('brave')) targetBrowser = 'brave';
      else if (q.includes('comet')) targetBrowser = 'comet';
      else if (q.includes('edge')) targetBrowser = 'edge';
      else if (q.includes('chrome')) targetBrowser = 'chrome';
      else targetBrowser = 'chrome'; // default browser for profiles
    }

    const profiles = this.browserProfiles[targetBrowser] || [];
    for (const p of profiles) {
      const pName = p.name.toLowerCase();
      const pEmail = p.email.toLowerCase();

      // Student / College / University account
      if (/student|nitw|college|university|study/i.test(q)) {
        if (pName.includes('student') || pEmail.includes('student') || pName.includes('nitw') || pName.includes('srirama')) {
          return { ...p, browser: targetBrowser };
        }
      }

      // Work account
      if (/work|office|job|business|shopzy/i.test(q)) {
        if (pName.includes('work') || pEmail.includes('shopzy') || (p.dir === 'Default' && targetBrowser === 'brave')) {
          return { ...p, browser: targetBrowser };
        }
      }

      // Personal account
      if (/personal|main|subhash/i.test(q)) {
        if (p.dir === 'Default' || p.dir === 'Profile 1' || pName.includes('subhash')) {
          return { ...p, browser: targetBrowser };
        }
      }
    }

    // Default profile if user explicitly asked for profile/account
    if (profiles.length > 0 && (q.includes('profile') || q.includes('account'))) {
      return { ...profiles[0], browser: targetBrowser };
    }

    return null;
  }

  // Backwards compatibility alias
  matchChromeProfile(query) {
    return this.matchBrowserProfile(query, 'chrome');
  }

  /**
   * Extracts target web service URLs (e.g. Google Calendar, Gmail, Classroom, etc.)
   */
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

  /**
   * Universal Local Application Resolver.
   * Checks if an installed desktop application, Windows Store app,
   * or system tool matches the query before falling back to any web URL.
   */
  findInstalledApp(query) {
    if (!query) return null;
    let clean = query.toLowerCase().trim()
      .replace(/^(open|launch|start|run|bring up|show|switch to|go to)\s+/i, '')
      .replace(/\s+(app|application|desktop|program|tool)$/i, '')
      .trim();

    // 1. Direct exact match in installedApps
    if (this.installedApps.has(clean)) {
      return this.installedApps.get(clean);
    }

    // 2. Normalized name (spaces removed: e.g. "chat gpt" -> "chatgpt", "vs code" -> "vscode")
    const collapsed = clean.replace(/\s+/g, '');
    if (this.installedApps.has(collapsed)) {
      return this.installedApps.get(collapsed);
    }

    // 3. Simplified (hyphens & spaces stripped)
    const simplified = clean.replace(/[-_\s]+/g, '');
    for (const [key, app] of this.installedApps.entries()) {
      const keySimp = key.replace(/[-_\s]+/g, '');
      if (keySimp === simplified) {
        return app;
      }
    }

    // 4. Word boundary / prefix matching
    for (const [key, app] of this.installedApps.entries()) {
      if (
        clean === key ||
        key.startsWith(clean + ' ') ||
        clean.startsWith(key + ' ') ||
        clean.endsWith(' ' + key) ||
        key === clean
      ) {
        return app;
      }
    }

    // 5. Contains whole word
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordRegex = new RegExp(`\\b${escaped}\\b`, 'i');
    for (const [key, app] of this.installedApps.entries()) {
      if (wordRegex.test(key)) {
        return app;
      }
    }

    return null;
  }

  /**
   * Fast natural language intent matcher for desktop actions.
   * Executed in <5ms locally before sending anything to network.
   */
  matchLocalIntent(query) {
    if (!query || typeof query !== 'string') return null;
    let clean = query.trim().toLowerCase();

    // Remove polite prefix / suffix
    clean = clean
      .replace(/^(can you please|could you please|please|pointy|can you|could you|hey pointy)\s+/i, '')
      .replace(/\s+(please|for me|right now)$/i, '')
      .trim();

    // ─── 00. Background Detailed Deep Research (Claude / ChatGPT) ───────
    // E.g.: "do a detailed research on quantum computing in claude"
    //       "research artificial general intelligence in chatgpt"
    //       "do a detailed research about black holes"
    //       "conduct deep research on renewable energy"
    //       "detailed research about solid state batteries in claude"
    const deepResearchMatch = clean.match(/^(?:do\s+(?:a\s+)?|conduct\s+(?:a\s+)?)?(?:detailed\s+research|deep\s+research|thorough\s+research|extensive\s+research)\s+(?:about|on|into|for)\s+(.+)$/i) ||
      clean.match(/^(?:research)\s+(?:about|on|into|for)?\s*(.+?)(?:\s+(?:in|on)\s+(claude|chatgpt))?$/i);

    if (deepResearchMatch) {
      let rawTopic = deepResearchMatch[1].trim();
      let targetApp = 'Claude';

      // Check if user specifically requested ChatGPT or Claude
      if (/\b(?:in|on)\s+chatgpt\b/i.test(rawTopic) || deepResearchMatch[2]?.toLowerCase() === 'chatgpt' || /\bchatgpt\b/i.test(clean)) {
        targetApp = 'ChatGPT';
        rawTopic = rawTopic.replace(/\s+(?:in|on)\s+chatgpt$/i, '').trim();
      } else if (/\b(?:in|on)\s+claude\b/i.test(rawTopic) || deepResearchMatch[2]?.toLowerCase() === 'claude' || /\bclaude\b/i.test(clean)) {
        targetApp = 'Claude';
        rawTopic = rawTopic.replace(/\s+(?:in|on)\s+claude$/i, '').trim();
      }

      // Clean topic prefixes
      const topic = rawTopic
        .replace(/^(?:about|on|into|for)\s+/i, '')
        .replace(/\s+in\s+the\s+background$/i, '')
        .trim();

      if (topic) {
        const formattedPrompt = this.formatDeepResearchPrompt(topic);
        const capitalizedTopic = topic.charAt(0).toUpperCase() + topic.slice(1);
        return {
          matched: true,
          type: 'deep_research',
          app: targetApp,
          topic: capitalizedTopic,
          prompt: formattedPrompt,
          name: `Deep Research: ${capitalizedTopic}`,
          reply: `Starting detailed research on ${capitalizedTopic} in ${targetApp} in the background! I'll notify you as soon as the research is completed.`,
        };
      }
    }

    // ─── 0. Autonomous App Opening & Prompt Writing ──────────────────────
    // E.g.: "open claude and write a prompt about quantum computing"
    //       "open claude and write a prompt in the claude about something"
    //       "open claude and ask it how photosynthesis works"
    //       "open chatgpt and write a prompt for software engineer resume"
    //       "open notepad and type shopping list: milk, eggs, bread"
    const openAndTypeMatch = clean.match(/^(?:open|launch|start)\s+([a-zA-Z0-9_\s]+?)\s+(?:and\s+)?(?:ask(?:\s+it)?|write(?:\s+a\s+prompt(?:\s+in\s+(?:the\s+)?[a-zA-Z0-9_\s]+)?)?|type(?:\s+a\s+prompt)?|prompt(?:\s+it)?)\s+(?:about|to|for|that|:|in)?\s*(.+)$/i);
    if (openAndTypeMatch) {
      const targetApp = openAndTypeMatch[1].trim();
      const rawPrompt = openAndTypeMatch[2].trim();
      if (targetApp && rawPrompt) {
        const appObj = this.findInstalledApp(targetApp) || { name: targetApp };
        const appName = appObj.name || targetApp;
        const formattedPrompt = this.formatAIPrompt(rawPrompt, appName);
        return {
          matched: true,
          type: 'open_and_type',
          app: appName,
          prompt: formattedPrompt,
          name: `${appName}: "${formattedPrompt.slice(0, 32)}..."`,
          reply: `Opening ${appName} and writing your prompt!`,
        };
      }
    }

    // Direct "write a prompt in claude about..." or "ask claude ..."
    const askAppMatch = clean.match(/^(?:write\s+a\s+prompt\s+in|ask)\s+([a-zA-Z0-9_\s]+?)\s+(?:about|to|:)?\s*(.+)$/i);
    if (askAppMatch) {
      const targetApp = askAppMatch[1].trim();
      const rawPrompt = askAppMatch[2].trim();
      if (targetApp && rawPrompt) {
        const appObj = this.findInstalledApp(targetApp) || { name: targetApp };
        const appName = appObj.name || targetApp;
        const formattedPrompt = this.formatAIPrompt(rawPrompt, appName);
        return {
          matched: true,
          type: 'open_and_type',
          app: appName,
          prompt: formattedPrompt,
          name: `${appName}: "${formattedPrompt.slice(0, 32)}..."`,
          reply: `Opening ${appName} and typing your prompt!`,
        };
      }
    }

    // Direct dictation / typing into active window: e.g. "type this: hello everyone", "dictate please review my document"
    const directTypeMatch = clean.match(/^(?:type\s+this|dictate|type)\s*:\s*(.+)$/i) ||
      clean.match(/^(?:type\s+this|dictate)\s+(.+)$/i) ||
      clean.match(/^type\s+into\s+(?:active\s+window|document|screen)\s*:?\s*(.+)$/i);
    if (directTypeMatch) {
      const textToType = directTypeMatch[1].trim();
      return {
        matched: true,
        type: 'type_text',
        text: textToType,
        name: `Type: "${textToType.slice(0, 30)}..."`,
        reply: `Typing into your active window!`,
      };
    }

    // ─── 1. Media & Song Playback Across Browsers and Apps ────────────────
    // A. Play in specific browser: "play honeypie in brave", "play honeypie on comet", "play honeypie from youtube in brave"
    const inBrowserPlayMatch = clean.match(/^play\s+(.+?)(?:\s+(?:from|on|in)\s+youtube)?\s+(?:in|on)\s+(brave|comet|chrome|edge)$/i) ||
      clean.match(/^play\s+(.+?)\s+(?:in|on)\s+(brave|comet|chrome|edge)$/i);
    if (inBrowserPlayMatch) {
      const songTitle = inBrowserPlayMatch[1].replace(/\s+(?:from|on|in)\s+youtube$/i, '').trim();
      const browser = inBrowserPlayMatch[2].trim().toLowerCase();
      const app = this.installedApps.get(browser);
      return {
        matched: true,
        type: 'youtube_play_browser',
        query: songTitle,
        browser,
        exePath: app?.exePath,
        name: `${songTitle} in ${app?.name || browser}`,
        reply: `Playing ${songTitle} on YouTube in ${app?.name || browser}!`,
      };
    }

    // B. Spotify playback: "play honeypie on spotify", "play honeypie in spotify"
    const spotifyMatch = clean.match(/^play\s+(.+?)\s+(?:on|in|from)\s+spotify$/i) ||
      clean.match(/^play\s+spotify(?:\s+(?:for\s+)?(.+))?$/i);
    if (spotifyMatch) {
      const songTitle = (spotifyMatch[1] || 'music').trim();
      return {
        matched: true,
        type: 'spotify_play',
        query: songTitle,
        name: `Spotify: "${songTitle}"`,
        reply: `Playing ${songTitle} on Spotify!`,
      };
    }

    // C. Apple Music playback: "play blinding lights on apple music", "play music from apple music", "play apple music"
    const appleMatch = clean.match(/^play\s+(.+?)\s+(?:on|in|from)\s+apple\s*music$/i) ||
      clean.match(/^play\s+apple\s*music(?:\s+(?:for\s+)?(.+))?$/i);
    if (appleMatch) {
      const songTitle = (appleMatch[1] || 'music').trim();
      return {
        matched: true,
        type: 'apple_music_play',
        query: songTitle,
        name: `Apple Music: "${songTitle}"`,
        reply: `Playing ${songTitle} on Apple Music!`,
      };
    }

    // Apple TV Watch/Play: "play apple tv", "watch apple tv", "watch on apple tv", "open apple tv"
    if (/^(?:watch|play)\s+(?:on\s+)?(?:apple\s*tv(?:\s+plus|\s*\+)?|tv)$/i.test(clean) || clean === 'watch apple tv' || clean === 'play apple tv') {
      return {
        matched: true,
        type: 'apple_app',
        name: 'Apple TV',
        appId: 'AppleInc.AppleTVWin_nzyj5cx40ttqa!App',
        protocol: 'videos:',
        reply: 'Opening Apple TV for you!',
      };
    }

    // Direct Apple Music / Apple TV Open commands: e.g. "open apple music", "open apple tv", "open music", "open tv"
    if (/^(?:open|launch|start)\s+(?:apple\s*music|music(?:\s+app)?)$/i.test(clean) || clean === 'apple music' || clean === 'open music') {
      return {
        matched: true,
        type: 'apple_app',
        name: 'Apple Music',
        appId: 'AppleInc.AppleMusicWin_nzyj5cx40ttqa!App',
        protocol: 'music:',
        reply: 'Opening Apple Music for you!',
      };
    }

    if (/^(?:open|launch|start)\s+(?:apple\s*tv(?:\s+plus|\s*\+)?|tv)$/i.test(clean) || clean === 'apple tv' || clean === 'apple tv plus') {
      return {
        matched: true,
        type: 'apple_app',
        name: 'Apple TV',
        appId: 'AppleInc.AppleTVWin_nzyj5cx40ttqa!App',
        protocol: 'videos:',
        reply: 'Opening Apple TV for you!',
      };
    }

    // D. YouTube Direct Video/Song Playback: "play honeypie from youtube", "play honeypie on youtube"
    const ytPlayMatch = clean.match(/^play\s+(.+?)\s+(?:from|on|in)\s+youtube$/i) ||
      clean.match(/^play\s+youtube\s+(?:for\s+)?(.+)$/i);
    if (ytPlayMatch && ytPlayMatch[1]) {
      const songTitle = ytPlayMatch[1].trim();
      return {
        matched: true,
        type: 'youtube_play',
        query: songTitle,
        name: `YouTube: "${songTitle}"`,
        reply: `Playing ${songTitle} on YouTube for you!`,
      };
    }

    // E. General "play <song>": default to YouTube autoplay
    const generalPlayMatch = clean.match(/^play\s+(.+)$/i);
    if (generalPlayMatch && generalPlayMatch[1]) {
      const target = generalPlayMatch[1].trim();
      const isSystemCommand = /^(music|song|track|audio|something|it|media)$/i.test(target);
      if (!isSystemCommand) {
        return {
          matched: true,
          type: 'youtube_play',
          query: target,
          name: `YouTube: "${target}"`,
          reply: `Playing ${target} on YouTube for you!`,
        };
      }
    }

    // F. Media controls
    if (/^(play music|resume music|pause music|stop music|toggle music)$/i.test(clean)) {
      return { matched: true, type: 'media_key', key: 'play_pause', name: 'Media Play/Pause', reply: 'Toggled music playback!' };
    }
    if (/^(next song|next track|skip song|skip track)$/i.test(clean)) {
      return { matched: true, type: 'media_key', key: 'next_track', name: 'Next Track', reply: 'Skipped to the next track!' };
    }
    if (/^(previous song|previous track|prev song)$/i.test(clean)) {
      return { matched: true, type: 'media_key', key: 'prev_track', name: 'Previous Track', reply: 'Returning to previous track!' };
    }
    if (/^(volume up|louder|increase volume)$/i.test(clean)) {
      return { matched: true, type: 'media_key', key: 'volume_up', name: 'Volume Up', reply: 'Turned up volume!' };
    }
    if (/^(volume down|quieter|lower volume)$/i.test(clean)) {
      return { matched: true, type: 'media_key', key: 'volume_down', name: 'Volume Down', reply: 'Lowered volume!' };
    }

    // ─── 2. Search Across Browsers & AI Engines (Brave, Comet, Chrome, Edge) ─
    // e.g. "search react tutorials in brave", "search quantum computing on brave"
    // e.g. "search latest news in comet", "ask comet how far is Mars", "ask perplexity <query>"
    // e.g. "open brave and search nodejs", "open comet and ask who is alan turing"
    const inBrowserSearchMatch =
      clean.match(/^(?:search|look up|find|google)\s+(.+?)\s+(?:in|on)\s+(brave|comet|chrome|edge)$/i) ||
      clean.match(/^(?:ask|search)\s+(comet|brave|perplexity)\s+(?:for\s+|about\s+|to\s+)?(.+)$/i) ||
      clean.match(/^(?:open\s+(?:brave|comet|chrome|edge)\s+(?:and\s+)?(?:search|look up|google|find|ask)\s+(.+))$/i);

    if (inBrowserSearchMatch) {
      let queryTerm, browser;
      if (['brave', 'comet', 'perplexity'].includes(inBrowserSearchMatch[1]?.toLowerCase())) {
        browser = inBrowserSearchMatch[1].toLowerCase();
        queryTerm = inBrowserSearchMatch[2]?.trim();
      } else if (clean.startsWith('open')) {
        const bMatch = clean.match(/^open\s+(brave|comet|chrome|edge)/i);
        browser = bMatch ? bMatch[1].toLowerCase() : 'chrome';
        queryTerm = inBrowserSearchMatch[1]?.trim();
      } else {
        queryTerm = inBrowserSearchMatch[1]?.trim();
        browser = inBrowserSearchMatch[2]?.trim().toLowerCase();
      }

      if (browser === 'perplexity') browser = 'comet';
      const app = this.installedApps.get(browser);
      let searchUrl;
      if (browser === 'brave') searchUrl = `https://search.brave.com/search?q=${encodeURIComponent(queryTerm)}`;
      else if (browser === 'comet') searchUrl = `https://www.perplexity.ai/search?q=${encodeURIComponent(queryTerm)}`;
      else if (browser === 'edge') searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(queryTerm)}`;
      else searchUrl = `https://www.google.com/search?q=${encodeURIComponent(queryTerm)}`;

      return {
        matched: true,
        type: 'open_in_browser',
        browser,
        url: searchUrl,
        exePath: app?.exePath,
        appId: app?.appId,
        name: `${app?.name || browser} Search: "${queryTerm}"`,
        reply: `Searching for ${queryTerm} in ${app?.name || browser}!`,
      };
    }

    // ─── 3. Multi-Browser User Profile Routing ─────────────────────────────
    // e.g. "open brave from work account", "open calendar in brave from work profile"
    // e.g. "open chrome from student account", "open calendar in chrome from student account"
    const browserMention = clean.match(/\b(brave|comet|chrome|edge)\b/i);
    const targetBrowserHint = browserMention ? browserMention[1].toLowerCase() : null;

    if (clean.includes('profile') || clean.includes('account') || (targetBrowserHint && (clean.includes('student') || clean.includes('work') || clean.includes('personal')))) {
      const matchedProfile = this.matchBrowserProfile(clean, targetBrowserHint);
      if (matchedProfile) {
        // Check if there is a website / URL requested as well: e.g. "open calendar in brave from work account"
        const webTarget = this.extractWebTarget(clean);
        const browserApp = this.installedApps.get(matchedProfile.browser);

        if (webTarget) {
          return {
            matched: true,
            type: 'browser_profile_url',
            browser: matchedProfile.browser,
            exePath: browserApp?.exePath || `${matchedProfile.browser}.exe`,
            profileDir: matchedProfile.dir,
            profileName: matchedProfile.name,
            url: webTarget.url,
            name: `${webTarget.name} (${browserApp?.name || matchedProfile.browser} - ${matchedProfile.name})`,
            reply: `Opening ${webTarget.name} in ${browserApp?.name || matchedProfile.browser} with your ${matchedProfile.name} profile!`,
          };
        }

        if (clean.includes('profile') || clean.includes('account') || clean.includes('open') || clean.includes('launch') || clean.includes('start')) {
          return {
            matched: true,
            type: 'browser_profile',
            browser: matchedProfile.browser,
            exePath: browserApp?.exePath || `${matchedProfile.browser}.exe`,
            profileDir: matchedProfile.dir,
            profileName: matchedProfile.name,
            name: `${browserApp?.name || matchedProfile.browser} (${matchedProfile.name})`,
            reply: `Opening ${browserApp?.name || matchedProfile.browser} with your ${matchedProfile.name} profile!`,
          };
        }
      }
    }

    // ─── 4. In-Browser Website Opening (e.g. "open youtube in brave", "open calendar in comet") ───
    const inBrowserMatch = clean.match(/^open\s+(.+?)\s+(?:in|on)\s+(brave|comet|chrome|edge)$/i);
    if (inBrowserMatch) {
      const site = inBrowserMatch[1].trim();
      const browser = inBrowserMatch[2].trim().toLowerCase();
      const app = this.installedApps.get(browser);
      const targetUrl = this.resolveUrl(site);

      return {
        matched: true,
        type: 'open_in_browser',
        browser,
        url: targetUrl,
        exePath: app?.exePath,
        appId: app?.appId,
        name: `${site} in ${app?.name || browser}`,
        reply: `Opening ${site} in ${app?.name || browser}!`,
      };
    }

    // ─── 5. General Searches ──────────────────────────────────────────────
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

    // ─── 6. Antigravity IDE vs Antigravity Priority ───────────────────────
    if (clean.includes('antigravity') && (clean.includes('ide') || clean.includes('code') || clean.includes('editor'))) {
      const app = this.installedApps.get('antigravity ide');
      if (app) {
        return {
          matched: true,
          type: app.type,
          target: app.target,
          appId: app.appId,
          name: app.name,
          reply: `Opening Antigravity IDE for you!`,
        };
      }
    }

    // ─── 7. Direct App / Website / Folder Launching (App-First Priority) ─
    let appOrUrl = clean
      .replace(/^(open|launch|start|run|bring up|switch to|show|go to)\s+/i, '')
      .trim();

    // Check if an installed application matches on this PC (Highest Priority)
    const matchedApp = this.findInstalledApp(appOrUrl) || this.findInstalledApp(clean);
    if (matchedApp) {
      return {
        matched: true,
        type: matchedApp.type,
        target: matchedApp.target,
        appId: matchedApp.appId,
        protocol: matchedApp.protocol,
        exePath: matchedApp.exePath,
        name: matchedApp.name,
        fallback: matchedApp.fallback,
        reply: `Opening ${matchedApp.name} for you!`,
      };
    }

    // Check known folders
    if (this.folders[appOrUrl]) {
      return {
        matched: true,
        type: 'open_folder',
        target: this.folders[appOrUrl],
        name: appOrUrl,
        reply: `Opening your ${appOrUrl} folder!`,
      };
    }

    // Check direct websites (e.g. "open youtube", "open github")
    if (this.websites[appOrUrl]) {
      const item = this.websites[appOrUrl];
      return {
        matched: true,
        type: 'open_url',
        target: item.url,
        name: item.name,
        reply: `Opening ${item.name}!`,
      };
    }

    // Check explicit domains (e.g., "open github.com", "open claude.ai")
    if (/^[a-zA-Z0-9-]+\.(?:com|org|io|net|edu|ai|gov|dev|app|co|me)(?:\/.*)?$/i.test(appOrUrl)) {
      return {
        matched: true,
        type: 'open_url',
        target: 'https://' + appOrUrl,
        name: appOrUrl,
        reply: `Opening ${appOrUrl} for you!`,
      };
    }

    // Check general web target (e.g. "open calendar")
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

  /**
   * Fast resolution of YouTube search to direct video playback URL
   */
  async fetchYouTubeVideoId(query) {
    return new Promise((resolve) => {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      const req = https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 2000,
      }, (res) => {
        let data = '';
        res.on('data', chunk => {
          data += chunk;
          const match = data.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
          if (match) {
            res.destroy();
            resolve(match[1]);
          }
        });
        res.on('end', () => {
          const match = data.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
          resolve(match ? match[1] : null);
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    });
  }

  /**
   * Sends Windows virtual media keys instantly using PowerShell WScript Shell.
   */
  sendMediaKey(keyType) {
    const keyMap = {
      'play_pause': 179,
      'next_track': 176,
      'prev_track': 177,
      'volume_up': 175,
      'volume_down': 174,
      'volume_mute': 173,
    };
    const code = keyMap[keyType] || 179;
    exec(`powershell -WindowStyle Hidden -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]${code})"`, { shell: 'cmd.exe' });
  }

  /**
   * Dedicated Bulletproof Foreground Launcher for Apple Music & Apple TV.
   * Direct protocol activation (music: / videos:) or WindowsApps Execution Alias
   * guarantees the foreground visual UI window opens cleanly without headless ghost processes.
   */
  launchAppleApp(appName = 'Apple Music', protocol) {
    const isTv = /tv/i.test(appName) || protocol === 'videos:';
    const uri = isTv ? 'videos:' : 'music:';
    const altExe = isTv ? 'AppleTV.exe' : 'AppleMusic.exe';

    // 1. Electron native shell.openExternal (activates protocol directly in Windows Shell)
    if (shell && typeof shell.openExternal === 'function') {
      shell.openExternal(uri).catch(() => {
        exec(`start ${uri}`, { shell: 'cmd.exe' }, (err) => {
          if (err) exec(`start ${altExe}`, { shell: 'cmd.exe' });
        });
      });
    } else {
      exec(`start ${uri}`, { shell: 'cmd.exe' }, (err) => {
        if (err) exec(`start ${altExe}`, { shell: 'cmd.exe' });
      });
    }
  }

  /**
   * Intelligently format a comprehensive prompt for AI apps (Claude, ChatGPT, etc.)
   * or clean up a requested text to type.
   */
  formatAIPrompt(rawTopic, appName = 'Claude') {
    if (!rawTopic) {
      return 'Write a comprehensive and engaging overview of this topic with key insights.';
    }
    let topic = rawTopic.trim()
      .replace(/^(?:a\s+prompt\s+(?:in\s+(?:the\s+)?[a-zA-Z0-9_\s]+\s+)?about|prompt\s+about|about|to\s+write\s+a\s+prompt\s+about|to|write\s+a\s+prompt\s+about)\s+/i, '')
      .replace(/\s+in\s+(?:the\s+)?(claude|chatgpt|notepad|word)$/i, '')
      .trim();

    // If it's already a full question or actionable command (e.g. "how does photosynthesis work")
    if (/^(how|why|what|when|where|who|explain|write|create|generate|summarize|compare|help|give|draft)\b/i.test(topic)) {
      return topic.charAt(0).toUpperCase() + topic.slice(1);
    }

    // Generic "something"
    if (topic.toLowerCase() === 'something') {
      return 'Write an engaging, insightful guide exploring how artificial intelligence and modern technology are shaping everyday productivity, learning, and creativity.';
    }

    // AI apps (Claude / ChatGPT) benefit from structured, high-value prompt formatting
    if (/claude|chatgpt|perplexity|ai/i.test(appName)) {
      return `Write a comprehensive, insightful guide about ${topic}. Explain the fundamental concepts, key principles, and 3 practical real-world applications in simple, engaging terms.`;
    }

    return topic.charAt(0).toUpperCase() + topic.slice(1);
  }

  /**
   * Intelligently format a rigorous deep-dive research prompt for Claude or ChatGPT.
   */
  formatDeepResearchPrompt(rawTopic) {
    const topic = (rawTopic || '').trim();
    return `Please conduct an exhaustive, deep-dive research report on: ${topic}.

Structure your research report thoroughly with:
1. Executive Summary & Core Breakthroughs
2. Fundamental Principles, Math/Physics/Architecture & Mechanisms
3. State of the Art, Key Players & Industry Impact
4. Current Bottlenecks, Engineering Challenges & Recent Advancements (2025-2026)
5. Strategic Outlook & Critical Milestones (Next 3-5 Years)

Provide rigorous, deep, analytical explanations with concrete details and data.`;
  }

  /**
   * Executes deep research automation in the specified desktop app (Claude / ChatGPT).
   */
  async executeDeepResearch(topic, targetApp = 'Claude') {
    const prompt = this.formatDeepResearchPrompt(topic);
    console.log(`[ActionService] 🔬 Executing deep research in ${targetApp} for "${topic}"...`);
    return await this.openAppAndType(targetApp, prompt, true);
  }

  /**
   * Types or pastes text into the currently active foreground window on Windows.
   * Handles Unicode, emojis, newlines, and quotes without escaping errors.
   */
  async typeTextIntoActiveWindow(text, pressEnter = false) {
    if (!text) return false;
    return new Promise((resolve) => {
      try {
        // 1. Instant native clipboard set via Electron C++ API (0 ms)
        if (clipboard && typeof clipboard.writeText === 'function') {
          clipboard.writeText(text);
        } else {
          // Ultra-fast Windows native clip.exe fallback (~60ms) when outside Electron
          try {
            execSync('clip', { input: text, timeout: 1000 });
          } catch (_) {
            const escaped = text.replace(/"/g, '`"');
            execSync(`powershell -NoProfile -Command "Set-Clipboard -Value '${escaped}'"`, { timeout: 2000 });
          }
        }

        // 2. Ultra-fast simulated paste (Ctrl+V) via lightweight WScript (takes ~100ms vs 500ms PowerShell)
        const vbsPath = path.join(os.tmpdir(), `pointy_paste_${Date.now()}_${Math.floor(Math.random() * 1000)}.vbs`);
        const vbsContent = [
          'Set w = CreateObject("WScript.Shell")',
          'w.SendKeys "^v"',
          pressEnter ? 'WScript.Sleep 150\r\nw.SendKeys "{ENTER}"' : '',
        ].filter(Boolean).join('\r\n');

        fs.writeFile(vbsPath, vbsContent, (wErr) => {
          if (wErr) {
            console.warn('[ActionService] Error creating paste script:', wErr.message);
            return resolve(false);
          }
          exec(`wscript "${vbsPath}"`, (execErr) => {
            try { fs.unlinkSync(vbsPath); } catch (_) {}
            if (execErr) {
              console.warn('[ActionService] Error simulating paste:', execErr.message);
              resolve(false);
            } else {
              console.log(`[ActionService] ⚡ Instantly pasted text into active window (${text.length} chars)`);
              resolve(true);
            }
          });
        });
      } catch (e) {
        console.warn('[ActionService] Exception in typeTextIntoActiveWindow:', e.message);
        resolve(false);
      }
    });
  }

  /**
   * Launches or activates an app, waits for it to become the active foreground window,
   * and automatically types/pastes the prompt or text into its input box!
   */
  async openAppAndType(appName, text, pressEnter = false) {
    if (!appName || !text) return false;

    console.log(`[ActionService] 🚀 Opening ${appName} and typing prompt: "${text.slice(0, 40)}..."`);

    // 1. Resolve and launch the app
    const app = this.findInstalledApp(appName) || { name: appName, target: appName };
    const appTitle = app.name || appName;

    if (app.type === 'windows_app_id' && app.appId) {
      exec(`start "" "shell:AppsFolder\\${app.appId}"`, { shell: 'cmd.exe' });
    } else if (app.type === 'launch_app' && app.target) {
      exec(`start "" "${app.target}"`, { shell: 'cmd.exe' });
    } else if (app.type === 'system_uri' && app.target) {
      exec(`start ${app.target}`, { shell: 'cmd.exe' });
    } else if (/claude/i.test(appName)) {
      exec(`start "" "shell:AppsFolder\\Claude_pzs8sxrjxfjjc!Claude"`, { shell: 'cmd.exe' });
    } else if (/chatgpt/i.test(appName)) {
      exec(`start "" "shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App"`, { shell: 'cmd.exe' });
    } else if (/notepad/i.test(appName)) {
      exec(`start notepad.exe`, { shell: 'cmd.exe' });
    } else {
      exec(`start "" "${app.target || appName}"`, { shell: 'cmd.exe' });
    }

    // 2. Wait for the window to appear and be ready (~1200ms)
    await new Promise(r => setTimeout(r, 1200));

    // 3. Bring to front and type into the input area!
    return new Promise((resolve) => {
      const escaped = text.replace(/"/g, '`"');
      const searchTitle = /claude/i.test(appName) ? 'Claude' :
                          /chatgpt/i.test(appName) ? 'ChatGPT' :
                          /notepad/i.test(appName) ? 'Notepad' :
                          appTitle;

      const psScript = `
$w = New-Object -ComObject WScript.Shell
$w.AppActivate("${searchTitle}")
Start-Sleep -Milliseconds 450
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Clipboard]::SetText("${escaped}")
$w.SendKeys('^v')
if (${pressEnter ? 1 : 0} -eq 1) {
  Start-Sleep -Milliseconds 250
  $w.SendKeys('{ENTER}')
}
`;
      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
      exec(`powershell -NoProfile -EncodedCommand ${encoded}`, (err) => {
        if (err) {
          console.warn('[ActionService] Error typing into app:', err.message);
          resolve(false);
        } else {
          console.log(`[ActionService] ✅ Successfully typed prompt into ${appName}!`);
          resolve(true);
        }
      });
    });
  }

  /**
   * Executes the resolved action on the desktop.
   *
   * @param {object} action - Resolved action details
   * @returns {Promise<boolean>}
   */
  async execute(action) {
    if (!action) return false;
    const { type, target, name, profileDir, url, appTarget, key, appId, exePath, browser } = action;
    console.log(`[ActionService] 🚀 Executing action: type=${type}, name="${name || ''}"`);

    try {
      // 00. Background Detailed Deep Research Execution
      if (type === 'deep_research') {
        const appName = action.app || 'Claude';
        const topic = action.topic || action.target || '';
        await this.executeDeepResearch(topic, appName);
        return true;
      }

      // 0a. Open App & Type Prompt / Write in App (Claude, ChatGPT, Notepad, etc.)
      if (type === 'open_and_type') {
        const appName = action.app || action.target || action.name || 'Claude';
        const prompt = action.prompt || action.text || '';
        const pressEnter = !!action.pressEnter;
        await this.openAppAndType(appName, prompt, pressEnter);
        return true;
      }

      // 0b. Direct Type / Dictate into active foreground window
      if (type === 'type_text' || type === 'dictate') {
        const text = action.text || action.prompt || '';
        const pressEnter = !!action.pressEnter;
        await this.typeTextIntoActiveWindow(text, pressEnter);
        return true;
      }

      // 0. Direct YouTube song/video playback in specific browser
      if (type === 'youtube_play_browser') {
        const videoId = await this.fetchYouTubeVideoId(action.query);
        let finalUrl;
        if (videoId) {
          finalUrl = `https://www.youtube.com/watch?v=${videoId}&autoplay=1`;
        } else {
          finalUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(action.query)}`;
        }

        if (exePath && fs.existsSync(exePath)) {
          exec(`start "" "${exePath}" "${finalUrl}"`, { shell: 'cmd.exe' });
        } else {
          exec(`start "" "${browser}" "${finalUrl}"`, { shell: 'cmd.exe' }, (err) => {
            if (err) shell.openExternal(finalUrl);
          });
        }
        return true;
      }

      // 1. Direct YouTube song/video playback in default browser
      if (type === 'youtube_play') {
        const videoId = await this.fetchYouTubeVideoId(action.query);
        let finalUrl;
        if (videoId) {
          finalUrl = `https://www.youtube.com/watch?v=${videoId}&autoplay=1`;
        } else {
          finalUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(action.query)}`;
        }
        await shell.openExternal(finalUrl);
        return true;
      }

      // 2. Spotify Playback with Search & Play
      if (type === 'spotify_play') {
        exec(`start spotify:search:${encodeURIComponent(action.query)}`, { shell: 'cmd.exe' });
        setTimeout(() => {
          this.sendMediaKey('play_pause');
        }, 1200);
        return true;
      }

      // 3. Apple Music Playback with Direct Protocol & Foreground Activation
      if (type === 'apple_music_play' || type === 'media_play_app') {
        this.launchAppleApp('Apple Music', 'music:');
        setTimeout(() => {
          this.sendMediaKey('play_pause');
        }, 1200);
        return true;
      }

      // 3b. Apple Music & Apple TV Direct Window Launch
      if (type === 'apple_app') {
        this.launchAppleApp(action.name || action.target || 'Apple Music', action.protocol);
        return true;
      }

      // 4. In-Browser Website / Search Opening (Brave, Comet, Chrome, Edge)
      if (type === 'open_in_browser') {
        if (exePath && fs.existsSync(exePath)) {
          exec(`start "" "${exePath}" "${url}"`, { shell: 'cmd.exe' });
        } else {
          exec(`start "" "${browser}" "${url}"`, { shell: 'cmd.exe' }, (err) => {
            if (err) shell.openExternal(url);
          });
        }
        return true;
      }

      // 5. Browser with specific profile (e.g. Brave, Chrome, Comet)
      if (type === 'browser_profile') {
        const executable = exePath || `${browser}.exe`;
        const cmd = `start "" "${executable}" --profile-directory="${profileDir}"`;
        exec(cmd, { shell: 'cmd.exe' });
        return true;
      }

      // 6. Browser with specific profile & URL (e.g. Calendar in Student or Work profile)
      if (type === 'browser_profile_url') {
        const executable = exePath || `${browser}.exe`;
        const cmd = `start "" "${executable}" --profile-directory="${profileDir}" "${url}"`;
        exec(cmd, { shell: 'cmd.exe' });
        return true;
      }

      // 7. Universal Windows App via StartApps AppID
      if (type === 'windows_app_id') {
        if (appId && /AppleMusic/i.test(appId)) {
          this.launchAppleApp('Apple Music', 'music:');
          return true;
        }
        if (appId && /AppleTV/i.test(appId)) {
          this.launchAppleApp('Apple TV', 'videos:');
          return true;
        }
        // Direct CMD start brings Windows Store / Appx GUI window to foreground reliably without hiding
        const cmd = `start "" "shell:AppsFolder\\${appId}"`;
        exec(cmd, { shell: 'cmd.exe' }, (err) => {
          if (err) {
            const psCmd = `powershell -NoProfile -Command "Start-Process 'shell:AppsFolder\\${appId}'"`;
            exec(psCmd, { shell: 'cmd.exe' }, (psErr) => {
              if (psErr && (target || exePath)) {
                exec(`start "" "${target || exePath}"`, { shell: 'cmd.exe' });
              }
            });
          }
        });
        return true;
      }

      // 8. Backwards compatibility: Chrome specific profile
      if (type === 'chrome_profile') {
        const cmd = `start "" "chrome.exe" --profile-directory="${profileDir}"`;
        exec(cmd, { shell: 'cmd.exe' });
        return true;
      }

      // 9. Backwards compatibility: Chrome specific profile & URL
      if (type === 'chrome_profile_url') {
        const cmd = `start "" "chrome.exe" --profile-directory="${profileDir}" "${url}"`;
        exec(cmd, { shell: 'cmd.exe' });
        return true;
      }

      // 10. Direct media keys (Play/Pause, Next Track, Volume)
      if (type === 'media_key') {
        this.sendMediaKey(key);
        return true;
      }

      // 11. Direct application executable
      if (type === 'launch_app') {
        exec(`start "" "${target}"`, { shell: 'cmd.exe' }, (err) => {
          if (err && action.fallback) {
            exec(`start "" "${action.fallback}"`, { shell: 'cmd.exe' });
          }
        });
        return true;
      }

      // 12. Windows Store / Packaged App invocation
      if (type === 'windows_app') {
        if (/Apple\s*Music/i.test(target || name)) {
          this.launchAppleApp('Apple Music', 'music:');
          return true;
        }
        if (/Apple\s*TV/i.test(target || name)) {
          this.launchAppleApp('Apple TV', 'videos:');
          return true;
        }
        if (target && target.startsWith('shell:')) {
          exec(`start "" "${target}"`, { shell: 'cmd.exe' });
        } else if (target) {
          exec(`start "" "shell:AppsFolder\\${target}"`, { shell: 'cmd.exe' }, () => {
            exec(`start "" "${target}"`, { shell: 'cmd.exe' });
          });
        }
        return true;
      }

      // 13. Start Menu Shortcut (.lnk)
      if (type === 'launch_shortcut') {
        exec(`start "" "${target}"`, { shell: 'cmd.exe' });
        return true;
      }

      // 14. Open URL in default browser
      if (type === 'open_url') {
        let finalUrl = target;
        if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
          finalUrl = 'https://' + finalUrl;
        }
        await shell.openExternal(finalUrl);
        return true;
      }

      // 15. Open Folder in Explorer
      if (type === 'open_folder') {
        await shell.openPath(target);
        return true;
      }

      // 16. System Protocol URI (e.g. ms-settings:, spotify:)
      if (type === 'system_uri') {
        await shell.openExternal(target).catch(() => {
          exec(`start ${target}`, { shell: 'cmd.exe' });
        });
        return true;
      }

      // Fallback
      if (target) {
        if (target.startsWith('http') || target.includes('://')) {
          await shell.openExternal(target);
        } else {
          exec(`start "" "${target}"`, { shell: 'cmd.exe' });
        }
        return true;
      }

      return false;

    } catch (err) {
      console.error('[ActionService] Error executing action:', err.message);
      return false;
    }
  }
}

module.exports = { ActionService };

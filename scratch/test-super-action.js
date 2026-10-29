const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class SuperActionService {
  constructor() {
    this.installedApps = new Map();
    this.browserProfiles = { chrome: [], brave: [], comet: [], edge: [] };
    this.websites = {};
    this.folders = {};
    this.init();
  }

  init() {
    this.loadBrowserProfiles();
    this.scanInstalledApps();
    this.initWebsitesAndFolders();
  }

  loadBrowserProfiles() {
    this.browserProfiles = { chrome: [], brave: [], comet: [], edge: [] };
    const browserPaths = {
      chrome: path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'Local State'),
      brave: path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware', 'Brave-Browser', 'User Data', 'Local State'),
      comet: path.join(process.env.LOCALAPPDATA || '', 'Perplexity', 'Comet', 'User Data', 'Local State'),
      edge: path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data', 'Local State'),
    };

    for (const [browserKey, statePath] of Object.entries(browserPaths)) {
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
        } catch (e) {
          console.warn(`[SuperActionService] Notice reading ${browserKey} profiles:`, e.message);
        }
      }
    }
  }

  scanInstalledApps() {
    this.installedApps = new Map();

    // 1. Browsers
    const braveExe = path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe');
    this.installedApps.set('brave', {
      name: 'Brave',
      browserKey: 'brave',
      appId: 'Brave.FH2PZEZMTZJQAQJMHT3SSFWNEU',
      target: braveExe,
      exePath: braveExe,
      type: fs.existsSync(braveExe) ? 'launch_app' : 'windows_app_id',
    });
    this.installedApps.set('brave browser', this.installedApps.get('brave'));

    const cometExe = path.join(process.env.LOCALAPPDATA || '', 'Perplexity', 'Comet', 'Application', 'comet.exe');
    this.installedApps.set('comet', {
      name: 'Comet',
      browserKey: 'comet',
      appId: 'Comet.FH2PZEZMTZJQAQJMHT3SSFWNEU',
      target: cometExe,
      exePath: cometExe,
      type: fs.existsSync(cometExe) ? 'launch_app' : 'windows_app_id',
    });
    this.installedApps.set('comet browser', this.installedApps.get('comet'));

    this.installedApps.set('chrome', { name: 'Google Chrome', browserKey: 'chrome', target: 'chrome.exe', exePath: 'chrome.exe', type: 'launch_app' });
    this.installedApps.set('google chrome', this.installedApps.get('chrome'));
    this.installedApps.set('edge', { name: 'Microsoft Edge', browserKey: 'edge', target: 'msedge.exe', exePath: 'msedge.exe', type: 'launch_app' });
    this.installedApps.set('microsoft edge', this.installedApps.get('edge'));

    // 2. Antigravity IDE vs Antigravity
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

    // 3. Native Packaged Apps
    this.installedApps.set('claude', { name: 'Claude', appId: 'Claude_pzs8sxrjxfjjc!Claude', type: 'windows_app_id' });
    this.installedApps.set('claude app', this.installedApps.get('claude'));
    this.installedApps.set('claude desktop', this.installedApps.get('claude'));

    this.installedApps.set('apple music', { name: 'Apple Music', appId: 'AppleInc.AppleMusicWin_nzyj5cx40ttqa!App', type: 'windows_app_id' });
    this.installedApps.set('apple tv', { name: 'Apple TV', appId: 'AppleInc.AppleTVWin_nzyj5cx40ttqa!App', type: 'windows_app_id' });
    this.installedApps.set('spotify', { name: 'Spotify', appId: 'SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify', target: 'spotify:', type: 'system_uri' });

    // 4. StartApps Dynamic Scan
    try {
      const raw = execSync('powershell -NoProfile -Command "Get-StartApps | ForEach-Object { $_.Name + \' ||| \' + $_.AppID }"', { encoding: 'utf8' });
      const lines = raw.split(/\r?\n/).filter(l => l.includes('|||'));
      for (const line of lines) {
        const [name, appId] = line.split('|||').map(s => s.trim());
        if (!name || !appId) continue;
        const lower = name.toLowerCase();
        if (lower.includes('uninstall') || lower.includes('setup') || lower.includes('helper') || lower.includes('manual')) continue;

        const item = { name, appId, type: 'windows_app_id' };
        if (!this.installedApps.has(lower)) {
          this.installedApps.set(lower, item);
        }

        // Clean versions & suffixes
        // e.g. "AutoCAD 2026 - English" -> "autocad 2026", "autocad"
        // e.g. "VLC media player" -> "vlc"
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

        // Custom short names
        if (lower.includes('vlc media player')) this.installedApps.set('vlc', item);
        if (lower.includes('cinema 4d')) this.installedApps.set('c4d', item);
        if (lower.includes('zoom workplace')) this.installedApps.set('zoom', item);
        if (lower.includes('notepad++')) this.installedApps.set('notepad plus plus', item);
      }
    } catch (_) {}

    // Developer shortcuts
    this.installedApps.set('vscode', { name: 'Visual Studio Code', target: 'code', type: 'launch_app' });
    this.installedApps.set('vs code', { name: 'Visual Studio Code', target: 'code', type: 'launch_app' });
    this.installedApps.set('code', { name: 'Visual Studio Code', target: 'code', type: 'launch_app' });
    this.installedApps.set('notepad', { name: 'Notepad', target: 'notepad.exe', type: 'launch_app' });
    this.installedApps.set('calc', { name: 'Calculator', target: 'calc.exe', type: 'launch_app' });
    this.installedApps.set('calculator', { name: 'Calculator', target: 'calc.exe', type: 'launch_app' });
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
      'meet': { url: 'https://meet.google.com', name: 'Google Meet' },
      'reddit': { url: 'https://www.reddit.com', name: 'Reddit' },
      'twitter': { url: 'https://x.com', name: 'X (Twitter)' },
      'x': { url: 'https://x.com', name: 'X' },
      'netflix': { url: 'https://www.netflix.com', name: 'Netflix' },
      'amazon': { url: 'https://www.amazon.com', name: 'Amazon' },
    };

    this.folders = {
      'downloads': path.join(os.homedir(), 'Downloads'),
      'my downloads': path.join(os.homedir(), 'Downloads'),
      'documents': path.join(os.homedir(), 'Documents'),
      'my documents': path.join(os.homedir(), 'Documents'),
      'pictures': path.join(os.homedir(), 'Pictures'),
      'photos': path.join(os.homedir(), 'Pictures'),
      'desktop': path.join(os.homedir(), 'Desktop'),
      'music': path.join(os.homedir(), 'Music'),
      'videos': path.join(os.homedir(), 'Videos'),
      'home': os.homedir(),
    };
  }

  resolveUrl(target) {
    const t = target.toLowerCase().trim();
    if (this.websites[t]) return this.websites[t].url;
    if (t === 'calendar' || t === 'calender') return 'https://calendar.google.com';
    if (t === 'classroom') return 'https://classroom.google.com';
    if (t === 'gmail' || t === 'email' || t === 'mail') return 'https://mail.google.com';
    if (t === 'drive') return 'https://drive.google.com';
    if (t === 'meet') return 'https://meet.google.com';
    if (t.startsWith('http://') || t.startsWith('https://')) return target;
    if (/^[a-zA-Z0-9-]+\.(?:com|org|io|net|edu|ai|gov|dev|app|co|me)(?:\/.*)?$/i.test(t)) {
      return 'https://' + target;
    }
    return 'https://' + target;
  }

  matchBrowserProfile(query, preferredBrowser = null) {
    const q = query.toLowerCase();

    // Determine target browser
    let targetBrowser = preferredBrowser;
    if (!targetBrowser) {
      if (q.includes('brave')) targetBrowser = 'brave';
      else if (q.includes('comet')) targetBrowser = 'comet';
      else if (q.includes('edge')) targetBrowser = 'edge';
      else if (q.includes('chrome')) targetBrowser = 'chrome';
      else targetBrowser = 'chrome'; // default
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
        if (pName.includes('work') || pEmail.includes('shopzy') || p.dir === 'Default' && targetBrowser === 'brave') {
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

    // Default profile if browser specified
    if (profiles.length > 0 && (q.includes('profile') || q.includes('account'))) {
      return { ...profiles[0], browser: targetBrowser };
    }

    return null;
  }

  match(query) {
    if (!query || typeof query !== 'string') return null;
    let clean = query.trim().toLowerCase()
      .replace(/^(can you please|could you please|please|pointy|can you|could you|hey pointy)\s+/i, '')
      .replace(/\s+(please|for me|right now)$/i, '')
      .trim();

    // ─── 1. In-Browser / App Specific Media Playback ───────────────────────
    // e.g. "play honeypie in brave", "play honeypie on comet", "play honeypie from youtube in brave"
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

    // Spotify playback: "play honeypie on spotify", "play honeypie in spotify"
    const spotifyMatch = clean.match(/^play\s+(.+?)\s+(?:on|in|from)\s+spotify$/i);
    if (spotifyMatch) {
      const songTitle = spotifyMatch[1].trim();
      return {
        matched: true,
        type: 'spotify_play',
        query: songTitle,
        name: `Spotify: "${songTitle}"`,
        reply: `Playing ${songTitle} on Spotify!`,
      };
    }

    // Apple Music playback: "play blinding lights on apple music", "play music from apple music"
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

    // YouTube playback default: "play honeypie from youtube", "play honeypie"
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

    if (/^(play music|resume music|pause music|stop music|toggle music)$/i.test(clean)) {
      return { matched: true, type: 'media_key', key: 'play_pause', name: 'Media Play/Pause', reply: 'Toggled music playback!' };
    }

    // ─── 2. Search in Specific Browsers (Brave, Comet, Chrome, Edge) ──────
    // e.g. "search react tutorials in brave", "search quantum computing on brave"
    // e.g. "search latest news in comet", "ask comet how far is Mars"
    const inBrowserSearchMatch = clean.match(/^(?:search|look up|find|google)\s+(.+?)\s+(?:in|on)\s+(brave|comet|chrome|edge)$/i) ||
                                 clean.match(/^(?:ask|search)\s+(comet|brave|perplexity)\s+(?:for\s+|about\s+|to\s+)?(.+)$/i);
    if (inBrowserSearchMatch) {
      let queryTerm, browser;
      if (['brave', 'comet', 'perplexity'].includes(inBrowserSearchMatch[1].toLowerCase())) {
        browser = inBrowserSearchMatch[1].toLowerCase();
        queryTerm = inBrowserSearchMatch[2].trim();
      } else {
        queryTerm = inBrowserSearchMatch[1].trim();
        browser = inBrowserSearchMatch[2].trim().toLowerCase();
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

    // ─── 3. Specific Browser Profile Routing ──────────────────────────────
    // e.g. "open brave from work account", "open calendar in brave from work profile", "open chrome from student account"
    const browserMention = clean.match(/\b(brave|comet|chrome|edge)\b/i);
    const targetBrowserHint = browserMention ? browserMention[1].toLowerCase() : null;

    if (clean.includes('profile') || clean.includes('account') || targetBrowserHint) {
      const matchedProfile = this.matchBrowserProfile(clean, targetBrowserHint);
      if (matchedProfile) {
        // Check if there is a website / URL requested as well: e.g. "open calendar in brave from work account"
        const webPattern = clean
          .replace(/\b(brave|comet|chrome|edge|browser)\b/gi, '')
          .replace(/\b(from|in|with|using)\b/gi, '')
          .replace(/\b(profile|account|student|work|personal)\b/gi, '')
          .trim();
        
        let webUrl = null;
        let webName = null;
        if (/calendar|calender/i.test(clean)) { webUrl = 'https://calendar.google.com'; webName = 'Google Calendar'; }
        else if (/gmail|email|mail/i.test(clean)) { webUrl = 'https://mail.google.com'; webName = 'Gmail'; }
        else if (/classroom/i.test(clean)) { webUrl = 'https://classroom.google.com'; webName = 'Google Classroom'; }
        else if (/drive/i.test(clean)) { webUrl = 'https://drive.google.com'; webName = 'Google Drive'; }
        else if (/github/i.test(clean)) { webUrl = 'https://www.github.com'; webName = 'GitHub'; }
        else if (/youtube/i.test(clean)) { webUrl = 'https://www.youtube.com'; webName = 'YouTube'; }

        const browserApp = this.installedApps.get(matchedProfile.browser);
        if (webUrl) {
          return {
            matched: true,
            type: 'browser_profile_url',
            browser: matchedProfile.browser,
            exePath: browserApp?.exePath || `${matchedProfile.browser}.exe`,
            profileDir: matchedProfile.dir,
            profileName: matchedProfile.name,
            url: webUrl,
            name: `${webName} (${browserApp?.name || matchedProfile.browser} - ${matchedProfile.name})`,
            reply: `Opening ${webName} in ${browserApp?.name || matchedProfile.browser} with your ${matchedProfile.name} profile!`,
          };
        }

        if (clean.includes('profile') || clean.includes('account') || clean.includes('open') || clean.includes('launch')) {
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

    // ─── 4. Open Website in Specific Browser (e.g. "open youtube in brave", "open calendar in comet") ───
    const inBrowserMatch = clean.match(/^open\s+(.+?)\s+in\s+(brave|comet|chrome|edge)$/i);
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

    // ─── 7. Direct App / Website Launching ────────────────────────────────
    let appOrUrl = clean
      .replace(/^(open|launch|start|run|bring up|switch to|show|go to)\s+/i, '')
      .trim();

    if (this.installedApps.has(appOrUrl)) {
      const app = this.installedApps.get(appOrUrl);
      return {
        matched: true,
        type: app.type,
        target: app.target,
        appId: app.appId,
        exePath: app.exePath,
        name: app.name,
        reply: `Opening ${app.name} for you!`,
      };
    }

    // Fuzzy matching
    for (const [key, app] of this.installedApps.entries()) {
      if (appOrUrl === key || key.startsWith(appOrUrl + ' ') || appOrUrl.startsWith(key + ' ') || key === appOrUrl) {
        return {
          matched: true,
          type: app.type,
          target: app.target,
          appId: app.appId,
          exePath: app.exePath,
          name: app.name,
          reply: `Opening ${app.name} for you!`,
        };
      }
    }

    // Check direct websites & web targets
    if (this.websites[appOrUrl]) {
      const item = this.websites[appOrUrl];
      return { matched: true, type: 'open_url', target: item.url, name: item.name, reply: `Opening ${item.name}!` };
    }

    return null;
  }
}

const os = require('os');
const tester = new SuperActionService();

const testQueries = [
  // 1. Brave & Comet launching
  "open brave",
  "open comet",
  "open brave browser",
  "open comet browser",

  // 2. In-browser websites
  "open youtube in brave",
  "open youtube in comet",
  "open github in brave",
  "open github in comet",
  "open calendar in brave",
  "open calendar in comet",

  // 3. Media playback in specific browser or apps
  "play honeypie in brave",
  "play honeypie in comet",
  "play honeypie from youtube in brave",
  "play honeypie on spotify",
  "play blinding lights on apple music",

  // 4. Searches in Brave & Comet
  "search react tutorials in brave",
  "search latest news in comet",
  "ask comet how far is Mars",
  "search quantum computing on brave",

  // 5. Profiles in Brave & Comet
  "open brave from work account",
  "open brave from student account",
  "open calendar in brave from work profile",
  "open chrome from student account",

  // 6. Other installed apps
  "open capcut",
  "open notion",
  "open perplexity",
  "open lm studio",
  "open kimi",
  "open vlc",
  "open whatsapp",
  "open autocad",
  "open visual studio code",
  "open antigravity ide",
  "open antigravity"
];

console.log('Testing ALL queries against SuperActionService:');
let passed = 0;
for (const q of testQueries) {
  const res = tester.match(q);
  if (res && res.matched) {
    passed++;
    console.log(`✅ "${q}" -> type: ${res.type}, name: "${res.name}", target/url: "${res.target || res.url || res.appId || res.query || ''}"`);
  } else {
    console.log(`❌ "${q}" -> NOT MATCHED`);
  }
}
console.log(`\nResult: ${passed} / ${testQueries.length} passed!`);

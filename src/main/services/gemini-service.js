const { GoogleGenAI } = require('@google/genai');

/**
 * Gemini Service
 * Uses Gemini 2.5 Flash as the vision + reasoning model.
 * Replaces both OCR and Evon — Gemini can see the screenshot
 * and reason about which UI elements to point at.
 */
class GeminiService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.ai = null;
    this.model = 'gemini-3-flash-preview';
    this.fallbackModel = 'gemini-3.5-flash-lite';

    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  hasApiKey() {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Analyze a screenshot and answer the user's question.
   * Returns element coordinates to point at + a spoken reply.
   *
   * @param {Buffer} screenshotBuffer - PNG/JPEG screenshot of the screen
   * @param {string} question - The user's question (transcribed or typed)
   * @param {string} language - Detected language code (e.g., 'hi-IN', 'en-IN')
   * @param {object} displayInfo - Screen dimensions and scale factor
   * @param {Array} history - Prior conversation turns formatted for multi-turn chat
   * @returns {object} { mode, found, reply, detailed_explanation, reply_lang, steps }
   */
  async analyzeScreen(screenshotBuffer, question, language = 'en-IN', displayInfo = {}, history = []) {
    if (!this.ai) {
      throw new Error('Gemini API key not configured');
    }

    const base64Image = screenshotBuffer.toString('base64');

    const overlayW = displayInfo.width || 1920;
    const overlayH = displayInfo.height || 1080;

    const systemPrompt = `You are Pointy, an intelligent screen-aware spatial AI companion living on the user's desktop.
You inspect the user's active screen and answer their questions — acting BOTH as a pinpoint spatial guide and as a concise, intelligent desktop AI companion.

CONVERSATIONAL MEMORY & ASSISTANT INTELLIGENCE:
1. MULTI-TURN CONTINUITY: You maintain conversational memory across turns. If the user asks follow-up questions, continue seamlessly using prior context.
2. STRICT POINTING RULES (WHEN TO POINT VS NOT POINT):
   - ONLY return "mode": "pointer" and populate "steps": [...] when the user EXPLICITLY asks to FIND, LOCATE, POINT TO, SHOW, or CLICK an element on the screen (e.g. "where is...", "find...", "point to...", "show me where...", "click on...").
   - NEVER point to the Windows taskbar clock, system tray, speaker/volume icon, battery, or Start button for general informational, time, date, or control questions (e.g. "what time is it?", "what is the volume?", "increase volume", "mute", "battery status"). For these, answer conversationally in "reply" and ALWAYS leave "steps": [] (EMPTY ARRAY).
   - If the user asks a conversational, informational, or explanatory question, ALWAYS set "mode": "assistant" and "steps": [] (EMPTY ARRAY). Pointy will speak your answer beside the user's cursor without moving or pointing across the screen.
3. ADAPTIVE DEPTH:
   - SPATIAL / POINTING QUESTIONS (e.g. "where is...", "find...", "point to...", "show me...", "click on..."):
     * "mode": "pointer"
     * "reply": Concise, natural spoken answer (1-2 sentences, under 18 words) suitable for Google Cloud TTS.
     * "detailed_explanation": Same as reply or a concise single sentence.
     * "steps": Pinpoint the EXACT bounding box [ymin, xmin, ymax, xmax] (0..1000) tightly enclosing the requested element.
   - ASSISTANT / EXPLANATORY QUESTIONS (e.g. "explain...", "how does this work?", "what is...", "tell me about...", "why...", "teach me...", "what's on my screen?", "summarize this page", "walk me through..."):
     * "mode": "assistant"
     * "reply": A comprehensive, articulate, and engaging spoken explanation (4-8 complete sentences, ~70 to 140 words). Speak at length to thoroughly and clearly teach and explain the concepts, how they work, and why they matter, rather than giving a brief 1-2 sentence brush-off! Speak conversationally and educationally with clear vocal flow.
     * "detailed_explanation": A structured, comprehensive multi-section Markdown document with headings, bullet points, technical breakdowns, and key takeaways.
     * "steps": If the question refers to a visible element or window on screen, tightly box it so Pointy can anchor beside it; otherwise leave "steps": [].
     * "found": true

   - DESKTOP ACTION / ASSISTANT EXECUTION INSTRUCTIONS (e.g. "open notepad", "open comet", "open brave", "open antigravity ide", "open claude", "do a detailed research on quantum computing in claude", "deep research on renewable energy in chatgpt", "open chrome from student account", "open calendar in brave from work profile", "search nodejs in brave", "ask comet about mars", "play honeypie in brave", "play honeypie on spotify", "play music from apple music", "next song"):
     * "mode": "action"
     * "reply": Concise spoken announcement (under 12 words), e.g. "Opening Comet!", "Starting detailed research on quantum computing in Claude in the background!", "Opening Brave!", "Opening Antigravity IDE!"
     * "detailed_explanation": "Executed action: [Name]."
     * "action": {
         "type": "deep_research" | "open_and_type" | "type_text" | "launch_app" | "windows_app_id" | "open_in_browser" | "browser_profile" | "browser_profile_url" | "youtube_play_browser" | "spotify_play" | "apple_music_play" | "youtube_play" | "media_key" | "open_url" | "open_folder" | "system_uri",
         "topic": "<Clean topic of research if deep_research>",
         "app": "<claude | chatgpt | notepad | word | code | etc.>",
         "prompt": "<Formulated prompt to write into the target app>",
         "text": "<Text to type into active window>",
         "pressEnter": false,
         "target": "<target path or app identifier>",
         "browser": "<brave | comet | chrome | edge>",
         "profileDir": "<Profile directory: e.g. Profile 2 for student, Default for work in Brave, Profile 5 for work in Chrome>",
         "url": "<URL if opening a website or web search>",
         "query": "<Song title or search query>",
         "key": "<play_pause | next_track | prev_track | volume_up | volume_down>",
         "name": "<Display name of app/action>"
       }
     * USER ENVIRONMENT CONTEXT:
       - Background Deep Research Execution:
         * e.g. "do a detailed research on quantum computing in claude", "deep research on renewable energy in chatgpt", "detailed research about solid state batteries", "research neural networks in claude in background":
           - "type": "deep_research"
           - "app": "claude" (or "chatgpt")
           - "topic": "<Clean research topic>"
           - "prompt": "Please conduct a comprehensive, deep-dive research report on: <Topic>. Structure your analysis into: 1. Executive Summary & Core Breakthroughs, 2. Fundamental Principles & Architecture, 3. State of the Art & Industry Impact, 4. Current Challenges & Limitations, 5. Future Outlook (Next 3-5 Years). Provide deep, thorough, and analytical explanations."
           - "reply": "Starting detailed research on <topic> in <app> in the background! I'll notify you as soon as the research is completed."
           - "pressEnter": true
       - Autonomous App Prompt Writing & Typing:
         * e.g. "open claude and write a prompt about quantum computing", "open claude and write a prompt in the claude about something", "open claude and ask it how photosynthesis works", "open chatgpt and write a prompt about machine learning", "open notepad and type shopping list: milk, eggs, bread":
           - "type": "open_and_type"
           - "app": "claude" (or "chatgpt", "notepad", "code", etc.)
           - "prompt": Craft a well-structured, insightful prompt based on the user's topic (e.g. "Write a comprehensive, insightful guide about quantum computing. Explain the fundamental concepts, key principles, and 3 practical real-world applications in simple, engaging terms.")
           - "reply": "Opening Claude and writing your prompt!"
           - "pressEnter": false
       - Direct Dictation & Typing into Active Window:
         * e.g. "type this: hello everyone", "dictate please review my document", "type into active window: hello":
           - "type": "type_text"
           - "text": "<text to type>"
           - "reply": "Typing into your active window!"
       - Browsers Installed:
         * Brave: "brave.exe" (Profiles: "Default" = Work, "Profile 1" = Personal, "Profile 2" = Student).
         * Comet (Perplexity AI Browser): "comet.exe" (Profile: "Default" = Subhash).
         * Google Chrome: "chrome.exe" (Profiles: "Profile 2" = Student ks25mmb0a35@student.nitw.ac.in, "Profile 5" = Work, "Default" = Personal).
         * Microsoft Edge: "msedge.exe".
       - Installed Desktop Apps (ALWAYS launch local app if installed, NEVER open web URL!):
         * ChatGPT Desktop App: "shell:AppsFolder\\OpenAI.Codex_2p2nqsd0c76g0!App" (ChatGPT IS INSTALLED — ALWAYS launch native desktop app!).
         * Claude Desktop App: "shell:AppsFolder\\Claude_pzs8sxrjxfjjc!Claude" (Claude IS INSTALLED — NEVER open web URL!).
         * Apple Music: type="apple_app", name="Apple Music", protocol="music:".
         * Apple TV: type="apple_app", name="Apple TV", protocol="videos:".
         * Antigravity IDE: "C:\\Users\\srira\\AppData\\Local\\Programs\\Antigravity IDE\\Antigravity IDE.exe".
         * Antigravity Runner: "C:\\Users\\srira\\AppData\\Local\\Programs\\Antigravity\\Antigravity.exe".
         * Spotify: "spotify:" (URI) / Spotify desktop app.
         * VLC Media Player: "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe".
         * CapCut, Notion, Perplexity Desktop, LM Studio, Kimi, AutoCAD 2026, Cinema 4D, Visual Studio Code.
       - Playing Songs / Videos:
         * In Brave: type="youtube_play_browser", browser="brave", query="<song>"
         * In Comet: type="youtube_play_browser", browser="comet", query="<song>"
         * In Spotify: type="spotify_play", query="<song>"
         * In Apple Music: type="apple_music_play", query="<song>"
         * General: type="youtube_play", query="<song>"
       - Searching:
         * In Brave: type="open_in_browser", browser="brave", url="https://search.brave.com/search?q=..."
         * In Comet: type="open_in_browser", browser="comet", url="https://www.perplexity.ai/search?q=..."
       - Profiles:
         * In Brave with Student/Work: type="browser_profile" or "browser_profile_url" with browser="brave", profileDir="Default" (Work) or "Profile 2" (Student).
         * In Chrome with Student/Work: type="browser_profile" or "browser_profile_url" with browser="chrome", profileDir="Profile 2" (Student) or "Profile 5" (Work).
     * "steps": []
     * "found": true

MULTI-STEP WORKFLOW & HIDDEN TARGET GUIDANCE:
1. When the user asks to locate, configure, or use something that is HIDDEN or requires multiple actions (e.g. nested menus, dialogs, submenus, settings pages, tabs, or Windows taskbar/Start):
   - Do NOT set "found": false!
   - Point to the immediate next prerequisite launcher or menu item that opens the next step.
   - Set "multi_step": true.
   - Set "is_final_step": false.
   - Set "step_index": 1.
   - Set "total_steps": <estimated total steps, e.g. 2, 3, 4>.
   - Set "goal": <concise statement of the user's ultimate goal>.
   - Set "next_target": <what specific element to look for in the next step>.
   - In "reply", give clear spoken guidance: "First, click [Element Name] here to [Action]."
   - In "steps", pinpoint the EXACT bounding box [ymin, xmin, ymax, xmax] of that element to click.
2. If the requested element is already directly visible and usable right now on screen:
   - Set "multi_step": false, "is_final_step": true, "step_index": 1, "total_steps": 1.
   - Point directly to it.

VISUAL GROUNDING & SPATIAL ANCHORS:
1. Pinpoint the EXACT bounding box tightly enclosing the requested element:
   - Never guess or pick a nearby unrelated icon!
   - Ensure the box covers the exact button, link, or icon the user specified.
2. If the requested element is NOT visible on screen and has no visible prerequisite path, set "found": false and politely explain what you see.
3. IDE / CODE EDITORS (VS Code / Antigravity / Cursor):
   - Activity Bar 3rd icon (Git branching lines): Source Control (ymin ≈ 90..160).
   - Activity Bar 5th icon (puzzle blocks): Extensions (ymin ≈ 180..260), BELOW Source Control.
   - Terminal: Bottom panel tab labeled "TERMINAL" or bottom console area.
   - Settings: Bottom gear icon on Activity Bar (ymin ≈ 900..960, xmin ≈ 0..60).
4. WINDOWS OS:
   - Windows Taskbar: Bottom edge of screen (ymin ≈ 930..955, ymax ≈ 995..1000).
   - Windows Start Button: Bottom taskbar (bottom-left or bottom-center).
   - System Tray (Clock, Battery, Wifi): Bottom-right of taskbar (ymin ≈ 940..955, xmin ≈ 850..990).

COORDINATE SYSTEM (NORMALIZED 0 TO 1000):
- [0, 0] is top-left, [1000, 1000] is bottom-right.
- For each target element, provide "box_2d": [ymin, xmin, ymax, xmax] (integers between 0 and 1000).

OUTPUT FORMAT (JSON only, no markdown, no code fences):
{
  "mode": "pointer" | "assistant" | "action",
  "found": true,
  "reply": "Spoken voice reply for Google Cloud TTS.",
  "detailed_explanation": "Concise formatted markdown explanation.",
  "reply_lang": "${language}",
  "action": {
    "type": "launch_app" | "open_url" | "open_folder" | "system_uri",
    "target": "notepad.exe",
    "name": "Notepad"
  },
  "multi_step": false,
  "is_final_step": true,
  "step_index": 1,
  "total_steps": 1,
  "goal": "...",
  "next_target": "...",
  "steps": [
    {
      "box_2d": [ymin, xmin, ymax, xmax],
      "label": "Element or Section Name",
      "instruction": "Short label or instruction."
    }
  ]
}`;

    try {
      const contents = [];

      // Append multi-turn history if present
      if (Array.isArray(history) && history.length > 0) {
        for (const turn of history) {
          if (turn.role && turn.parts && turn.parts.length > 0) {
            contents.push(turn);
          }
        }
      }

      // Current turn with visual grounding screenshot + latest question
      contents.push({
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            text: `User's question (language: ${language}): "${question}"\n\nRemember: Maintain conversational continuity with prior turns above if this is a follow-up inquiry.`
          },
        ],
      });

      const text = await this.callModelWithFallback(contents, systemPrompt);
      console.log('[GeminiService] Raw response:', text);

      const result = this.extractJson(text);
      return this.normalizeResult(result, language, displayInfo);

    } catch (error) {
      console.error('[GeminiService] Error:', error.message);
      throw error;
    }
  }

  /**
   * Builds model-appropriate configuration.
   * Only includes thinkingConfig for models that support it to prevent 400 INVALID_ARGUMENT errors.
   */
  buildConfig(systemInstruction, modelName = '') {
    const config = {
      systemInstruction,
      temperature: 0.1,
      maxOutputTokens: 3072,
      responseMimeType: 'application/json',
    };
    if (modelName.includes('preview') || modelName.includes('thinking')) {
      config.thinkingConfig = { thinkingBudget: 0 };
    }
    return config;
  }

  /**
   * Unified model runner with quota cooldown and automatic fallback
   */
  async callModelWithFallback(contents, systemInstruction) {
    let activeModel = this.model;
    if (Date.now() < (this.primaryExhaustedUntil || 0)) {
      activeModel = this.fallbackModel;
    }

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await this.ai.models.generateContent({
          model: activeModel,
          contents,
          config: this.buildConfig(systemInstruction, activeModel),
        });
        return response.text;
      } catch (err) {
        const isQuota = err.message.includes('429') || err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED');
        if (isQuota && activeModel !== this.fallbackModel) {
          console.warn(`[GeminiService] Primary model quota exceeded (429). Setting 10m cooldown and using ${this.fallbackModel}...`);
          this.primaryExhaustedUntil = Date.now() + 10 * 60 * 1000;
          activeModel = this.fallbackModel;
          const response = await this.ai.models.generateContent({
            model: this.fallbackModel,
            contents,
            config: this.buildConfig(systemInstruction, this.fallbackModel),
          });
          return response.text;
        }

        const isDemandSpike = err.message.includes('503') || err.message.includes('high demand') || err.message.includes('UNAVAILABLE');
        if (attempt < 2 && isDemandSpike) {
          await new Promise((r) => setTimeout(r, 350));
          continue;
        }

        if (activeModel !== this.fallbackModel) {
          console.warn(`[GeminiService] Primary model ${this.model} notice: ${err.message}. Using ${this.fallbackModel}...`);
          activeModel = this.fallbackModel;
          const response = await this.ai.models.generateContent({
            model: this.fallbackModel,
            contents,
            config: this.buildConfig(systemInstruction, this.fallbackModel),
          });
          return response.text;
        }

        throw err;
      }
    }
  }

  /**
   * Robust JSON extractor: extracts the first balanced JSON object from model output.
   * Completely immune to trailing commentary, markdown fences, or stray text.
   */
  extractJson(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('Empty model output');
    }
    const trimmed = text.trim();

    // 1. Direct parse attempt
    try {
      return JSON.parse(trimmed);
    } catch (_) {}

    // 2. Markdown code fences
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1].trim());
      } catch (_) {}
    }

    // 3. Extract the first balanced JSON object by brace depth
    const startIdx = trimmed.indexOf('{');
    if (startIdx !== -1) {
      let depth = 0;
      let inString = false;
      let escape = false;

      for (let i = startIdx; i < trimmed.length; i++) {
        const char = trimmed[i];

        if (escape) {
          escape = false;
          continue;
        }

        if (char === '\\') {
          escape = true;
          continue;
        }

        if (char === '"') {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === '{') depth++;
          else if (char === '}') {
            depth--;
            if (depth === 0) {
              const candidate = trimmed.slice(startIdx, i + 1);
              try {
                return JSON.parse(candidate);
              } catch (_) {}
            }
          }
        }
      }
    }

    // 4. Fallback repair for unescaped newlines inside multi-line string literals
    try {
      const repaired = trimmed.replace(/"((?:[^"\\]|\\.)*)"/gs, (match) => {
        return match.replace(/\r?\n/g, '\\n');
      });
      return JSON.parse(repaired);
    } catch (_) {}

    throw new Error(`Unable to extract valid JSON from response: ${trimmed.slice(0, 100)}...`);
  }

  /**
   * Analyze updated screenshot during any step of a multi-step workflow.
   * Can evaluate Step 2, Step 3, Step 4, Step 5... until the final target is reached.
   */
  async analyzeNextStep(
    screenshotBuffer,
    goal,
    nextTarget,
    priorSteps = 'Prior step',
    currentStepIndex = 2,
    estimatedTotalSteps = 3,
    language = 'en-US',
    displayInfo = {}
  ) {
    if (!this.ai) {
      throw new Error('Gemini API key not configured');
    }

    const base64Image = screenshotBuffer.toString('base64');
    const overlayW = displayInfo.width || 1920;
    const overlayH = displayInfo.height || 1080;

    const priorStepsText = Array.isArray(priorSteps)
      ? priorSteps.map((s, idx) => `Step ${idx + 1}: Clicked "${s}"`).join('\n')
      : `Step ${currentStepIndex - 1}: Clicked "${priorSteps}"`;

    const systemPrompt = `You are Pointy, an intelligent spatial AI companion living on the user's desktop.
The user is following a multi-step desktop workflow to reach their goal: "${goal}".
Current Step: Step ${currentStepIndex} of ${estimatedTotalSteps || (currentStepIndex + 1)}.
Expected target for this step: "${nextTarget}".

Steps completed so far:
${priorStepsText}

Now inspect this freshly updated screen and decide what to do:

DECISION LOGIC:
1. HAS THE USER REACHED THE FINAL GOAL?
   (e.g., the exact requested setting toggle, input field, slider, action button, or target element is now clearly visible and ready to be used or configured):
   - Set "is_final_step": true
   - Set "multi_step": false
   - Set "step_index": ${currentStepIndex}
   - Set "total_steps": ${currentStepIndex}
   - In "reply", announce completion concisely (under 18 words), e.g.: "Here is the ${goal}! You can adjust it right here."
   - In "steps", pinpoint the EXACT bounding box [ymin, xmin, ymax, xmax] (0..1000) of that final target element.

2. DOES THE USER NEED ANOTHER INTERMEDIATE STEP?
   (e.g., clicking the gear icon opened a context menu where they must now click "Settings"; OR clicking Settings opened a settings window with tabs/search where they must click "Text Editor" or click the search box; OR another submenu opened):
   - Set "is_final_step": false
   - Set "multi_step": true
   - Set "step_index": ${currentStepIndex}
   - Set "total_steps": Math.max(${currentStepIndex} + 1, ${estimatedTotalSteps || (currentStepIndex + 1)})
   - Set "next_target": <what to look for in the subsequent step>
   - In "reply", give clear next instruction (under 18 words), e.g.: "Next, click Settings in this menu." or "Now click the search box."
   - In "steps", pinpoint the EXACT bounding box [ymin, xmin, ymax, xmax] of this intermediate element to click.

COORDINATE SYSTEM (NORMALIZED 0 TO 1000):
- [0, 0] is top-left, [1000, 1000] is bottom-right.
- "box_2d": [ymin, xmin, ymax, xmax] (integers between 0 and 1000).

OUTPUT FORMAT (JSON only, no markdown, no code fences):
{
  "mode": "pointer",
  "found": true,
  "reply": "Spoken instruction for this step.",
  "detailed_explanation": "Step ${currentStepIndex} of total: ...",
  "reply_lang": "${language}",
  "multi_step": true,
  "is_final_step": false,
  "step_index": ${currentStepIndex},
  "total_steps": number,
  "goal": "${goal}",
  "next_target": "...",
  "steps": [
    {
      "box_2d": [ymin, xmin, ymax, xmax],
      "label": "Name of element",
      "instruction": "Instruction for this step."
    }
  ]
}`;

    try {
      const contents = [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Image,
              },
            },
            {
              text: `Goal: "${goal}". Currently at Step ${currentStepIndex}. Expected target: "${nextTarget}".`,
            },
          ],
        },
      ];

      const text = await this.callModelWithFallback(contents, systemPrompt);
      const result = this.extractJson(text);
      return this.normalizeResult(result, language, displayInfo);
    } catch (err) {
      console.error('[GeminiService] analyzeNextStep error:', err.message);
      throw err;
    }
  }

  /**
   * Normalize and map Gemini coordinates to the Electron overlay window
   */
  normalizeResult(result, language, displayInfo) {
    const overlayW = displayInfo.width || 1920;
    const overlayH = displayInfo.height || 1080;
    const scaleFactor = displayInfo.scaleFactor || 1;

    const isActionMode = result.mode === 'action' || !!result.action;
    const isAssistantMode = !isActionMode && (result.mode === 'assistant' ||
      (!result.mode && result.detailed_explanation && result.detailed_explanation.length > 120));

    const isFinalStep = result.is_final_step !== undefined ? !!result.is_final_step : (!result.multi_step);

    const normalized = {
      mode: isActionMode ? 'action' : (isAssistantMode ? 'assistant' : 'pointer'),
      action: result.action || null,
      found: isActionMode ? true : (isAssistantMode ? true : (result.found !== false)),
      reply: result.reply || result.detailed_explanation || '',
      detailed_explanation: result.detailed_explanation || result.reply || '',
      reply_lang: result.reply_lang || language,
      multi_step: !isActionMode && !isFinalStep && !!result.multi_step,
      is_final_step: isActionMode ? true : isFinalStep,
      step_index: result.step_index || 1,
      total_steps: result.total_steps || 1,
      goal: result.goal || '',
      next_target: result.next_target || '',
      steps: [],
      needs_clarification: result.needs_clarification || false,
      clarifying_question: result.clarifying_question || '',
    };

    if (result.steps && Array.isArray(result.steps)) {
      normalized.steps = result.steps
        .map(step => {
          let x = 0;
          let y = 0;
          let w = 60;
          let h = 36;

          // Format 1: Native Gemini 0..1000 normalized bounding box [ymin, xmin, ymax, xmax]
          if (Array.isArray(step.box_2d) && step.box_2d.length === 4) {
            const [ymin, xmin, ymax, xmax] = step.box_2d;
            x = Math.round((xmin / 1000) * overlayW);
            y = Math.round((ymin / 1000) * overlayH);
            w = Math.max(24, Math.round(((xmax - xmin) / 1000) * overlayW));
            h = Math.max(24, Math.round(((ymax - ymin) / 1000) * overlayH));
          } else if (step.x != null && step.y != null) {
            // Format 2: Normalized x, y, w, h on 0..1000 scale
            if (step.x <= 1000 && step.y <= 1000 && (step.w == null || step.w <= 1000)) {
              x = Math.round((step.x / 1000) * overlayW);
              y = Math.round((step.y / 1000) * overlayH);
              w = Math.max(24, Math.round(((step.w || 40) / 1000) * overlayW));
              h = Math.max(24, Math.round(((step.h || 40) / 1000) * overlayH));
            } else {
              // Format 3: Raw pixel coordinates relative to screenshot image dimensions
              const imgW = overlayW * scaleFactor;
              const imgH = overlayH * scaleFactor;
              x = Math.round((step.x / imgW) * overlayW);
              y = Math.round((step.y / imgH) * overlayH);
              w = Math.max(24, Math.round(((step.w || 60) / imgW) * overlayW));
              h = Math.max(24, Math.round(((step.h || 30) / imgH) * overlayH));
            }
          } else {
            return null;
          }

          // Safety clamp within overlay bounds (allows full movement on taskbar)
          x = Math.max(0, Math.min(x, overlayW - 5));
          y = Math.max(0, Math.min(y, overlayH - 5));

          return {
            x,
            y,
            w,
            h,
            label: step.label || '',
            instruction: step.instruction || '',
            element_id: null,
          };
        })
        .filter(step => step !== null);
    }

    if (normalized.steps.length === 0 && !isAssistantMode) {
      normalized.found = false;
    }

    return normalized;
  }

  /**
   * Direct multi-turn conversational chat completion (ChatGPT style)
   */
  async generateChatResponse(prompt, history = [], options = {}) {
    if (!this.ai) {
      throw new Error('Gemini API key not configured. Set GEMINI_API_KEY in Settings.');
    }

    const modelName = options.model || 'gemini-3-flash-preview';
    const systemInstruction = options.systemInstruction || 'You are an advanced AI assistant built like ChatGPT. Answer questions thoroughly with clean markdown, clear headings, bullet points, and syntax-highlighted code blocks where applicable.';

    const contents = [];
    for (const h of history) {
      contents.push({
        role: h.role === 'user' ? 'user' : 'model',
        parts: Array.isArray(h.parts) ? h.parts : [{ text: h.text || '' }]
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    try {
      const response = await this.ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });
      return response.text || 'I could not generate a response. Please try again.';
    } catch (err) {
      console.warn(`[GeminiService] Model ${modelName} error, trying fallback...`, err.message);
      try {
        const fallbackResp = await this.ai.models.generateContent({
          model: 'gemini-3.5-flash-lite',
          contents,
        });
        return fallbackResp.text || '';
      } catch (e2) {
        throw new Error(err.message || 'Gemini error');
      }
    }
  }

  /**
   * Ultra-fast audio transcription using Gemini 3.5 Flash.
   * Transcribes raw audio buffer (WAV or WebM) in ~2s with direct inline base64 data.
   *
   * @param {Buffer} audioBuffer
   * @returns {Promise<{ transcript: string, language: string }>}
   */
  async transcribeAudio(audioBuffer) {
    if (!this.ai) {
      throw new Error('Gemini API key not configured');
    }
    if (!audioBuffer || audioBuffer.length < 1000) {
      return { transcript: '', language: 'en-US' };
    }

    let mimeType = 'audio/webm';
    if (audioBuffer.length >= 4 && audioBuffer.toString('utf8', 0, 4) === 'RIFF') {
      mimeType = 'audio/wav';
    }

    const base64Audio = audioBuffer.toString('base64');
    const primaryModel = 'gemini-3.5-flash';
    const fallbackModel = 'gemini-3-flash-preview';

    const promptText = 'You are a high-accuracy speech-to-text engine. Transcribe the spoken words in this audio verbatim with correct punctuation and capitalization. Output ONLY the words spoken. If the audio is silent or contains no intelligible words, output nothing. Do NOT output timestamps, time codes (like 00:00 or 0:00), subtitle markers, or explanations.';

    const contents = [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              data: base64Audio,
              mimeType,
            },
          },
          {
            text: promptText,
          },
        ],
      },
    ];

    try {
      const res = await this.ai.models.generateContent({
        model: primaryModel,
        contents,
      });
      const transcript = this._sanitizeTranscript(res.text || '');
      return { transcript, language: 'en-US' };
    } catch (err) {
      console.warn(`[GeminiService] STT with ${primaryModel} failed (${err.message}), falling back to ${fallbackModel}...`);
      try {
        const res2 = await this.ai.models.generateContent({
          model: fallbackModel,
          contents,
        });
        const transcript = this._sanitizeTranscript(res2.text || '');
        return { transcript, language: 'en-US' };
      } catch (err2) {
        throw new Error(`Gemini audio transcription error: ${err2.message}`);
      }
    }
  }

  _sanitizeTranscript(raw) {
    if (!raw) return '';
    let text = raw.trim();
    text = text.replace(/^```[a-z]*\n([\s\S]*?)```$/i, '$1').trim();
    text = text.replace(/\[?\b\d{1,2}:\d{2}\b\]?/g, '').trim();
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      text = text.slice(1, -1).trim();
    }
    const lower = text.toLowerCase();
    if (
      !text ||
      text === '.' ||
      text === '...' ||
      lower === 'the sky is blue' ||
      lower === 'you' ||
      lower === 'thank you' ||
      lower === 'piss off' ||
      /^[0-9:\s.]+$/.test(text)
    ) {
      return '';
    }
    return text;
  }

  /**
   * Conducts an autonomous, comprehensive deep research study on a specified topic.
   * Returns structured JSON with spoken executive summary, executive report, key findings, and full Markdown dossier.
   *
   * @param {string} topic - The topic to research
   * @param {string} [targetApp='Claude'] - Target companion app (Claude or ChatGPT)
   * @returns {Promise<{ topic: string, target_app: string, executive_spoken_summary: string, executive_summary: string, key_findings: string[], full_dossier_markdown: string }>}
   */
  async conductDeepResearch(topic, targetApp = 'Claude') {
    if (!this.hasApiKey()) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const cleanTopic = (topic || '').trim();
    const systemPrompt = `You are a World-Class Principal AI Research Scientist and Technology Analyst.
Your task is to conduct an authoritative, rigorous, deep-dive research investigation into the specified topic.
You must produce a comprehensive research dossier and an engaging, articulate executive spoken briefing.

Format your output as valid JSON matching this schema:
{
  "topic": "${cleanTopic}",
  "target_app": "${targetApp}",
  "executive_spoken_summary": "4-6 articulate, natural spoken sentences (80-120 words) explaining the primary breakthroughs, technical mechanisms, and major real-world impact. Perfect for high-definition voice synthesis.",
  "executive_summary": "2-3 comprehensive paragraphs providing the strategic executive briefing of the state of the art.",
  "key_findings": [
    "Key breakthrough 1 with concrete data/insights",
    "Key breakthrough 2 with technical mechanisms",
    "Key breakthrough 3 with industry applications",
    "Key breakthrough 4 with roadmap & strategic outlook"
  ],
  "full_dossier_markdown": "# 🔬 Deep Research Dossier: ${cleanTopic}\\n\\n## 1. Executive Summary & Core Breakthroughs\\n...\\n\\n## 2. Fundamental Architectural & Working Principles\\n...\\n\\n## 3. State-of-the-Art Advances & Recent Milestones\\n...\\n\\n## 4. Real-World Applications & Production Impact\\n...\\n\\n## 5. Critical Bottlenecks, Limitations & Research Frontiers\\n...\\n\\n## 6. Strategic Outlook (Next 3-5 Years)\\n..."
}`;

    const prompt = `Conduct a comprehensive, deep-dive research investigation on the following topic:
Topic: "${cleanTopic}"
Target Companion AI: ${targetApp}

Deliver rigorous technical depth, concrete examples, latest advancements, and strategic clarity.`;

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const models = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];

    let lastError = null;
    for (const model of models) {
      try {
        console.log(`[GeminiService] 🔬 Conducting deep research using ${model}...`);
        const config = {
          systemInstruction: systemPrompt,
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        };
        if (model.includes('preview') || model.includes('thinking')) {
          config.thinkingConfig = { thinkingBudget: 0 };
        }

        const response = await this.ai.models.generateContent({
          model,
          contents,
          config,
        });

        const raw = response.text ? response.text.trim() : '';
        const parsed = this.extractJson(raw);
        if (parsed && (parsed.executive_spoken_summary || parsed.full_dossier_markdown)) {
          return {
            topic: parsed.topic || cleanTopic,
            target_app: parsed.target_app || targetApp,
            executive_spoken_summary: parsed.executive_spoken_summary || parsed.summary || '',
            executive_summary: parsed.executive_summary || '',
            key_findings: Array.isArray(parsed.key_findings) ? parsed.key_findings : [],
            full_dossier_markdown: parsed.full_dossier_markdown || parsed.full_report_markdown || parsed.report || '',
          };
        }
      } catch (err) {
        lastError = err;
        console.warn(`[GeminiService] Deep research attempt with ${model} notice:`, err.message);
      }
    }

    throw lastError || new Error('Deep research synthesis failed');
  }
}

module.exports = { GeminiService };

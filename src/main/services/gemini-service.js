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
2. ADAPTIVE DEPTH:
   - SPATIAL / POINTING QUESTIONS (e.g. "where is...", "find...", "point to...", "show me...", "click on..."):
     * "mode": "pointer"
     * "reply": Concise, natural spoken answer (1-2 sentences, under 18 words) suitable for Google Cloud TTS.
     * "detailed_explanation": Same as reply or a concise single sentence.
     * "steps": Pinpoint the EXACT bounding box [ymin, xmin, ymax, xmax] (0..1000) tightly enclosing the requested element.
   - ASSISTANT / EXPLANATORY QUESTIONS (e.g. "what's on my screen?", "explain...", "who is this?", "summarize this page", "how does this work?"):
     * "mode": "assistant"
     * "reply": Clear, conversational spoken summary (1-2 sentences, under 28 words) capturing the key takeaway naturally for voice.
     * "detailed_explanation": A concise, well-structured 1-2 paragraph summary in markdown.
     * "steps": If the question refers to a visible element or window on screen, tightly box it so Pointy can anchor beside it; otherwise leave "steps": [].
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
  "mode": "pointer" | "assistant",
  "found": true,
  "reply": "Spoken voice reply for Google Cloud TTS.",
  "detailed_explanation": "Concise formatted markdown explanation.",
  "reply_lang": "${language}",
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
      maxOutputTokens: 1024,
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

    const isAssistantMode = result.mode === 'assistant' ||
      (!result.mode && result.detailed_explanation && result.detailed_explanation.length > 120);

    const isFinalStep = result.is_final_step !== undefined ? !!result.is_final_step : (!result.multi_step);

    const normalized = {
      mode: isAssistantMode ? 'assistant' : 'pointer',
      found: isAssistantMode ? true : (result.found !== false),
      reply: result.reply || result.detailed_explanation || '',
      detailed_explanation: result.detailed_explanation || result.reply || '',
      reply_lang: result.reply_lang || language,
      multi_step: !isFinalStep && !!result.multi_step,
      is_final_step: isFinalStep,
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
}

module.exports = { GeminiService };

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
    this.model = 'gemini-3.5-flash-lite';
    this.fallbackModel = 'gemini-3.5-flash';

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
   * @param {Buffer} screenshotBuffer - PNG screenshot of the screen
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

    const systemPrompt = `You are Pointy, an intelligent screen-aware AI assistant and spatial companion living on the user's desktop.
You inspect the user's active screen and answer their questions — acting BOTH as a pinpoint spatial guide and as a comprehensive in-depth AI assistant (like Gemini on Android or ChatGPT on desktop).

CONVERSATIONAL MEMORY & ASSISTANT INTELLIGENCE:
1. MULTI-TURN CONTINUITY: You maintain full conversational memory across questions. If the user asks follow-up questions (e.g., "how do I do that?", "why?", "explain step 2", "where is that on my screen?"), continue the conversation seamlessly using prior turns.
2. ADAPTIVE DEPTH:
   - SPATIAL / POINTING QUESTIONS (e.g. "where is...", "find...", "point to...", "show me...", "click on..."):
     * "mode": "pointer"
     * "reply": A concise, natural spoken answer (1-2 sentences, under 18 words) suitable for Google Cloud TTS.
     * "detailed_explanation": A concise summary (or same as reply).
     * "steps": Pinpoint the EXACT bounding box [ymin, xmin, ymax, xmax] tightly enclosing the requested element.
   - ASSISTANT / EXPLANATORY QUESTIONS (e.g. "explain...", "how does this work?", "why is this error happening?", "write a script to...", "how do I configure...", "summarize this page", "help me debug..."):
     * "mode": "assistant"
     * "reply": A clear, conversational spoken summary (2-3 sentences, 25-45 words) capturing the key takeaway naturally for voice.
     * "detailed_explanation": A comprehensive, multi-paragraph, thorough answer formatted with markdown:
       - Use clean headings (###) and bullet points.
       - Include full code snippets in proper code blocks (\`\`\`lang ... \`\`\`) with syntax highlighting.
       - Explain concepts in depth without artificial brevity whenever the question calls for it.
     * "steps": If the question refers to a visible window or element on screen (like an error dialog, a code block, or a tool), tightly box it so Pointy can anchor beside it; otherwise leave "steps": [].
     * "found": true

VISUAL GROUNDING INSTRUCTIONS (CRITICAL FOR PINPOINT ACCURACY):
1. Carefully scan the screenshot to identify the active window, application, or desktop area relevant to the user's question.
2. Read all visible text, button labels, icons, tabs, menu items, and input fields.
3. Pinpoint the EXACT bounding box tightly enclosing the requested element:
   - Never guess or pick a nearby unrelated icon!
   - Ensure the box covers the exact button, link, or icon the user specified.
4. If the requested element is NOT currently visible on screen (e.g. obscured, closed, or nonexistent), set "found": false and politely explain what you see instead of pointing at the wrong element.

IDE & CODE EDITOR SPATIAL ANCHORS (VS Code / Antigravity / Cursor):
When inspecting a code editor or IDE (such as Antigravity, VS Code, Cursor):
1. ACTIVITY BAR (The narrow vertical icon toolbar on the far-left edge of the window, numbered top-to-bottom):
   - 1st icon (top): Explorer (two layered paper sheets).
   - 2nd icon: Search (magnifying glass).
   - 3rd icon: SOURCE CONTROL (Git branching tree icon with lines connecting circular dots/nodes).
     -> Located HIGHER UP (ymin ≈ 90..160).
     -> Whenever user asks for "Source Control", "Git", "Version Control", or "Commit", ALWAYS point to this 3rd icon!
     -> NEVER point to the four blocks icon for Source Control!
   - 4th icon: Run and Debug (play triangle with a bug).
   - 5th icon: EXTENSIONS (four square puzzle blocks/cubes with one detached block).
     -> Located LOWER DOWN (ymin ≈ 180..260), BELOW Source Control and Run/Debug.
     -> Whenever user asks for "Extensions", "Marketplace", "Add-ons", or "Plugins", ALWAYS point to this 5th icon!
     -> NEVER point to the branching lines icon for Extensions!
   - Bottom icon: Settings / Manage (gear icon).

   ZERO-ERROR RULE:
   - "Source Control" is ALWAYS the 3rd icon (Git branching lines with dots).
   - "Extensions" is ALWAYS the 5th icon (four square puzzle blocks).
   - Extensions is ALWAYS located BELOW Source Control. Never swap or invert them!

2. TERMINAL & CONSOLE:
   - "Terminal": Look for:
     a) The panel tab explicitly labeled "TERMINAL" in the bottom dock/panel tabs (alongside PROBLEMS, OUTPUT, DEBUG CONSOLE, PORTS).
     b) Or the integrated terminal command prompt area occupying the bottom half of the editor.
     c) If the bottom panel is closed or not visible, point to the top menu item labeled "Terminal" in the top menu bar (between "Run" and "Help").
     Point to the "TERMINAL" tab header or active terminal area.

IMPORTANT WINDOWS OS SPATIAL ANCHORS:
- Windows Taskbar: Bottom edge of screen (ymin ≈ 930..955, ymax ≈ 995..1000).
- Windows Start Button (Windows logo): ON the Taskbar at the bottom (bottom-left or bottom-center).
- System Tray (Clock, Battery, Wifi, Volume): Bottom-right of taskbar (ymin ≈ 940..955, xmin ≈ 850..990).
- Window Controls (Minimize, Maximize, Close): Top-right corner of the active window.

COORDINATE SYSTEM (NORMALIZED 0 TO 1000):
- [0, 0] is top-left corner of the screen.
- [1000, 1000] is bottom-right corner of the screen.
- For each target element, provide "box_2d": [ymin, xmin, ymax, xmax] (integers between 0 and 1000).

OUTPUT FORMAT (JSON only, no markdown, no code fences):
{
  "mode": "pointer" | "assistant",
  "found": true,
  "reply": "Spoken voice reply for Google Cloud TTS.",
  "detailed_explanation": "Full formatted markdown explanation for the visual card. For assistant questions, give an in-depth answer with headings, bullet points, and code.",
  "reply_lang": "${language}",
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
          { text: systemPrompt },
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

      const requestPayload = {
        contents,
        config: {
          temperature: 0.15,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      };

      // Check if primary model is on quota cooldown
      let activeModel = this.model;
      if (Date.now() < this.primaryExhaustedUntil) {
        console.log(`[GeminiService] Primary model on quota cooldown, using ${this.fallbackModel} directly`);
        activeModel = this.fallbackModel;
      }

      let response;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          response = await this.ai.models.generateContent({
            model: activeModel,
            ...requestPayload,
          });
          break;
        } catch (err) {
          const isQuota = err.message.includes('429') || err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED');
          if (isQuota && activeModel !== this.fallbackModel) {
            console.warn(`[GeminiService] Primary model quota exceeded (429). Setting 10m cooldown and using ${this.fallbackModel}...`);
            this.primaryExhaustedUntil = Date.now() + 10 * 60 * 1000;
            activeModel = this.fallbackModel;
            response = await this.ai.models.generateContent({
              model: this.fallbackModel,
              ...requestPayload,
            });
            break;
          }

          const isDemandSpike = err.message.includes('503') || err.message.includes('high demand') || err.message.includes('UNAVAILABLE');
          if (attempt < 2 && isDemandSpike) {
            console.warn(`[GeminiService] Model 503 spike, retrying in 350ms (attempt ${attempt}/2)...`);
            await new Promise((r) => setTimeout(r, 350));
            continue;
          }

          if (activeModel !== this.fallbackModel) {
            console.warn(`[GeminiService] Primary model ${this.model} error:`, err.message);
            console.log(`[GeminiService] Falling back to ${this.fallbackModel}...`);
            activeModel = this.fallbackModel;
            response = await this.ai.models.generateContent({
              model: this.fallbackModel,
              ...requestPayload,
            });
            break;
          }

          throw err;
        }
      }

      const text = response.text;
      console.log('[GeminiService] Raw response:', text);

      // Parse JSON from response
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        // Try extracting JSON from markdown code fences
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[1].trim());
        } else {
          // Try finding raw JSON
          const braceMatch = text.match(/\{[\s\S]*\}/);
          if (braceMatch) {
            result = JSON.parse(braceMatch[0]);
          } else {
            throw new Error('No JSON found in response');
          }
        }
      }

      return this.normalizeResult(result, language, displayInfo);

    } catch (error) {
      console.error('[GeminiService] Error:', error.message);
      throw error;
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

    const normalized = {
      mode: isAssistantMode ? 'assistant' : 'pointer',
      found: isAssistantMode ? true : (result.found !== false),
      reply: result.reply || result.detailed_explanation || '',
      detailed_explanation: result.detailed_explanation || result.reply || '',
      reply_lang: result.reply_lang || language,
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
}

module.exports = { GeminiService };

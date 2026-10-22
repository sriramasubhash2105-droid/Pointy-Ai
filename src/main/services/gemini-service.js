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
    this.model = 'gemini-2.5-flash';

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
   * @param {string} question - The user's question (transcribed or typed)
   * @param {string} language - Detected language code (e.g., 'hi-IN', 'en-IN')
   * @param {object} displayInfo - Screen dimensions and scale factor
   * @returns {object} { found, reply, reply_lang, steps: [{ x, y, w, h, instruction }] }
   */
  async analyzeScreen(screenshotBuffer, question, language = 'en-IN', displayInfo = {}) {
    if (!this.ai) {
      throw new Error('Gemini API key not configured');
    }

    const base64Image = screenshotBuffer.toString('base64');

    const systemPrompt = `You are Pointy, an AI screen guide that helps users navigate their computer.
You can see a screenshot of the user's screen. The user asks a question about what they see.

Your job:
1. Look at the screenshot carefully
2. Find the UI element(s) that answer the user's question
3. Return the EXACT pixel coordinates (bounding box) of each target element
4. Write a short, friendly spoken reply in the user's language

IMPORTANT RULES:
- Return precise bounding boxes as [x, y, width, height] in pixels relative to the screenshot
- If the question is about a button, menu item, link, icon, or field — find it precisely
- For multi-step tasks, return up to 5 steps in order
- Reply in the same language the user spoke (${language})
- Keep replies short (1-2 sentences), spoken style
- You can only POINT at things. Never say "click" — say "yahan dekho" or "here it is"
- If you genuinely cannot find what the user asks for, say so honestly

The screen resolution is ${displayInfo.width || 1920}x${displayInfo.height || 1080} at ${displayInfo.scaleFactor || 1}x scale.

OUTPUT FORMAT (JSON only, no markdown, no code fences):
{
  "found": true,
  "reply": "short spoken reply in user's language",
  "reply_lang": "hi-IN",
  "steps": [
    {
      "x": 150,
      "y": 200,
      "w": 120,
      "h": 36,
      "label": "Settings",
      "instruction": "Yahan dekho, ye Settings button hai"
    }
  ]
}`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: [
          { text: systemPrompt },
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Image,
            },
          },
          { text: `User's question (language: ${language}): "${question}"` },
        ],
        config: {
          temperature: 0.3,
          maxOutputTokens: 800,
          responseMimeType: 'application/json',
        },
      });

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
   * Normalize and validate the Gemini response
   */
  normalizeResult(result, language, displayInfo) {
    const scaleFactor = displayInfo.scaleFactor || 1;

    const normalized = {
      found: result.found !== false,
      reply: result.reply || '',
      reply_lang: result.reply_lang || language,
      steps: [],
      needs_clarification: result.needs_clarification || false,
      clarifying_question: result.clarifying_question || '',
    };

    if (result.steps && Array.isArray(result.steps)) {
      normalized.steps = result.steps
        .filter(step => step.x != null && step.y != null)
        .map(step => ({
          // Gemini returns coords relative to the image — divide by scale factor
          // for screen coordinates
          x: Math.round((step.x || 0) / scaleFactor),
          y: Math.round((step.y || 0) / scaleFactor),
          w: Math.round((step.w || 60) / scaleFactor),
          h: Math.round((step.h || 30) / scaleFactor),
          label: step.label || '',
          instruction: step.instruction || '',
          element_id: null, // No element IDs needed — we have direct coordinates
        }));
    }

    if (normalized.steps.length === 0) {
      normalized.found = false;
    }

    return normalized;
  }
}

module.exports = { GeminiService };

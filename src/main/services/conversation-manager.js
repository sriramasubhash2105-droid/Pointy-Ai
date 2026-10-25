const fs = require('fs');
const path = require('path');

/**
 * Conversation Manager
 * Stores and manages persistent multi-turn conversations and memory
 * for Pointy AI (similar to ChatGPT / Gemini / Siri).
 */
class ConversationManager {
  constructor(storagePath) {
    this.storagePath = storagePath || path.join(__dirname, '../../../pointy_conversations.json');
    this.conversations = {};
    this.activeId = null;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.storagePath)) {
        const raw = fs.readFileSync(this.storagePath, 'utf8');
        const data = JSON.parse(raw);
        this.conversations = data.conversations || {};
        this.activeId = data.activeId || null;
      }
    } catch (e) {
      console.warn('[ConversationManager] Notice loading conversations:', e.message);
      this.conversations = {};
      this.activeId = null;
    }

    // Ensure at least one active conversation exists
    if (!this.activeId || !this.conversations[this.activeId]) {
      this.startNewConversation();
    }
  }

  save() {
    try {
      const data = {
        activeId: this.activeId,
        conversations: this.conversations,
      };
      fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.warn('[ConversationManager] Notice saving conversations:', e.message);
    }
  }

  startNewConversation(title = 'New Conversation') {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.conversations[id] = {
      id,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    this.activeId = id;
    this.save();
    return this.conversations[id];
  }

  getActiveConversation() {
    if (!this.activeId || !this.conversations[this.activeId]) {
      return this.startNewConversation();
    }
    return this.conversations[this.activeId];
  }

  setActiveConversation(id) {
    if (this.conversations[id]) {
      this.activeId = id;
      this.save();
      return this.conversations[id];
    }
    return this.getActiveConversation();
  }

  getAllConversations() {
    return Object.values(this.conversations)
      .map(c => ({
        ...c,
        isPinned: !!(c.pinned || c.isPinned),
      }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  /**
   * Add a message to the active conversation
   * @param {string} role - 'user' | 'assistant'
   * @param {object|string} data - { text, mode, reply, detailed_explanation, steps }
   */
  addMessage(role, data) {
    const conv = this.getActiveConversation();
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    let messageObj;
    if (role === 'user') {
      const text = typeof data === 'string' ? data : (data.text || '');
      messageObj = {
        id: msgId,
        role: 'user',
        text,
        timestamp: Date.now(),
      };

      // Auto-set title from first question
      if (conv.messages.length === 0 && text) {
        conv.title = text.length > 36 ? text.substring(0, 36).trim() + '...' : text;
      }
    } else {
      // Assistant response
      messageObj = {
        id: msgId,
        role: 'assistant',
        mode: data.mode || 'assistant',
        reply: data.reply || '',
        detailed_explanation: data.detailed_explanation || data.reply || '',
        steps: data.steps || [],
        found: data.found !== false,
        timestamp: Date.now(),
      };
    }

    conv.messages.push(messageObj);
    conv.updatedAt = Date.now();
    this.save();
    return messageObj;
  }

  /**
   * Format prior conversation turns for Gemini's multi-turn chat API
   * Returns: [{ role: 'user', parts: [...] }, { role: 'model', parts: [...] }]
   */
  getGeminiHistory(maxTurns = 12) {
    const conv = this.getActiveConversation();
    if (!conv || !conv.messages || conv.messages.length === 0) {
      return [];
    }

    // Take last maxTurns (excluding current question being submitted)
    const recent = conv.messages.slice(-maxTurns);
    const history = [];

    for (const msg of recent) {
      if (msg.role === 'user') {
        history.push({
          role: 'user',
          parts: [{ text: msg.text || '' }],
        });
      } else if (msg.role === 'assistant') {
        // Feed the assistant's previous explanation & response back into model memory
        const responseText = msg.detailed_explanation || msg.reply || '';
        history.push({
          role: 'model',
          parts: [{ text: responseText }],
        });
      }
    }

    return history;
  }

  getConversation(id) {
    return this.conversations[id] || null;
  }

  deleteConversation(id) {
    if (this.conversations[id]) {
      delete this.conversations[id];
      if (this.activeId === id) {
        const remaining = Object.keys(this.conversations);
        this.activeId = remaining.length > 0 ? remaining[0] : null;
        if (!this.activeId) {
          this.startNewConversation();
        }
      }
      this.save();
      return true;
    }
    return false;
  }

  renameConversation(id, newTitle) {
    if (this.conversations[id] && newTitle) {
      this.conversations[id].title = newTitle.trim();
      this.conversations[id].updatedAt = Date.now();
      this.save();
      return this.conversations[id];
    }
    return null;
  }

  pinConversation(id, isPinned = true) {
    if (this.conversations[id]) {
      this.conversations[id].pinned = !!isPinned;
      this.conversations[id].updatedAt = Date.now();
      this.save();
      return this.conversations[id];
    }
    return null;
  }

  clearAllConversations() {
    this.conversations = {};
    this.activeId = null;
    const fresh = this.startNewConversation();
    return [fresh];
  }

  clearActiveConversation() {
    const conv = this.getActiveConversation();
    conv.messages = [];
    conv.updatedAt = Date.now();
    this.save();
    return conv;
  }
}

module.exports = ConversationManager;
module.exports.ConversationManager = ConversationManager;

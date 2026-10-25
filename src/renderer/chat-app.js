/**
 * Pointy AI - ChatGPT Classic Desktop Client
 * Features:
 * - Persistent multi-turn conversation storage with Pinned & Recents
 * - Real-time AI chat powered by Gemini with Markdown & code highlighting
 * - Copy code snippets & full turn text
 * - High-fidelity Text-to-Speech (TTS) read aloud
 * - Speech-to-Text (STT) voice input via Web Speech
 * - Desktop screen vision attachment
 * - API Key management with live connection test & .env persistence
 * - Pointy spatial desktop companion integration
 */

(function () {
  'use strict';

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  let conversations = [];
  let currentConversationId = null;
  let currentModel = 'gemini-3.5-flash-lite';
  let isThinkMode = false;
  let attachedScreenshot = null;
  let isVoiceRecording = false;
  let speechRecognition = null;
  let activeAudio = null;

  // Personalization defaults
  let userName = localStorage.getItem('chat_user_name') || 'Srirama Subhash';
  let defaultModel = localStorage.getItem('chat_default_model') || 'gemini-3.5-flash-lite';

  // ==========================================
  // DOM ELEMENT REFERENCES
  // ==========================================
  // Sidebar
  const sidebar = document.getElementById('sidebar');
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const btnSidebarCollapseToggle = document.getElementById('btn-sidebar-collapse-toggle');
  const btnNewChat = document.getElementById('btn-new-chat');
  const pinnedListEl = document.getElementById('pinned-chats-list');
  const recentsListEl = document.getElementById('recents-chats-list');
  const btnSearchChats = document.getElementById('btn-search-chats');
  const searchFilterBox = document.getElementById('search-filter-box');
  const chatSearchInput = document.getElementById('chat-search-input');
  const btnClearSearch = document.getElementById('btn-clear-search');
  const userProfileEl = document.querySelector('.user-profile');
  const userNameEl = document.querySelector('.user-name');
  const userAvatarEl = document.querySelector('.user-avatar');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const btnHeaderSettings = document.getElementById('btn-header-settings');

  // Top Bar & Model
  const btnModelSelector = document.getElementById('btn-model-selector');
  const currentModelName = document.getElementById('current-model-name');
  const modelDropdownMenu = document.getElementById('model-dropdown-menu');
  const btnTogglePointy = document.getElementById('btn-toggle-pointy');
  const pointyStatusText = document.getElementById('pointy-status-text');

  // Main Content Views
  const chatScrollContainer = document.getElementById('chat-scroll-container');
  const emptyStateView = document.getElementById('empty-state-view');
  const emptyGreeting = document.querySelector('.empty-greeting');
  const messagesThread = document.getElementById('messages-thread');
  const bottomBar = document.getElementById('bottom-bar');

  // Empty Screen Inputs
  const emptyMainInput = document.getElementById('empty-main-input');
  const emptySendBtn = document.getElementById('empty-send-btn');
  const emptyAttachBtn = document.getElementById('empty-attach-btn');
  const emptyThinkBtn = document.getElementById('empty-think-btn');
  const emptyMicBtn = document.getElementById('empty-mic-btn');

  // Bottom Sticky Inputs
  const mainTextarea = document.getElementById('main-textarea');
  const mainSendBtn = document.getElementById('main-send-btn');
  const bottomAttachBtn = document.getElementById('bottom-attach-btn');
  const bottomThinkBtn = document.getElementById('bottom-think-btn');
  const bottomMicBtn = document.getElementById('bottom-mic-btn');

  // Settings Modal
  const settingsModal = document.getElementById('settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnCancelSettings = document.getElementById('btn-cancel-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const modalTabs = document.querySelectorAll('.modal-tabs .tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const inputGeminiKey = document.getElementById('input-gemini-key');
  const inputTtsKey = document.getElementById('input-tts-key');
  const inputAssemblyKey = document.getElementById('input-assembly-key');
  const btnTestGemini = document.getElementById('btn-test-gemini');
  const geminiTestResult = document.getElementById('gemini-test-result');
  const geminiStatusBadge = document.getElementById('gemini-status-badge');
  const inputUserName = document.getElementById('input-user-name');
  const selectDefaultModel = document.getElementById('select-default-model');
  const selectReasoningModel = document.getElementById('select-reasoning-model');
  const modelBadgePreview = document.getElementById('model-badge-preview');
  const togglePointyCompanion = document.getElementById('toggle-pointy-companion');
  const statsChatCount = document.getElementById('stats-chat-count');
  const statsMsgCount = document.getElementById('stats-msg-count');
  const btnExportChats = document.getElementById('btn-export-chats');
  const btnClearAllChats = document.getElementById('btn-clear-all-chats');
  const settingsSaveStatus = document.getElementById('settings-save-status');

  // Friendly reasoning model label mapping
  const MODEL_LABELS = {
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-2.0-flash-thinking-exp-01-21': 'Gemini 2.0 Flash Thinking',
    'gemini-2.0-pro-exp-02-05': 'Gemini 2.0 Pro',
    'gemini-2.0-pro': 'Gemini 2.0 Pro',
    'gemini-1.5-pro': 'Gemini 1.5 Pro',
  };

  // Toast
  const toastEl = document.getElementById('toast');

  // ==========================================
  // INITIALIZATION
  // ==========================================
  async function init() {
    setupUserProfile();
    setupEventListeners();
    setupSpeechRecognition();
    await loadInitialSettings();
    await refreshConversations();
    checkPointyOverlayStatus();
  }

  function setupUserProfile() {
    userNameEl.textContent = userName;
    emptyGreeting.textContent = `Good to see you, ${getFirstName(userName)}.`;
    const initials = getInitials(userName);
    userAvatarEl.textContent = initials;
    inputUserName.value = userName;
    currentModel = localStorage.getItem('chat_reasoning_model') || defaultModel || 'gemini-2.5-flash';
    updateModelSelectorLabel(currentModel);
  }

  function getFirstName(fullName) {
    if (!fullName) return 'Srirama';
    return fullName.split(' ')[0];
  }

  function getInitials(fullName) {
    if (!fullName) return 'SS';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // ==========================================
  // CONVERSATION MANAGEMENT
  // ==========================================
  async function refreshConversations() {
    try {
      conversations = await window.chatAPI.getConversations();
      renderSidebarConversations();
      updateDataStats();
    } catch (err) {
      console.error('Failed to load conversations:', err);
      showToast('Could not load chat history: ' + err.message, 'error');
    }
  }

  function renderSidebarConversations() {
    const filter = (chatSearchInput.value || '').trim().toLowerCase();

    const filtered = filter
      ? conversations.filter(c => (c.title || '').toLowerCase().includes(filter))
      : conversations;

    const pinned = filtered.filter(c => c.isPinned);
    const recents = filtered.filter(c => !c.isPinned);

    // Render Pinned
    pinnedListEl.innerHTML = '';
    if (pinned.length === 0) {
      pinnedListEl.innerHTML = '<div class="empty-list-note">No pinned chats</div>';
    } else {
      pinned.forEach(c => pinnedListEl.appendChild(createChatListItem(c)));
    }

    // Render Recents
    recentsListEl.innerHTML = '';
    if (recents.length === 0) {
      recentsListEl.innerHTML = '<div class="empty-list-note">No recent chats</div>';
    } else {
      recents.forEach(c => recentsListEl.appendChild(createChatListItem(c)));
    }
  }

  function createChatListItem(chat) {
    const item = document.createElement('div');
    item.className = 'chat-item' + (chat.id === currentConversationId ? ' active' : '');
    item.dataset.id = chat.id;

    // Chat Icon (Cube for special/pinned or Chat bubble)
    const icon = document.createElement('span');
    icon.className = 'chat-item-icon';
    icon.innerHTML = chat.isPinned
      ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`
      : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

    // Chat Title
    const title = document.createElement('span');
    title.className = 'chat-item-title';
    title.textContent = chat.title || 'Untitled Chat';

    // Actions Menu (Hover)
    const actions = document.createElement('div');
    actions.className = 'chat-item-actions';

    // Pin / Unpin button
    const pinBtn = document.createElement('button');
    pinBtn.className = 'item-action-btn' + (chat.isPinned ? ' pinned' : '');
    pinBtn.title = chat.isPinned ? 'Unpin' : 'Pin to top';
    pinBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6l.8.8.8-.8v-6H18v-2l-2-2z"/></svg>`;
    pinBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await togglePinChat(chat.id, !chat.isPinned);
    });

    // Rename button
    const renameBtn = document.createElement('button');
    renameBtn.className = 'item-action-btn';
    renameBtn.title = 'Rename';
    renameBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      promptRenameChat(chat);
    });

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'item-action-btn delete';
    deleteBtn.title = 'Delete';
    deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await confirmDeleteChat(chat.id, chat.title);
    });

    actions.appendChild(pinBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(icon);
    item.appendChild(title);
    item.appendChild(actions);

    item.addEventListener('click', () => selectConversation(chat.id));

    return item;
  }

  async function selectConversation(id) {
    currentConversationId = id;
    renderSidebarConversations();

    try {
      const conv = await window.chatAPI.getConversation(id);
      if (!conv || !conv.messages || conv.messages.length === 0) {
        showEmptyState();
      } else {
        showThreadState(conv);
      }
    } catch (err) {
      console.error('Failed to get conversation:', err);
      showToast('Error loading conversation: ' + err.message, 'error');
    }
  }

  function startNewChat() {
    currentConversationId = null;
    attachedScreenshot = null;
    removeAttachedScreenBadge();
    showEmptyState();
    renderSidebarConversations();
    emptyMainInput.value = '';
    emptyMainInput.focus();
  }

  function showEmptyState() {
    emptyStateView.classList.remove('hidden');
    messagesThread.classList.add('hidden');
    bottomBar.classList.add('hidden');
    messagesThread.innerHTML = '';
  }

  function showThreadState(conv) {
    emptyStateView.classList.add('hidden');
    messagesThread.classList.remove('hidden');
    bottomBar.classList.remove('hidden');
    renderMessages(conv.messages || []);
    scrollToBottom();
    mainTextarea.focus();
  }

  async function togglePinChat(id, isPinned) {
    try {
      await window.chatAPI.pinConversation(id, isPinned);
      await refreshConversations();
      showToast(isPinned ? 'Chat pinned to top' : 'Chat unpinned', 'success');
    } catch (err) {
      showToast('Failed to update pin: ' + err.message, 'error');
    }
  }

  function promptRenameChat(chat) {
    const newTitle = prompt('Enter a new title for this chat:', chat.title || '');
    if (newTitle && newTitle.trim() && newTitle.trim() !== chat.title) {
      window.chatAPI.renameConversation(chat.id, newTitle.trim())
        .then(() => refreshConversations())
        .then(() => showToast('Chat renamed', 'success'))
        .catch(err => showToast('Rename failed: ' + err.message, 'error'));
    }
  }

  async function confirmDeleteChat(id, title) {
    if (confirm(`Are you sure you want to delete "${title || 'this chat'}"?`)) {
      try {
        await window.chatAPI.deleteConversation(id);
        if (currentConversationId === id) {
          startNewChat();
        }
        await refreshConversations();
        showToast('Chat deleted', 'info');
      } catch (err) {
        showToast('Failed to delete chat: ' + err.message, 'error');
      }
    }
  }

  // ==========================================
  // MESSAGE RENDERING (MARKDOWN & SYNTAX)
  // ==========================================
  function renderMessages(messages) {
    messagesThread.innerHTML = '';
    messages.forEach(msg => {
      const text = msg.content || msg.detailed_explanation || msg.text || msg.reply || '';
      appendMessageTurn(msg.role, text, msg.timestamp, false);
    });
  }

  function appendMessageTurn(role, text, timestamp = Date.now(), isStreaming = false) {
    const turnEl = document.createElement('div');
    turnEl.className = `message-turn ${role}-turn`;

    const avatarEl = document.createElement('div');
    avatarEl.className = 'turn-avatar';

    if (role === 'user') {
      avatarEl.textContent = getInitials(userName);
    } else {
      avatarEl.innerHTML = `<svg viewBox="0 0 512 512" width="18" height="18"><path d="M 71,1 L 461,328 L 209,313 L 49,510 Z" fill="#ffffff" /></svg>`;
    }

    const contentWrap = document.createElement('div');
    contentWrap.className = 'turn-content-wrap';

    const headerEl = document.createElement('div');
    headerEl.className = 'turn-header';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'turn-sender-name';
    nameSpan.textContent = role === 'user' ? userName : 'Pointy AI';
    headerEl.appendChild(nameSpan);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'turn-body markdown-body';

    if (isStreaming) {
      bodyEl.innerHTML = `<span class="streaming-dot"></span>`;
    } else {
      bodyEl.innerHTML = parseMarkdownToHtml(text);
      attachCodeCopyButtons(bodyEl);
    }

    // Action Toolbar for Assistant turns
    if (role === 'assistant' && !isStreaming) {
      const actionsToolbar = createTurnActionsToolbar(text);
      contentWrap.appendChild(headerEl);
      contentWrap.appendChild(bodyEl);
      contentWrap.appendChild(actionsToolbar);
    } else {
      contentWrap.appendChild(headerEl);
      contentWrap.appendChild(bodyEl);
    }

    turnEl.appendChild(avatarEl);
    turnEl.appendChild(contentWrap);

    messagesThread.appendChild(turnEl);
    return turnEl;
  }

  function createTurnActionsToolbar(text) {
    const toolbar = document.createElement('div');
    toolbar.className = 'turn-actions-toolbar';

    // Copy text
    const copyBtn = document.createElement('button');
    copyBtn.className = 'turn-action-icon-btn';
    copyBtn.title = 'Copy response';
    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(text);
      showToast('Copied to clipboard', 'info');
      copyBtn.innerHTML = `✓`;
      setTimeout(() => {
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
      }, 1500);
    });

    // Read Aloud / Speak
    const speakBtn = document.createElement('button');
    speakBtn.className = 'turn-action-icon-btn';
    speakBtn.title = 'Read aloud';
    speakBtn.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
    speakBtn.addEventListener('click', async () => {
      speakTurnText(text, speakBtn);
    });

    // Thumbs up / down feedback
    const thumbsUpBtn = document.createElement('button');
    thumbsUpBtn.className = 'turn-action-icon-btn';
    thumbsUpBtn.title = 'Good response';
    thumbsUpBtn.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>`;
    thumbsUpBtn.addEventListener('click', () => {
      thumbsUpBtn.classList.toggle('active');
      showToast('Feedback submitted', 'info');
    });

    toolbar.appendChild(copyBtn);
    toolbar.appendChild(speakBtn);
    toolbar.appendChild(thumbsUpBtn);

    return toolbar;
  }

  async function speakTurnText(text, btn) {
    if (activeAudio) {
      activeAudio.pause();
      activeAudio = null;
      btn.classList.remove('speaking');
      return;
    }

    try {
      btn.classList.add('speaking');
      // Strip markdown code fences before speaking
      const cleanText = text.replace(/```[\s\S]*?```/g, 'Code block omitted.').replace(/[*_#`]/g, '');
      const audioResult = await window.chatAPI.speakText(cleanText);

      if (audioResult && audioResult.audioContent) {
        const audioSrc = `data:audio/mp3;base64,${audioResult.audioContent}`;
        activeAudio = new Audio(audioSrc);
        activeAudio.play();
        activeAudio.onended = () => {
          btn.classList.remove('speaking');
          activeAudio = null;
        };
      } else {
        // Fallback to browser SpeechSynthesis
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.05;
        utterance.onend = () => {
          btn.classList.remove('speaking');
        };
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.warn('TTS error, falling back to speech synthesis:', err);
      btn.classList.remove('speaking');
      const cleanText = text.replace(/```[\s\S]*?```/g, '').replace(/[*_#`]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      window.speechSynthesis.speak(utterance);
    }
  }

  // ==========================================
  // LIGHTWEIGHT ROBUST MARKDOWN PARSER
  // ==========================================
  function parseMarkdownToHtml(md) {
    if (!md) return '';

    let html = md;

    // 1. Extract and preserve code blocks
    const codeBlocks = [];
    html = html.replace(/```([a-zA-Z0-9_\-\.]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const id = `__CODE_BLOCK_${codeBlocks.length}__`;
      codeBlocks.push({ lang: lang || 'text', code: escapeHtml(code.trim()) });
      return id;
    });

    // 2. Escape standard HTML in the rest of the text
    html = escapeHtml(html);

    // 3. Headings
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // 4. Bold & Italic
    html = html.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    html = html.replace(/___(.*?)___/gim, '<strong><em>$1</em></strong>');
    html = html.replace(/__(.*?)__/gim, '<strong>$1</strong>');
    html = html.replace(/_(.*?)_/gim, '<em>$1</em>');

    // 5. Inline Code
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // 6. Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // 7. Bullet Lists & Numbered Lists
    html = html.replace(/^\s*[\-\*]\s+(.*$)/gim, '<ul><li>$1</li></ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, ''); // merge adjacent lists

    html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<ol><li>$1</li></ol>');
    html = html.replace(/<\/ol>\s*<ol>/g, ''); // merge adjacent ordered lists

    // 8. Markdown Tables
    html = html.replace(/((?:^\|[^\n]+\|\r?\n?)+)/gm, (tableMatch) => {
      const rows = tableMatch.trim().split(/\r?\n/).map(r => r.trim()).filter(Boolean);
      if (rows.length < 2) return tableMatch;
      
      let tableHtml = '<div class="table-container"><table class="markdown-table">';
      let isHeader = true;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (/^\|[\s\-:]+(\|[\s\-:]+)+\|$/.test(row)) {
          isHeader = false;
          continue;
        }

        const cells = row.split('|').slice(1, -1).map(c => c.trim());
        if (isHeader) {
          tableHtml += '<thead><tr>';
          cells.forEach(c => { tableHtml += `<th>${c}</th>`; });
          tableHtml += '</tr></thead><tbody>';
          isHeader = false;
        } else {
          tableHtml += '<tr>';
          cells.forEach(c => { tableHtml += `<td>${c}</td>`; });
          tableHtml += '</tr>';
        }
      }
      tableHtml += '</tbody></table></div>';
      return tableHtml;
    });

    // 9. Line breaks to paragraphs
    const paragraphs = html.split(/\n{2,}/);
    html = paragraphs.map(p => {
      p = p.trim();
      if (!p) return '';
      if (p.startsWith('<h') || p.startsWith('<ul>') || p.startsWith('<ol>') || p.startsWith('<blockquote>') || p.startsWith('<div') || p.startsWith('__CODE_BLOCK_')) {
        return p;
      }
      return `<p>${p.replace(/\n/g, '<br/>')}</p>`;
    }).join('');

    // 9. Reinsert code blocks with syntax styled containers
    codeBlocks.forEach((block, idx) => {
      const placeholder = `__CODE_BLOCK_${idx}__`;
      const codeHtml = `
        <div class="code-block-container">
          <div class="code-block-header">
            <span class="code-lang-label">${block.lang}</span>
            <button class="copy-code-btn" data-code="${encodeURIComponent(block.code)}">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copy code</span>
            </button>
          </div>
          <pre class="code-pre"><code class="code-content language-${block.lang}">${block.code}</code></pre>
        </div>
      `;
      html = html.replace(placeholder, codeHtml);
    });

    return html;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function attachCodeCopyButtons(container) {
    container.querySelectorAll('.copy-code-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const rawCode = decodeURIComponent(btn.dataset.code || '');
        navigator.clipboard.writeText(rawCode);
        const originalText = btn.innerHTML;
        btn.innerHTML = `✓ Copied!`;
        btn.classList.add('copied');
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.classList.remove('copied');
        }, 2000);
      });
    });
  }

  function scrollToBottom() {
    chatScrollContainer.scrollTop = chatScrollContainer.scrollHeight;
  }

  // ==========================================
  // SEND MESSAGE WORKFLOW
  // ==========================================
  async function handleSendMessage(inputEl) {
    const rawText = inputEl.value.trim();
    if (!rawText && !attachedScreenshot) return;

    inputEl.value = '';
    adjustTextareaHeight(mainTextarea);

    const promptText = rawText;
    const screenshotData = attachedScreenshot;
    attachedScreenshot = null;
    removeAttachedScreenBadge();

    // If starting from empty state, create a conversation first or let the backend create it
    if (!currentConversationId) {
      const generatedTitle = promptText.length > 35 ? promptText.slice(0, 35) + '...' : promptText;
      try {
        const newConv = await window.chatAPI.createConversation(generatedTitle || 'New Chat');
        currentConversationId = newConv.id;
        showThreadState(newConv);
      } catch (err) {
        console.error('Failed to create new conversation:', err);
      }
    } else {
      emptyStateView.classList.add('hidden');
      messagesThread.classList.remove('hidden');
      bottomBar.classList.remove('hidden');
    }

    // 1. Append user message turn immediately
    appendMessageTurn('user', promptText, Date.now());
    scrollToBottom();

    // 2. Append assistant turn with pulsing loading dots
    const assistantTurn = appendMessageTurn('assistant', '', Date.now(), true);
    scrollToBottom();

    try {
      const options = {
        model: currentModel,
        thinkMode: isThinkMode,
        screenshot: screenshotData
      };

      const response = await window.chatAPI.sendMessage(currentConversationId, promptText, options);

      // 3. Replace loading dots with formatted response
      const bodyEl = assistantTurn.querySelector('.turn-body');
      bodyEl.innerHTML = parseMarkdownToHtml(response.response);
      attachCodeCopyButtons(bodyEl);

      // Add actions toolbar
      const contentWrap = assistantTurn.querySelector('.turn-content-wrap');
      const actionsToolbar = createTurnActionsToolbar(response.response);
      contentWrap.appendChild(actionsToolbar);

      scrollToBottom();

      // Refresh sidebar list to reflect new preview & sorting
      await refreshConversations();
    } catch (err) {
      console.error('Error sending message:', err);
      const bodyEl = assistantTurn.querySelector('.turn-body');
      bodyEl.innerHTML = `<div class="error-msg-box">⚠️ <strong>Error generating response:</strong> ${escapeHtml(err.message)}<br><small>Check your Gemini API Key in Settings ⚙️</small></div>`;
      scrollToBottom();
    }
  }

  // ==========================================
  // ATTACH SCREENSHOT VISION
  // ==========================================
  async function handleAttachScreenshot() {
    try {
      showToast('Capturing active screen...', 'info');
      const res = await window.chatAPI.takeScreenshot();
      if (res && res.dataUrl) {
        attachedScreenshot = res.dataUrl;
        renderAttachedScreenBadge();
        showToast('Active desktop screen attached for vision analysis!', 'success');
      } else {
        showToast('No screen capture returned', 'error');
      }
    } catch (err) {
      console.error('Attach screen error:', err);
      showToast('Failed to capture screen: ' + err.message, 'error');
    }
  }

  function renderAttachedScreenBadge() {
    removeAttachedScreenBadge();

    const badge = document.createElement('div');
    badge.id = 'screen-attachment-badge';
    badge.className = 'attachment-pill-badge';
    badge.innerHTML = `
      <span class="badge-icon">📸</span>
      <span class="badge-text">Desktop Screen Attached</span>
      <button class="badge-remove-btn" title="Remove attachment">✕</button>
    `;

    badge.querySelector('.badge-remove-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      attachedScreenshot = null;
      removeAttachedScreenBadge();
    });

    const targetContainer = emptyStateView.classList.contains('hidden')
      ? document.querySelector('.main-bottom-pill')
      : document.querySelector('.empty-input-wrapper');

    if (targetContainer) {
      targetContainer.prepend(badge);
    }
  }

  function removeAttachedScreenBadge() {
    const existing = document.getElementById('screen-attachment-badge');
    if (existing) existing.remove();
  }

  // ==========================================
  // SPEECH-TO-TEXT (VOICE INPUT)
  // ==========================================
  function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported in this runtime.');
      return;
    }

    speechRecognition = new SpeechRecognition();
    speechRecognition.continuous = false;
    speechRecognition.interimResults = true;
    speechRecognition.lang = 'en-US';

    speechRecognition.onstart = () => {
      isVoiceRecording = true;
      updateMicButtonsState(true);
      showToast('Listening... speak now', 'info');
    };

    speechRecognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      const activeInput = emptyStateView.classList.contains('hidden') ? mainTextarea : emptyMainInput;
      activeInput.value = transcript;
      adjustTextareaHeight(mainTextarea);
    };

    speechRecognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      isVoiceRecording = false;
      updateMicButtonsState(false);
      showToast('Voice input error: ' + event.error, 'error');
    };

    speechRecognition.onend = () => {
      isVoiceRecording = false;
      updateMicButtonsState(false);
    };
  }

  function toggleVoiceInput() {
    if (!speechRecognition) {
      showToast('Speech recognition is not supported on this device/runtime.', 'error');
      return;
    }

    if (isVoiceRecording) {
      speechRecognition.stop();
    } else {
      try {
        speechRecognition.start();
      } catch (err) {
        console.warn('Could not start recognition:', err);
      }
    }
  }

  function updateMicButtonsState(recording) {
    [emptyMicBtn, bottomMicBtn].forEach(btn => {
      if (recording) {
        btn.classList.add('recording');
      } else {
        btn.classList.remove('recording');
      }
    });
  }

  // ==========================================
  // SETTINGS & API KEYS MODAL
  // ==========================================
  async function loadInitialSettings() {
    try {
      const keys = await window.chatAPI.getApiKeys();
      if (keys) {
        if (keys.GEMINI_API_KEY) {
          inputGeminiKey.value = keys.GEMINI_API_KEY;
          geminiStatusBadge.textContent = 'Configured';
          geminiStatusBadge.className = 'status-badge configured';
        } else {
          geminiStatusBadge.textContent = 'Missing';
          geminiStatusBadge.className = 'status-badge missing';
        }
        if (keys.GOOGLE_TTS_API_KEY) inputTtsKey.value = keys.GOOGLE_TTS_API_KEY;
        if (keys.ASSEMBLYAI_API_KEY) inputAssemblyKey.value = keys.ASSEMBLYAI_API_KEY;
        if (keys.GEMINI_MODEL || keys.geminiModel) {
          currentModel = keys.GEMINI_MODEL || keys.geminiModel;
          localStorage.setItem('chat_reasoning_model', currentModel);
          updateModelSelectorLabel(currentModel);
        }
      }
    } catch (err) {
      console.warn('Could not load api keys initially:', err);
    }
  }

  function openSettingsModal() {
    settingsModal.classList.remove('hidden');
    loadInitialSettings();
    updateDataStats();
  }

  function closeSettingsModal() {
    settingsModal.classList.add('hidden');
    geminiTestResult.classList.add('hidden');
    geminiTestResult.textContent = '';
    settingsSaveStatus.textContent = '';
  }

  async function testGeminiConnection() {
    const key = inputGeminiKey.value.trim();
    if (!key) {
      geminiTestResult.className = 'test-result-msg error';
      geminiTestResult.textContent = 'Please enter a Gemini API key first.';
      geminiTestResult.classList.remove('hidden');
      return;
    }

    btnTestGemini.disabled = true;
    btnTestGemini.textContent = 'Testing...';
    geminiTestResult.className = 'test-result-msg info';
    geminiTestResult.textContent = 'Connecting to Google Gemini API...';
    geminiTestResult.classList.remove('hidden');

    try {
      const res = await window.chatAPI.testGeminiKey(key);
      if (res && res.success) {
        geminiTestResult.className = 'test-result-msg success';
        geminiTestResult.textContent = `✓ Gemini connected successfully! Model responded: "${res.modelResponse}"`;
        geminiStatusBadge.textContent = 'Active';
        geminiStatusBadge.className = 'status-badge configured';
      } else {
        geminiTestResult.className = 'test-result-msg error';
        geminiTestResult.textContent = `✗ Connection failed: ${res.error || 'Unknown error'}`;
      }
    } catch (err) {
      geminiTestResult.className = 'test-result-msg error';
      geminiTestResult.textContent = `✗ Connection test error: ${err.message}`;
    } finally {
      btnTestGemini.disabled = false;
      btnTestGemini.textContent = 'Test Connection';
    }
  }

  async function saveSettings() {
    try {
      btnSaveSettings.disabled = true;
      btnSaveSettings.textContent = 'Saving...';

      // Determine active reasoning model from Settings
      const selectedModel = selectReasoningModel?.value || selectDefaultModel?.value || currentModel;
      currentModel = selectedModel;
      localStorage.setItem('chat_reasoning_model', currentModel);
      updateModelSelectorLabel(currentModel);

      // 1. Save API Keys and active model to environment
      const keys = {
        GEMINI_API_KEY: inputGeminiKey.value.trim(),
        GEMINI_MODEL: currentModel,
        GOOGLE_TTS_API_KEY: inputTtsKey.value.trim(),
        ASSEMBLYAI_API_KEY: inputAssemblyKey.value.trim()
      };
      await window.chatAPI.saveApiKeys(keys);

      // 2. Save Personalization
      const newName = inputUserName.value.trim();
      if (newName) {
        userName = newName;
        localStorage.setItem('chat_user_name', userName);
        setupUserProfile();
      }

      showToast(`Settings & Reasoning Model (${MODEL_LABELS[currentModel] || currentModel}) saved!`, 'success');
      setTimeout(() => {
        closeSettingsModal();
      }, 600);
    } catch (err) {
      console.error('Save settings error:', err);
      showToast('Failed to save settings: ' + err.message, 'error');
    } finally {
      btnSaveSettings.disabled = false;
      btnSaveSettings.textContent = 'Save Changes';
    }
  }

  function updateDataStats() {
    statsChatCount.textContent = conversations.length;
    let totalMessages = 0;
    conversations.forEach(c => {
      totalMessages += (c.messages || []).length;
    });
    statsMsgCount.textContent = totalMessages;
  }

  function exportChatsJson() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(conversations, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `chatgpt_pointy_history_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Chats exported to JSON file', 'info');
  }

  async function clearAllChats() {
    if (confirm('Are you sure you want to delete ALL stored chat history? This cannot be undone.')) {
      try {
        await window.chatAPI.clearAllConversations();
        conversations = [];
        startNewChat();
        updateDataStats();
        showToast('All chat history cleared', 'info');
      } catch (err) {
        showToast('Failed to clear chats: ' + err.message, 'error');
      }
    }
  }

  // ==========================================
  // POINTY SPATIAL COMPANION
  // ==========================================
  async function checkPointyOverlayStatus() {
    try {
      const active = await window.chatAPI.isOverlayActive();
      updatePointyButtonState(active);
    } catch (err) {
      console.warn('Could not check pointy overlay status:', err);
    }
  }

  async function togglePointyCompanionAction() {
    try {
      const newStatus = await window.chatAPI.toggleOverlay();
      updatePointyButtonState(newStatus);
      showToast(newStatus ? 'Pointy spatial companion activated on desktop!' : 'Pointy companion hidden', 'info');
    } catch (err) {
      console.warn('Toggle pointy error:', err);
    }
  }

  function updatePointyButtonState(active) {
    if (active) {
      btnTogglePointy.classList.add('active');
      pointyStatusText.textContent = 'Pointy: Active';
    } else {
      btnTogglePointy.classList.remove('active');
      pointyStatusText.textContent = 'Pointy: Off';
    }
  }

  // ==========================================
  // UI UTILITIES & EVENT LISTENERS
  // ==========================================
  function setupEventListeners() {
    // Sidebar toggle (collapse / expand)
    btnToggleSidebar.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      btnSidebarCollapseToggle.classList.toggle('hidden', !sidebar.classList.contains('collapsed'));
    });

    btnSidebarCollapseToggle.addEventListener('click', () => {
      sidebar.classList.remove('collapsed');
      btnSidebarCollapseToggle.classList.add('hidden');
    });

    // New Chat
    btnNewChat.addEventListener('click', startNewChat);

    // Search filter toggle
    btnSearchChats.addEventListener('click', () => {
      searchFilterBox.classList.toggle('hidden');
      if (!searchFilterBox.classList.contains('hidden')) {
        chatSearchInput.focus();
      }
    });

    chatSearchInput.addEventListener('input', () => {
      renderSidebarConversations();
    });

    btnClearSearch.addEventListener('click', () => {
      chatSearchInput.value = '';
      renderSidebarConversations();
      searchFilterBox.classList.add('hidden');
    });

    // Model Dropdown Selector
    btnModelSelector.addEventListener('click', (e) => {
      e.stopPropagation();
      modelDropdownMenu.classList.toggle('hidden');
    });

    document.querySelectorAll('.model-menu .menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const selectedModel = item.dataset.model;
        currentModel = selectedModel;
        updateModelSelectorLabel(currentModel);
        modelDropdownMenu.classList.add('hidden');
        localStorage.setItem('chat_reasoning_model', currentModel);
        window.chatAPI.saveApiKeys({ GEMINI_MODEL: currentModel }).catch(() => {});
        showToast(`Reasoning model: ${MODEL_LABELS[currentModel] || currentModel}`, 'info');
      });
    });

    if (selectReasoningModel) {
      selectReasoningModel.addEventListener('change', () => {
        currentModel = selectReasoningModel.value;
        updateModelSelectorLabel(currentModel);
      });
    }

    if (selectDefaultModel) {
      selectDefaultModel.addEventListener('change', () => {
        currentModel = selectDefaultModel.value;
        updateModelSelectorLabel(currentModel);
      });
    }

    document.addEventListener('click', (e) => {
      if (!btnModelSelector.contains(e.target) && !modelDropdownMenu.contains(e.target)) {
        modelDropdownMenu.classList.add('hidden');
      }
    });

    // Pointy Companion Button
    btnTogglePointy.addEventListener('click', togglePointyCompanionAction);

    // Empty Screen Input Handlers
    emptyMainInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSendMessage(emptyMainInput);
      }
    });

    emptySendBtn.addEventListener('click', () => handleSendMessage(emptyMainInput));
    emptyAttachBtn.addEventListener('click', handleAttachScreenshot);
    emptyMicBtn.addEventListener('click', toggleVoiceInput);

    emptyThinkBtn.addEventListener('click', () => {
      isThinkMode = !isThinkMode;
      updateThinkButtons();
    });

    // Bottom Sticky Input Handlers
    mainTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage(mainTextarea);
      }
    });

    mainTextarea.addEventListener('input', () => {
      adjustTextareaHeight(mainTextarea);
    });

    mainSendBtn.addEventListener('click', () => handleSendMessage(mainTextarea));
    bottomAttachBtn.addEventListener('click', handleAttachScreenshot);
    bottomMicBtn.addEventListener('click', toggleVoiceInput);

    bottomThinkBtn.addEventListener('click', () => {
      isThinkMode = !isThinkMode;
      updateThinkButtons();
    });

    // Suggestion starter prompt chips
    document.querySelectorAll('.prompt-chips .chip-btn').forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.dataset.prompt;
        emptyMainInput.value = prompt;
        handleSendMessage(emptyMainInput);
      });
    });

    // Settings Modal Open / Close
    btnOpenSettings.addEventListener('click', openSettingsModal);
    btnHeaderSettings.addEventListener('click', openSettingsModal);
    btnCloseSettings.addEventListener('click', closeSettingsModal);
    btnCancelSettings.addEventListener('click', closeSettingsModal);
    btnSaveSettings.addEventListener('click', saveSettings);
    btnTestGemini.addEventListener('click', testGeminiConnection);
    btnExportChats.addEventListener('click', exportChatsJson);
    btnClearAllChats.addEventListener('click', clearAllChats);

    // Settings Modal Tabs
    modalTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        modalTabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const targetTab = document.getElementById(tab.dataset.tab);
        if (targetTab) targetTab.classList.add('active');
      });
    });

    // Show/Hide password toggle buttons in Settings
    document.querySelectorAll('.toggle-visibility-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const inputId = btn.dataset.target;
        const targetInput = document.getElementById(inputId);
        if (targetInput) {
          if (targetInput.type === 'password') {
            targetInput.type = 'text';
            btn.textContent = '🔒';
          } else {
            targetInput.type = 'password';
            btn.textContent = '👁️';
          }
        }
      });
    });

    // Close modal on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !settingsModal.classList.contains('hidden')) {
        closeSettingsModal();
      }
    });
  }

  function updateModelSelectorLabel(model) {
    const label = MODEL_LABELS[model] || model;
    if (currentModelName) currentModelName.textContent = label;

    document.querySelectorAll('.model-menu .menu-item').forEach(m => {
      m.classList.toggle('active', m.dataset.model === model);
    });

    if (selectReasoningModel && selectReasoningModel.value !== model) {
      selectReasoningModel.value = model;
    }
    if (selectDefaultModel && selectDefaultModel.value !== model) {
      selectDefaultModel.value = model;
    }
    if (modelBadgePreview) {
      modelBadgePreview.textContent = label;
    }
  }

  function updateThinkButtons() {
    [emptyThinkBtn, bottomThinkBtn].forEach(btn => {
      if (isThinkMode) {
        btn.classList.add('active');
        btn.setAttribute('title', 'Thinking Mode: Enabled (Deep multi-step reasoning)');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('title', 'Toggle Thinking Reasoning');
      }
    });
    if (isThinkMode) {
      showToast('Reasoning "Think" mode active', 'info');
    }
  }

  function adjustTextareaHeight(textarea) {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 180);
    textarea.style.height = `${newHeight}px`;
  }

  function showToast(message, type = 'info') {
    toastEl.textContent = message;
    toastEl.className = `toast ${type}`;
    toastEl.classList.remove('hidden');

    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 3200);
  }

  // Kickstart on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

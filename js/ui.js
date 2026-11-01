/**
 * MeshChat - User Interface Controller
 * Renders the Pastel Rose WhatsApp design system.
 * Handles navigation, conversation list, active chat, message composer,
 * friend search, settings, and profile modals.
 */

import { auth } from './auth.js';
import { users } from './users.js';
import { chat } from './chat.js';
import { storage } from './storage.js';
import { signaling } from './signaling.js';
import { webrtc } from './webrtc.js';
import {
  escapeHtml,
  formatMessageTime,
  formatConversationTime,
  formatFileSize,
  validateUsername,
} from './utils.js';

// Pre-defined pastel avatar SVG illustrations
export const AVATAR_PRESETS = [
  { id: 'avatar_1', color: '#FFCED8', icon: '🌸', name: 'Blossom' },
  { id: 'avatar_2', color: '#FFE8C4', icon: '🦊', name: 'Peach' },
  { id: 'avatar_3', color: '#FFDDDD', icon: '🐰', name: 'Blush' },
  { id: 'avatar_4', color: '#E2F0D9', icon: '🍃', name: 'Mint' },
  { id: 'avatar_5', color: '#E8DAEF', icon: '💜', name: 'Lilac' },
  { id: 'avatar_6', color: '#D6EAF8', icon: '☁️', name: 'Sky' },
];

export function getAvatarConfig(avatarId) {
  return AVATAR_PRESETS.find((a) => a.id === avatarId) || AVATAR_PRESETS[0];
}

export function renderAvatarSvg(avatarId, size = 44) {
  const conf = getAvatarConfig(avatarId);
  return `
    <div class="user-avatar" style="width: ${size}px; height: ${size}px; background-color: ${conf.color};" title="${conf.name}">
      <span>${conf.icon}</span>
    </div>
  `;
}

class UIManager {
  constructor() {
    this.currentView = 'chats'; // 'chats' | 'contacts' | 'settings'
    this.searchDebounceTimer = null;
    this.typingTimeout = null;
    this.currentFilter = 'all'; // 'all' | 'unread'
    this.pendingAttachment = null;
  }

  init() {
    this.renderApp();
    this.bindGlobalEvents();
    this.checkAuthStatus();
  }

  checkAuthStatus() {
    const user = auth.getCurrentUser();
    if (user) {
      signaling.connect(user.username);
      webrtc.setCurrentUser(user.username);
      this.hideAuthModal();
      this.loadConversations();
      this.updateUserProfileBar();
    } else {
      this.showAuthModal();
    }
  }

  renderApp() {
    const root = document.getElementById('root');
    if (!root) return;

    root.innerHTML = `
      <div class="app-layout" id="appLayout">
        <!-- Main Left Navigation Bar -->
        <nav class="nav-sidebar" aria-label="Main Navigation">
          <div class="nav-top">
            <div class="brand-logo" title="MeshChat">
              <img src="/assets/logo.svg" alt="MeshChat Logo" width="34" height="34" />
            </div>
            <button class="nav-btn active" id="navChatsBtn" title="Chats" aria-label="Chats">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </button>
            <button class="nav-btn" id="navContactsBtn" title="Contacts" aria-label="Contacts">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </button>
            <button class="nav-btn" id="navNewChatBtn" title="Find Friends" aria-label="New Chat">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="11" y1="8" x2="11" y2="14"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </button>
            <button class="nav-btn" id="navSettingsBtn" title="Settings" aria-label="Settings">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
          </div>
          <div class="nav-bottom">
            <button class="nav-avatar-btn" id="navProfileBtn" title="My Profile" aria-label="Profile">
              <div id="navUserAvatarSlot"></div>
            </button>
          </div>
        </nav>

        <!-- Conversation Sidebar -->
        <aside class="conv-sidebar" id="convSidebar">
          <div class="sidebar-header">
            <div class="sidebar-title-row">
              <h1 class="sidebar-title">Chats</h1>
              <div class="sidebar-actions">
                <button class="icon-action-btn" id="sidebarNewChatBtn" title="Find your people" aria-label="New Chat">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Search Field -->
            <div class="search-box">
              <span class="search-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </span>
              <input
                type="text"
                id="convSearchInput"
                class="search-input"
                placeholder="Find your people..."
                aria-label="Search conversations or users"
                autocomplete="off"
              />
              <button class="search-clear-btn" id="searchClearBtn" style="display: none;" title="Clear search">✕</button>
            </div>

            <!-- Filter tabs -->
            <div class="filter-tabs">
              <button class="filter-tab active" data-filter="all" id="filterAllBtn">All</button>
              <button class="filter-tab" data-filter="unread" id="filterUnreadBtn">Unread</button>
            </div>
          </div>

          <!-- Conversation List -->
          <div class="conv-list" id="convList" role="list">
            <div class="empty-state">
              <div class="empty-icon">💬</div>
              <p class="empty-title">Your conversations start here.</p>
              <button class="btn btn-primary" id="emptyFindFriendBtn">Find a friend</button>
            </div>
          </div>
        </aside>

        <!-- Main Chat Area -->
        <main class="chat-main" id="chatMain">
          <!-- Active Chat Container -->
          <div class="chat-container" id="chatContainer" style="display: none;">
            <!-- Chat Header -->
            <header class="chat-header" id="chatHeader">
              <div class="chat-header-left">
                <button class="back-btn" id="chatBackBtn" title="Back to conversations" aria-label="Back">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                  </svg>
                </button>
                <div class="chat-contact-avatar" id="chatContactAvatar"></div>
                <div class="chat-contact-info">
                  <h2 class="chat-contact-name" id="chatContactName">Contact Name</h2>
                  <div class="chat-connection-status" id="chatConnectionStatus">
                    <span class="status-dot"></span>
                    <span class="status-label">Direct WebRTC</span>
                  </div>
                </div>
              </div>
              <div class="chat-header-actions">
                <button class="icon-btn" id="chatVoiceCallBtn" title="Audio Call via WebRTC" aria-label="Call">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                  </svg>
                </button>
                <button class="icon-btn" id="chatVideoCallBtn" title="Video Call via WebRTC" aria-label="Video Call">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="23 7 16 12 23 17 23 7"></polygon>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                  </svg>
                </button>
                <button class="icon-btn" id="chatInfoBtn" title="Conversation Details" aria-label="Conversation Info">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </button>
              </div>
            </header>

            <!-- Message History -->
            <div class="chat-messages" id="chatMessages" role="log" aria-live="polite">
              <!-- Messages injected here -->
            </div>

            <!-- Typing indicator bubble -->
            <div class="typing-container" id="typingContainer" style="display: none;">
              <div class="typing-bubble">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-label" id="typingLabel">is typing...</span>
              </div>
            </div>

            <!-- Attachment preview strip -->
            <div class="attachment-preview" id="attachmentPreview" style="display: none;">
              <div class="attachment-preview-content">
                <span class="attachment-icon">📎</span>
                <span class="attachment-filename" id="attachmentFileName">file.png</span>
                <span class="attachment-filesize" id="attachmentFileSize">120 KB</span>
              </div>
              <button class="attachment-remove-btn" id="attachmentRemoveBtn" title="Remove attachment">✕</button>
            </div>

            <!-- Message Composer -->
            <footer class="chat-composer" id="chatComposer">
              <input type="file" id="fileInput" style="display: none;" />
              <button class="composer-icon-btn" id="attachmentBtn" title="Attach image or file" aria-label="Attach File">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
              </button>
              
              <div class="emoji-picker-anchor">
                <button class="composer-icon-btn" id="emojiToggleBtn" title="Insert Emoji" aria-label="Insert Emoji">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                    <line x1="9" y1="9" x2="9.01" y2="9"></line>
                    <line x1="15" y1="9" x2="15.01" y2="9"></line>
                  </svg>
                </button>
                <div class="emoji-picker-popover" id="emojiPicker" style="display: none;">
                  <div class="emoji-grid">
                    ${['😊', '❤️', '👍', '😂', '🎉', '✨', '🔥', '🌸', '🙌', '💬', '👀', '😍', '👏', '🌟', '☕', '🎂', '🥳', '💌'].map(
                      (e) => `<button class="emoji-btn" data-emoji="${e}">${e}</button>`
                    ).join('')}
                  </div>
                </div>
              </div>

              <div class="composer-input-wrapper">
                <textarea
                  id="messageInput"
                  class="composer-textarea"
                  placeholder="Type a message..."
                  rows="1"
                  aria-label="Message Input"
                ></textarea>
              </div>

              <button class="composer-send-btn" id="sendBtn" title="Send message (Enter)" aria-label="Send Message" disabled>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </footer>
          </div>

          <!-- Empty Splash State (No Active Conversation) -->
          <div class="chat-placeholder" id="chatPlaceholder">
            <div class="placeholder-card">
              <div class="placeholder-logo">
                <img src="/assets/logo.svg" alt="MeshChat" width="64" height="64" />
              </div>
              <h2 class="placeholder-title">Your people. Your conversations.</h2>
              <p class="placeholder-subtitle">
                Connect with friends and share conversations in real time via WebRTC peer-to-peer.
              </p>
              <div class="placeholder-badges">
                <span class="badge">Direct P2P DataChannels</span>
                <span class="badge">Local IndexedDB</span>
                <span class="badge">Vercel Signaling</span>
              </div>
              <button class="btn btn-primary" id="placeholderFindBtn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                Find your people...
              </button>
            </div>
          </div>
        </main>
      </div>

      <!-- Modals Container -->
      <div id="modalOverlay" class="modal-overlay" style="display: none;">
        <div class="modal-card" id="modalCard"></div>
      </div>
    `;

    // Initialize Theme
    const savedTheme = storage.getPreference('theme', 'light');
    document.body.setAttribute('data-theme', savedTheme);
  }

  updateUserProfileBar() {
    const user = auth.getCurrentUser();
    const slot = document.getElementById('navUserAvatarSlot');
    if (!slot) return;
    if (user) {
      slot.innerHTML = renderAvatarSvg(user.avatar, 36);
    } else {
      slot.innerHTML = `<div class="user-avatar" style="width: 36px; height: 36px; background-color: #FFDDDD;">👤</div>`;
    }
  }

  // Bind UI Events
  bindGlobalEvents() {
    // Nav sidebar buttons
    document.getElementById('navChatsBtn')?.addEventListener('click', () => {
      this.switchNavView('chats');
    });

    document.getElementById('navContactsBtn')?.addEventListener('click', () => {
      this.openContactsModal();
    });

    document.getElementById('navNewChatBtn')?.addEventListener('click', () => {
      this.openSearchModal();
    });

    document.getElementById('navSettingsBtn')?.addEventListener('click', () => {
      this.openSettingsModal();
    });

    document.getElementById('navProfileBtn')?.addEventListener('click', () => {
      this.openProfileModal();
    });

    document.getElementById('sidebarNewChatBtn')?.addEventListener('click', () => {
      this.openSearchModal();
    });

    document.getElementById('placeholderFindBtn')?.addEventListener('click', () => {
      this.openSearchModal();
    });

    document.getElementById('emptyFindFriendBtn')?.addEventListener('click', () => {
      this.openSearchModal();
    });

    // Mobile back button
    document.getElementById('chatBackBtn')?.addEventListener('click', () => {
      document.getElementById('appLayout')?.classList.remove('mobile-chat-active');
      chat.setActiveContact(null);
    });

    // Conversation Search Input
    const searchInput = document.getElementById('convSearchInput');
    const clearBtn = document.getElementById('searchClearBtn');

    searchInput?.addEventListener('input', (e) => {
      const q = e.target.value;
      if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => {
        this.filterConversations(q);
      }, 150);
    });

    clearBtn?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      clearBtn.style.display = 'none';
      this.filterConversations('');
    });

    // Filter Tabs
    document.getElementById('filterAllBtn')?.addEventListener('click', (e) => {
      this.setFilter('all', e.target);
    });
    document.getElementById('filterUnreadBtn')?.addEventListener('click', (e) => {
      this.setFilter('unread', e.target);
    });

    // Composer interactions
    const msgInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');

    msgInput?.addEventListener('input', () => {
      // Auto-expand textarea height
      msgInput.style.height = 'auto';
      msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + 'px';

      const hasText = msgInput.value.trim().length > 0 || !!this.pendingAttachment;
      if (sendBtn) sendBtn.disabled = !hasText;

      // Handle typing indicator
      chat.sendTypingStatus(true);
      clearTimeout(this.typingTimeout);
      this.typingTimeout = setTimeout(() => {
        chat.sendTypingStatus(false);
      }, 1500);

      // Save draft
      const active = chat.getActiveContact();
      if (active) {
        storage.saveDraft(active.username, msgInput.value);
      }
    });

    msgInput?.addEventListener('keydown', (e) => {
      const enterToSend = storage.getPreference('enterToSend', true);
      if (e.key === 'Enter' && !e.shiftKey && enterToSend) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    sendBtn?.addEventListener('click', () => {
      this.handleSendMessage();
    });

    // Emoji Picker toggle
    const emojiToggleBtn = document.getElementById('emojiToggleBtn');
    const emojiPicker = document.getElementById('emojiPicker');

    emojiToggleBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = emojiPicker.style.display === 'block';
      emojiPicker.style.display = isVisible ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
      if (emojiPicker && !emojiPicker.contains(e.target) && e.target !== emojiToggleBtn) {
        emojiPicker.style.display = 'none';
      }
    });

    emojiPicker?.addEventListener('click', (e) => {
      const btn = e.target.closest('.emoji-btn');
      if (btn) {
        const emoji = btn.dataset.emoji;
        if (msgInput) {
          msgInput.value += emoji;
          msgInput.dispatchEvent(new Event('input'));
          msgInput.focus();
        }
      }
    });

    // File attachments
    const attachmentBtn = document.getElementById('attachmentBtn');
    const fileInput = document.getElementById('fileInput');

    attachmentBtn?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      this.handleFileSelected(file);
    });

    document.getElementById('attachmentRemoveBtn')?.addEventListener('click', () => {
      this.clearPendingAttachment();
    });

    // Conversation Details / Info
    document.getElementById('chatInfoBtn')?.addEventListener('click', () => {
      this.openChatInfoModal();
    });

    // Listen to chat manager events
    chat.on('messageAdded', (msg) => this.handleMessageAdded(msg));
    chat.on('messageStatusUpdated', (data) => this.handleMessageStatusUpdated(data));
    chat.on('conversationUpdated', (conv) => this.handleConversationUpdated(conv));
    chat.on('activeContactChanged', (contact) => this.renderActiveContact(contact));
    chat.on('typingChanged', (data) => this.handleTypingChanged(data));
    chat.on('connectionChange', (data) => this.handleConnectionChange(data));

    // Auth events
    auth.onChange((user) => {
      this.updateUserProfileBar();
      if (!user) {
        this.showAuthModal();
      }
    });
  }

  switchNavView(view) {
    this.currentView = view;
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    if (view === 'chats') {
      document.getElementById('navChatsBtn')?.classList.add('active');
    }
  }

  setFilter(filter, buttonEl) {
    this.currentFilter = filter;
    document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
    buttonEl?.classList.add('active');
    this.loadConversations();
  }

  // --- Conversations Management ---

  async loadConversations() {
    const list = await storage.getAllConversations();
    const container = document.getElementById('convList');
    if (!container) return;

    let filtered = list;
    if (this.currentFilter === 'unread') {
      filtered = list.filter((c) => (c.unreadCount || 0) > 0);
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <p class="empty-title">Your conversations start here.</p>
          <button class="btn btn-primary" id="emptyFindBtn2">Find a friend</button>
        </div>
      `;
      document.getElementById('emptyFindBtn2')?.addEventListener('click', () => this.openSearchModal());
      return;
    }

    container.innerHTML = '';
    const active = chat.getActiveContact();

    for (const conv of filtered) {
      const item = document.createElement('div');
      item.className = `conv-item ${active && active.username === conv.contactUsername ? 'active' : ''}`;
      item.id = `conv_${conv.contactUsername}`;
      item.setAttribute('role', 'listitem');
      item.setAttribute('tabindex', '0');

      const avatarHtml = renderAvatarSvg(conv.contactAvatar, 44);
      const isOnline = webrtc.getConnectionStatus(conv.contactUsername) === 'connected';

      item.innerHTML = `
        <div class="conv-avatar-wrapper">
          ${avatarHtml}
          <span class="online-dot ${isOnline ? 'online' : ''}" id="dot_${conv.contactUsername}"></span>
        </div>
        <div class="conv-details">
          <div class="conv-row-top">
            <span class="conv-name">${escapeHtml(conv.contactDisplayName || conv.contactUsername)}</span>
            <span class="conv-time">${formatConversationTime(conv.lastTimestamp)}</span>
          </div>
          <div class="conv-row-bottom">
            <span class="conv-snippet">${escapeHtml(conv.lastMessage || 'Say hello!')}</span>
            ${conv.unreadCount > 0 ? `<span class="unread-badge">${conv.unreadCount}</span>` : ''}
          </div>
        </div>
      `;

      item.addEventListener('click', () => {
        this.openConversation(conv.contactUsername, conv.contactDisplayName, conv.contactAvatar);
      });

      container.appendChild(item);
    }
  }

  async filterConversations(query) {
    const container = document.getElementById('convList');
    if (!container) return;

    if (!query) {
      this.loadConversations();
      return;
    }

    const q = query.toLowerCase();
    const items = container.querySelectorAll('.conv-item');
    let hasMatch = false;

    items.forEach((item) => {
      const text = item.textContent.toLowerCase();
      if (text.includes(q)) {
        item.style.display = 'flex';
        hasMatch = true;
      } else {
        item.style.display = 'none';
      }
    });

    if (!hasMatch) {
      // Check if we should suggest searching registered users
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-search-state';
      emptyDiv.innerHTML = `
        <p>No chat found for "${escapeHtml(query)}"</p>
        <button class="btn btn-secondary" id="searchRegisteredBtn">Search all users</button>
      `;
      container.prepend(emptyDiv);
      document.getElementById('searchRegisteredBtn')?.addEventListener('click', () => {
        this.openSearchModal(query);
      });
    }
  }

  async openConversation(username, displayName, avatar) {
    const contact = {
      username: username.toLowerCase(),
      displayName: displayName || username,
      avatar: avatar || 'avatar_1',
    };

    // Update active highlight
    document.querySelectorAll('.conv-item').forEach((i) => i.classList.remove('active'));
    document.getElementById(`conv_${contact.username}`)?.classList.add('active');

    // On mobile, show chat screen
    document.getElementById('appLayout')?.classList.add('mobile-chat-active');

    await chat.setActiveContact(contact);
  }

  renderActiveContact(contact) {
    const placeholder = document.getElementById('chatPlaceholder');
    const container = document.getElementById('chatContainer');
    if (!contact) {
      if (placeholder) placeholder.style.display = 'flex';
      if (container) container.style.display = 'none';
      return;
    }

    if (placeholder) placeholder.style.display = 'none';
    if (container) container.style.display = 'flex';

    // Header info
    const nameEl = document.getElementById('chatContactName');
    const avatarEl = document.getElementById('chatContactAvatar');
    if (nameEl) nameEl.textContent = contact.displayName || contact.username;
    if (avatarEl) avatarEl.innerHTML = renderAvatarSvg(contact.avatar, 40);

    // Update connection status
    this.updateChatConnectionBadge(contact.username);

    // Load message history
    this.loadMessageHistory(contact.username);

    // Restore draft
    storage.getDraft(contact.username).then((draft) => {
      const input = document.getElementById('messageInput');
      const sendBtn = document.getElementById('sendBtn');
      if (input) {
        input.value = draft || '';
        input.style.height = 'auto';
        if (draft) input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        if (sendBtn) sendBtn.disabled = !draft;
        input.focus();
      }
    });
  }

  updateChatConnectionBadge(peer) {
    const badge = document.getElementById('chatConnectionStatus');
    if (!badge) return;

    const status = webrtc.getConnectionStatus(peer);
    const dot = badge.querySelector('.status-dot');
    const label = badge.querySelector('.status-label');

    if (status === 'connected') {
      dot?.classList.remove('connecting', 'failed');
      dot?.classList.add('connected');
      if (label) label.textContent = 'Direct WebRTC DataChannel';
    } else if (status === 'connecting' || status === 'reconnecting') {
      dot?.classList.remove('connected', 'failed');
      dot?.classList.add('connecting');
      if (label) label.textContent = 'Connecting WebRTC...';
    } else {
      dot?.classList.remove('connected', 'connecting');
      dot?.classList.add('failed');
      if (label) label.textContent = 'Offline (Signaling Standby)';
    }
  }

  async loadMessageHistory(peer) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    container.innerHTML = '';

    const messages = await storage.getMessages(peer);
    for (const msg of messages) {
      this.appendMessageElement(msg, false);
    }
    this.scrollToBottom();
  }

  appendMessageElement(msg, shouldScroll = true) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const isOutgoing = msg.isOutgoing;
    const bubble = document.createElement('div');
    bubble.className = `message-row ${isOutgoing ? 'outgoing' : 'incoming'}`;
    bubble.id = `msg_${msg.id}`;

    // Delivery status checkmark icon
    let statusIcon = '';
    if (isOutgoing) {
      if (msg.status === 'sending') {
        statusIcon = `<span class="msg-status status-sending" title="Sending...">🕒</span>`;
      } else if (msg.status === 'sent') {
        statusIcon = `<span class="msg-status status-sent" title="Sent">✓</span>`;
      } else if (msg.status === 'delivered') {
        statusIcon = `<span class="msg-status status-delivered" title="Delivered">✓✓</span>`;
      } else if (msg.status === 'read') {
        statusIcon = `<span class="msg-status status-read" title="Read">✓✓</span>`;
      } else if (msg.status === 'failed') {
        statusIcon = `<span class="msg-status status-failed" title="Failed">⚠️</span>`;
      }
    }

    let fileHtml = '';
    if (msg.file) {
      if (msg.file.mimeType && msg.file.mimeType.startsWith('image/') && msg.file.dataUrl) {
        fileHtml = `
          <div class="message-image-preview">
            <img src="${msg.file.dataUrl}" alt="${escapeHtml(msg.file.name)}" loading="lazy" />
          </div>
        `;
      } else {
        fileHtml = `
          <div class="message-file-card">
            <span class="file-icon">📄</span>
            <div class="file-details">
              <span class="file-name">${escapeHtml(msg.file.name)}</span>
              <span class="file-size">${formatFileSize(msg.file.size)}</span>
            </div>
            ${
              msg.file.dataUrl
                ? `<a href="${msg.file.dataUrl}" download="${escapeHtml(msg.file.name)}" class="file-download-btn" title="Download">⬇️</a>`
                : ''
            }
          </div>
        `;
      }
    }

    bubble.innerHTML = `
      <div class="message-bubble ${isOutgoing ? 'bubble-outgoing' : 'bubble-incoming'}">
        ${fileHtml}
        ${msg.text ? `<p class="message-text">${escapeHtml(msg.text)}</p>` : ''}
        <div class="message-meta">
          <span class="message-time">${formatMessageTime(msg.timestamp)}</span>
          ${statusIcon}
        </div>
      </div>
    `;

    container.appendChild(bubble);
    if (shouldScroll) {
      this.scrollToBottom();
    }
  }

  scrollToBottom() {
    const container = document.getElementById('chatMessages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  // --- Send Message Handler ---

  async handleSendMessage() {
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    if (!input) return;

    const text = input.value.trim();
    const file = this.pendingAttachment;

    if (!text && !file) return;

    input.value = '';
    input.style.height = 'auto';
    if (sendBtn) sendBtn.disabled = true;

    this.clearPendingAttachment();

    // Clear saved draft
    const active = chat.getActiveContact();
    if (active) {
      storage.saveDraft(active.username, '');
    }

    try {
      await chat.sendMessage(text, file);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  }

  handleFileSelected(file) {
    if (file.size > 8 * 1024 * 1024) {
      alert('File is too large. WebRTC P2P max attachment limit is 8 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      this.pendingAttachment = {
        name: file.name,
        size: file.size,
        mimeType: file.type,
        dataUrl: event.target?.result,
      };

      const preview = document.getElementById('attachmentPreview');
      const nameEl = document.getElementById('attachmentFileName');
      const sizeEl = document.getElementById('attachmentFileSize');
      const sendBtn = document.getElementById('sendBtn');

      if (preview && nameEl && sizeEl) {
        nameEl.textContent = file.name;
        sizeEl.textContent = formatFileSize(file.size);
        preview.style.display = 'flex';
      }
      if (sendBtn) sendBtn.disabled = false;
    };
    reader.readAsDataURL(file);
  }

  clearPendingAttachment() {
    this.pendingAttachment = null;
    const preview = document.getElementById('attachmentPreview');
    const fileInput = document.getElementById('fileInput');
    if (preview) preview.style.display = 'none';
    if (fileInput) fileInput.value = '';

    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn && input) {
      sendBtn.disabled = input.value.trim().length === 0;
    }
  }

  handleMessageAdded(msg) {
    const active = chat.getActiveContact();
    if (active && (active.username === msg.sender || active.username === msg.recipient)) {
      this.appendMessageElement(msg, true);
    }
    this.loadConversations();
  }

  handleMessageStatusUpdated(data) {
    const bubble = document.getElementById(`msg_${data.messageId}`);
    if (bubble) {
      const meta = bubble.querySelector('.message-meta');
      const statusEl = meta?.querySelector('.msg-status');
      if (statusEl) {
        if (data.status === 'sent') {
          statusEl.className = 'msg-status status-sent';
          statusEl.textContent = '✓';
          statusEl.title = 'Sent';
        } else if (data.status === 'delivered') {
          statusEl.className = 'msg-status status-delivered';
          statusEl.textContent = '✓✓';
          statusEl.title = 'Delivered';
        } else if (data.status === 'read') {
          statusEl.className = 'msg-status status-read';
          statusEl.textContent = '✓✓';
          statusEl.title = 'Read';
        } else if (data.status === 'failed') {
          statusEl.className = 'msg-status status-failed';
          statusEl.textContent = '⚠️';
          statusEl.title = 'Failed';
        }
      }
    }
  }

  handleConversationUpdated() {
    this.loadConversations();
  }

  handleTypingChanged(data) {
    const active = chat.getActiveContact();
    if (active && active.username === data.peer) {
      const container = document.getElementById('typingContainer');
      const label = document.getElementById('typingLabel');
      if (container && label) {
        if (data.isTyping) {
          label.textContent = `${active.displayName || active.username} is typing...`;
          container.style.display = 'block';
          this.scrollToBottom();
        } else {
          container.style.display = 'none';
        }
      }
    }
  }

  handleConnectionChange(data) {
    const active = chat.getActiveContact();
    if (active && active.username === data.peer) {
      this.updateChatConnectionBadge(data.peer);
    }
    // Update online indicator dot in conversation list
    const dot = document.getElementById(`dot_${data.peer}`);
    if (dot) {
      if (data.status === 'connected') dot.classList.add('online');
      else dot.classList.remove('online');
    }
  }

  // --- Modals ---

  showModal(contentHtml) {
    const overlay = document.getElementById('modalOverlay');
    const card = document.getElementById('modalCard');
    if (!overlay || !card) return;

    card.innerHTML = contentHtml;
    overlay.style.display = 'flex';

    // Close on backdrop click
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        this.hideModal();
      }
    };
  }

  hideModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  // --- Authentication Modal ---

  showAuthModal() {
    let selectedAvatar = 'avatar_1';

    const renderForm = (isRegister = true) => {
      return `
        <div class="auth-modal">
          <div class="auth-header">
            <div class="auth-logo">
              <img src="/assets/logo.svg" alt="MeshChat" width="52" height="52" />
            </div>
            <h2 class="auth-title">Your people. Your conversations.</h2>
            <p class="auth-subtitle">
              Connect with friends and share conversations in real time via WebRTC peer-to-peer.
            </p>
          </div>

          <div class="auth-tabs">
            <button class="auth-tab ${isRegister ? 'active' : ''}" id="tabRegister">Create Account</button>
            <button class="auth-tab ${!isRegister ? 'active' : ''}" id="tabLogin">Sign In</button>
          </div>

          <form id="authForm" class="auth-form" autocomplete="off">
            <div class="form-group">
              <label for="authUsername" class="form-label">Username</label>
              <input
                type="text"
                id="authUsername"
                class="form-input"
                placeholder="e.g. alice_wonder"
                required
                autocomplete="username"
              />
              <span class="form-hint">3-20 characters (lowercase letters, numbers, underscores).</span>
            </div>

            ${
              isRegister
                ? `
              <div class="form-group">
                <label for="authDisplayName" class="form-label">Display Name</label>
                <input
                  type="text"
                  id="authDisplayName"
                  class="form-input"
                  placeholder="e.g. Alice Wonderland"
                  required
                />
              </div>

              <div class="form-group">
                <label class="form-label">Choose Avatar</label>
                <div class="avatar-picker">
                  ${AVATAR_PRESETS.map(
                    (av) => `
                    <button
                      type="button"
                      class="avatar-option ${av.id === selectedAvatar ? 'selected' : ''}"
                      data-avatar="${av.id}"
                      style="background-color: ${av.color};"
                      title="${av.name}"
                    >
                      <span>${av.icon}</span>
                    </button>
                  `
                  ).join('')}
                </div>
              </div>

              <div class="form-group">
                <label for="authBio" class="form-label">About / Bio (optional)</label>
                <input
                  type="text"
                  id="authBio"
                  class="form-input"
                  placeholder="Hey there! I am using MeshChat."
                  maxlength="100"
                />
              </div>
            `
                : ''
            }

            <div id="authError" class="form-error" style="display: none;"></div>

            <button type="submit" class="btn btn-primary btn-block" id="authSubmitBtn">
              ${isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div class="auth-footer-note">
            <p>🔒 WebRTC DataChannels enable end-to-end peer messaging. Your messages are stored in your browser's local IndexedDB.</p>
          </div>
        </div>
      `;
    };

    this.showModal(renderForm(true));

    const bindAuthEvents = (isReg) => {
      document.getElementById('tabRegister')?.addEventListener('click', () => {
        this.showModal(renderForm(true));
        bindAuthEvents(true);
      });

      document.getElementById('tabLogin')?.addEventListener('click', () => {
        this.showModal(renderForm(false));
        bindAuthEvents(false);
      });

      // Avatar picker
      document.querySelectorAll('.avatar-option').forEach((opt) => {
        opt.addEventListener('click', () => {
          document.querySelectorAll('.avatar-option').forEach((o) => o.classList.remove('selected'));
          opt.classList.add('selected');
          selectedAvatar = opt.dataset.avatar;
        });
      });

      // Form submit
      const form = document.getElementById('authForm');
      const errEl = document.getElementById('authError');
      const submitBtn = document.getElementById('authSubmitBtn');

      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        errEl.style.display = 'none';
        submitBtn.disabled = true;

        const username = document.getElementById('authUsername')?.value;
        const displayName = document.getElementById('authDisplayName')?.value;
        const bio = document.getElementById('authBio')?.value;

        try {
          if (isReg) {
            await auth.register({
              username,
              displayName,
              avatar: selectedAvatar,
              bio,
            });
          } else {
            await auth.login(username);
          }

          const user = auth.getCurrentUser();
          signaling.connect(user.username);
          webrtc.setCurrentUser(user.username);
          this.hideModal();
          this.updateUserProfileBar();
          this.loadConversations();
        } catch (err) {
          errEl.textContent = err.message || 'Authentication error';
          errEl.style.display = 'block';
          submitBtn.disabled = false;
        }
      });
    };

    bindAuthEvents(true);
  }

  hideAuthModal() {
    this.hideModal();
  }

  // --- Friend Discovery Search Modal ("Find your people...") ---

  openSearchModal(initialQuery = '') {
    const html = `
      <div class="search-modal">
        <div class="modal-header">
          <h2 class="modal-title">Find your people...</h2>
          <button class="modal-close-btn" id="modalCloseBtn" aria-label="Close">✕</button>
        </div>

        <div class="search-input-wrapper">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            id="userSearchInput"
            class="search-input search-input-large"
            placeholder="Search by username or name..."
            value="${escapeHtml(initialQuery)}"
            autocomplete="off"
            autofocus
          />
        </div>

        <div class="search-results-list" id="searchResultsList" role="list">
          <div class="search-loading">Type a username to discover registered friends...</div>
        </div>
      </div>
    `;

    this.showModal(html);

    document.getElementById('modalCloseBtn')?.addEventListener('click', () => this.hideModal());

    const input = document.getElementById('userSearchInput');
    const listEl = document.getElementById('searchResultsList');

    let debounceTimer = null;
    const executeSearch = async (q) => {
      listEl.innerHTML = `<div class="search-loading">Searching registered accounts...</div>`;
      try {
        const results = await users.searchUsers(q);
        if (results.length === 0) {
          listEl.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon">🔍</div>
              <p class="empty-title">No matching users found.</p>
              <p class="empty-subtitle">Try searching another username or invite a friend to create an account.</p>
            </div>
          `;
          return;
        }

        listEl.innerHTML = '';
        for (const user of results) {
          const card = document.createElement('div');
          card.className = 'user-card';
          card.setAttribute('role', 'listitem');

          card.innerHTML = `
            <div class="user-card-avatar">
              ${renderAvatarSvg(user.avatar, 48)}
              <span class="online-dot ${user.isOnline ? 'online' : ''}"></span>
            </div>
            <div class="user-card-info">
              <div class="user-card-name-row">
                <span class="user-card-name">${escapeHtml(user.displayName)}</span>
                <span class="badge user-card-badge">@${escapeHtml(user.username)}</span>
              </div>
              <p class="user-card-bio">${escapeHtml(user.bio || 'Hey there! I am using MeshChat.')}</p>
            </div>
            <button class="btn btn-primary btn-sm user-card-chat-btn" data-user="${escapeHtml(user.username)}">
              Start Chat
            </button>
          `;

          card.querySelector('.user-card-chat-btn')?.addEventListener('click', () => {
            this.hideModal();
            this.openConversation(user.username, user.displayName, user.avatar);
          });

          listEl.appendChild(card);
        }
      } catch (err) {
        listEl.innerHTML = `<div class="form-error">Failed to search users. Please try again.</div>`;
      }
    };

    input?.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        executeSearch(e.target.value);
      }, 250);
    });

    // Execute initial search
    executeSearch(initialQuery);
    setTimeout(() => input?.focus(), 100);
  }

  // --- Contacts Modal ---

  async openContactsModal() {
    const conversations = await storage.getAllConversations();
    const html = `
      <div class="contacts-modal">
        <div class="modal-header">
          <h2 class="modal-title">Contacts Directory</h2>
          <button class="modal-close-btn" id="modalCloseBtn" aria-label="Close">✕</button>
        </div>

        <div class="contacts-list" id="contactsList">
          ${
            conversations.length === 0
              ? `
            <div class="empty-state">
              <div class="empty-icon">👥</div>
              <p class="empty-title">No contacts saved yet.</p>
              <button class="btn btn-primary" id="contactsFindBtn">Find your people...</button>
            </div>
          `
              : conversations
                  .map(
                    (c) => `
              <div class="contact-item" data-user="${c.contactUsername}">
                ${renderAvatarSvg(c.contactAvatar, 44)}
                <div class="contact-info">
                  <span class="contact-name">${escapeHtml(c.contactDisplayName || c.contactUsername)}</span>
                  <span class="contact-handle">@${escapeHtml(c.contactUsername)}</span>
                </div>
                <button class="btn btn-secondary btn-sm contact-chat-btn" data-user="${c.contactUsername}" data-name="${escapeHtml(
                      c.contactDisplayName
                    )}" data-avatar="${c.contactAvatar}">
                  Chat
                </button>
              </div>
            `
                  )
                  .join('')
          }
        </div>
      </div>
    `;

    this.showModal(html);
    document.getElementById('modalCloseBtn')?.addEventListener('click', () => this.hideModal());
    document.getElementById('contactsFindBtn')?.addEventListener('click', () => {
      this.hideModal();
      this.openSearchModal();
    });

    document.querySelectorAll('.contact-chat-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.hideModal();
        this.openConversation(btn.dataset.user, btn.dataset.name, btn.dataset.avatar);
      });
    });
  }

  // --- User Profile Modal ---

  openProfileModal() {
    const user = auth.getCurrentUser();
    if (!user) return;

    let selectedAvatar = user.avatar;

    const html = `
      <div class="profile-modal">
        <div class="modal-header">
          <h2 class="modal-title">My Profile</h2>
          <button class="modal-close-btn" id="modalCloseBtn" aria-label="Close">✕</button>
        </div>

        <div class="profile-avatar-preview" id="profileAvatarPreview">
          ${renderAvatarSvg(selectedAvatar, 72)}
        </div>

        <div class="form-group">
          <label class="form-label">Change Avatar</label>
          <div class="avatar-picker">
            ${AVATAR_PRESETS.map(
              (av) => `
              <button
                type="button"
                class="avatar-option ${av.id === selectedAvatar ? 'selected' : ''}"
                data-avatar="${av.id}"
                style="background-color: ${av.color};"
                title="${av.name}"
              >
                <span>${av.icon}</span>
              </button>
            `
            ).join('')}
          </div>
        </div>

        <form id="profileForm">
          <div class="form-group">
            <label class="form-label">Username</label>
            <div class="input-copy-wrapper">
              <input type="text" class="form-input" value="@${escapeHtml(user.username)}" readonly />
              <button type="button" class="btn btn-secondary btn-sm" id="copyUsernameBtn">Copy</button>
            </div>
          </div>

          <div class="form-group">
            <label for="profileDisplayName" class="form-label">Display Name</label>
            <input
              type="text"
              id="profileDisplayName"
              class="form-input"
              value="${escapeHtml(user.displayName)}"
              required
            />
          </div>

          <div class="form-group">
            <label for="profileBio" class="form-label">About / Bio</label>
            <input
              type="text"
              id="profileBio"
              class="form-input"
              value="${escapeHtml(user.bio || '')}"
              maxlength="100"
            />
          </div>

          <div id="profileSuccess" class="form-success" style="display: none;">Profile updated successfully!</div>

          <button type="submit" class="btn btn-primary btn-block">Save Changes</button>
        </form>

        <div class="profile-actions-danger">
          <button class="btn btn-secondary btn-block" id="profileLogoutBtn">Log Out</button>
        </div>
      </div>
    `;

    this.showModal(html);
    document.getElementById('modalCloseBtn')?.addEventListener('click', () => this.hideModal());

    // Avatar pick
    document.querySelectorAll('.avatar-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.avatar-option').forEach((o) => o.classList.remove('selected'));
        opt.classList.add('selected');
        selectedAvatar = opt.dataset.avatar;
        const preview = document.getElementById('profileAvatarPreview');
        if (preview) preview.innerHTML = renderAvatarSvg(selectedAvatar, 72);
      });
    });

    // Copy username
    document.getElementById('copyUsernameBtn')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(user.username);
      const btn = document.getElementById('copyUsernameBtn');
      if (btn) btn.textContent = 'Copied!';
      setTimeout(() => {
        if (btn) btn.textContent = 'Copy';
      }, 1500);
    });

    // Save profile
    document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const displayName = document.getElementById('profileDisplayName')?.value;
      const bio = document.getElementById('profileBio')?.value;

      try {
        await auth.updateProfile({
          displayName,
          avatar: selectedAvatar,
          bio,
        });
        const success = document.getElementById('profileSuccess');
        if (success) success.style.display = 'block';
        this.updateUserProfileBar();
      } catch (err) {
        alert(err.message || 'Failed to update profile');
      }
    });

    // Logout
    document.getElementById('profileLogoutBtn')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to log out?')) {
        signaling.disconnect();
        auth.logout();
        this.hideModal();
      }
    });
  }

  // --- Settings Modal ---

  openSettingsModal() {
    const currentTheme = storage.getPreference('theme', 'light');
    const enterToSend = storage.getPreference('enterToSend', true);
    const readReceipts = storage.getPreference('readReceipts', true);
    const turnConfig = storage.getPreference('turnServer', { url: '', username: '', credential: '' });

    const html = `
      <div class="settings-modal">
        <div class="modal-header">
          <h2 class="modal-title">Settings</h2>
          <button class="modal-close-btn" id="modalCloseBtn" aria-label="Close">✕</button>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Appearance</h3>
          <div class="settings-row">
            <div>
              <span class="settings-label">Theme Mode</span>
              <p class="settings-desc">Choose between signature Pastel Rose light theme or Dark theme.</p>
            </div>
            <select id="themeSelect" class="form-select">
              <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Pastel Rose (Light)</option>
              <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Dark Charcoal</option>
            </select>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Chat & Privacy</h3>
          <div class="settings-row">
            <div>
              <span class="settings-label">Enter to Send</span>
              <p class="settings-desc">Press Enter to send message, Shift+Enter for new line.</p>
            </div>
            <input type="checkbox" id="enterToSendCheck" ${enterToSend ? 'checked' : ''} />
          </div>

          <div class="settings-row">
            <div>
              <span class="settings-label">Read Receipts</span>
              <p class="settings-desc">Send and receive double checkmark read acknowledgments.</p>
            </div>
            <input type="checkbox" id="readReceiptsCheck" ${readReceipts ? 'checked' : ''} />
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Network & WebRTC Infrastructure</h3>
          <p class="settings-desc">
            MeshChat uses STUN servers (<code>stun:stun.l.google.com:19302</code>) for NAT traversal.
            Strict corporate/mobile symmetric NAT networks require an optional TURN relay server.
          </p>
          <div class="form-group" style="margin-top: 8px;">
            <label class="form-label">Custom TURN Server URL (optional)</label>
            <input type="text" id="turnUrlInput" class="form-input" placeholder="turn:turn.example.com:3478" value="${escapeHtml(
              turnConfig.url || ''
            )}" />
          </div>
          <div class="form-group">
            <label class="form-label">TURN Username (optional)</label>
            <input type="text" id="turnUserInput" class="form-input" placeholder="turn_username" value="${escapeHtml(
              turnConfig.username || ''
            )}" />
          </div>
          <div class="form-group">
            <label class="form-label">TURN Credential (optional)</label>
            <input type="password" id="turnPassInput" class="form-input" placeholder="••••••••" value="${escapeHtml(
              turnConfig.credential || ''
            )}" />
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="saveTurnBtn">Save TURN Configuration</button>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Local Storage & Account</h3>
          <p class="settings-desc">All conversations and messages are persisted inside browser IndexedDB.</p>
          <div class="settings-btn-group">
            <button class="btn btn-secondary btn-sm" id="clearHistoryBtn">Clear Local Chat History</button>
            <button class="btn btn-danger btn-sm" id="deleteAccountBtn">Delete My Account</button>
          </div>
        </div>
      </div>
    `;

    this.showModal(html);
    document.getElementById('modalCloseBtn')?.addEventListener('click', () => this.hideModal());

    // Theme toggle
    document.getElementById('themeSelect')?.addEventListener('change', (e) => {
      const newTheme = e.target.value;
      storage.setPreference('theme', newTheme);
      document.body.setAttribute('data-theme', newTheme);
    });

    // Enter to send
    document.getElementById('enterToSendCheck')?.addEventListener('change', (e) => {
      storage.setPreference('enterToSend', e.target.checked);
    });

    // Read receipts
    document.getElementById('readReceiptsCheck')?.addEventListener('change', (e) => {
      storage.setPreference('readReceipts', e.target.checked);
    });

    // Save TURN
    document.getElementById('saveTurnBtn')?.addEventListener('click', () => {
      const url = document.getElementById('turnUrlInput')?.value.trim();
      const username = document.getElementById('turnUserInput')?.value.trim();
      const credential = document.getElementById('turnPassInput')?.value.trim();
      storage.setPreference('turnServer', { url, username, credential });
      alert('TURN configuration saved.');
    });

    // Clear history
    document.getElementById('clearHistoryBtn')?.addEventListener('click', async () => {
      if (confirm('Clear all local conversation history? This cannot be undone.')) {
        await storage.clearAll();
        this.loadConversations();
        chat.setActiveContact(null);
        alert('Local history cleared.');
      }
    });

    // Delete account
    document.getElementById('deleteAccountBtn')?.addEventListener('click', async () => {
      if (confirm('Permanently delete your account and release your username?')) {
        await auth.deleteAccount();
        await storage.clearAll();
        signaling.disconnect();
        this.hideModal();
      }
    });
  }

  // --- Chat Info Modal ---

  openChatInfoModal() {
    const contact = chat.getActiveContact();
    if (!contact) return;

    const status = webrtc.getConnectionStatus(contact.username);

    const html = `
      <div class="chat-info-modal">
        <div class="modal-header">
          <h2 class="modal-title">Conversation Info</h2>
          <button class="modal-close-btn" id="modalCloseBtn" aria-label="Close">✕</button>
        </div>

        <div class="chat-info-hero">
          ${renderAvatarSvg(contact.avatar, 64)}
          <h3 class="chat-info-name">${escapeHtml(contact.displayName || contact.username)}</h3>
          <span class="badge">@${escapeHtml(contact.username)}</span>
        </div>

        <div class="settings-section">
          <h4 class="settings-section-title">WebRTC Connection Status</h4>
          <div class="info-row">
            <span>Transport:</span>
            <strong>${status === 'connected' ? 'Direct P2P DataChannel' : 'Signaling Relay / Handshaking'}</strong>
          </div>
          <div class="info-row">
            <span>ICE Protocol:</span>
            <strong>STUN (RFC 5389)</strong>
          </div>
          <div class="info-row">
            <span>Local Storage:</span>
            <strong>IndexedDB (Client Private)</strong>
          </div>
        </div>

        <div class="chat-info-actions">
          <button class="btn btn-secondary btn-block" id="clearThisChatBtn">Clear Conversation History</button>
        </div>
      </div>
    `;

    this.showModal(html);
    document.getElementById('modalCloseBtn')?.addEventListener('click', () => this.hideModal());

    document.getElementById('clearThisChatBtn')?.addEventListener('click', async () => {
      if (confirm(`Delete local messages for @${contact.username}?`)) {
        await storage.deleteConversation(contact.username);
        this.loadConversations();
        this.loadMessageHistory(contact.username);
        this.hideModal();
      }
    });
  }
}

export const ui = new UIManager();

/**
 * Golden Grove — User Interface Controller
 * Features the signature Golden Grove green-and-gold nature-inspired aesthetic.
 * Full 3-panel layout: Left Nav Rail, Middle Chat & Friends List, Right Chat Workspace.
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
} from './utils.js';

// Golden Grove Nature & Sunlight Avatar Presets
export const GROVE_AVATARS = [
  { id: 'avatar_1', color: '#FFCB3D', icon: '☀️', name: 'Sunbeam' },
  { id: 'avatar_2', color: '#557945', icon: '🌳', name: 'Grove Oak' },
  { id: 'avatar_3', color: '#F1A344', icon: '🦊', name: 'Forest Fox' },
  { id: 'avatar_4', color: '#5D9253', icon: '🍃', name: 'Sweet Fern' },
  { id: 'avatar_5', color: '#FFE8C4', icon: '🌸', name: 'Honey Blossom' },
  { id: 'avatar_6', color: '#47663A', icon: '🌲', name: 'Mountain Pine' },
];

export function getAvatarConfig(avatarId) {
  return GROVE_AVATARS.find((a) => a.id === avatarId) || GROVE_AVATARS[0];
}

export function renderAvatarSvg(avatarId, size = 44) {
  const conf = getAvatarConfig(avatarId);
  return `
    <div class="user-avatar-circle" style="width: ${size}px; height: ${size}px; background-color: ${conf.color};" title="${conf.name}">
      <span>${conf.icon}</span>
    </div>
  `;
}

class UIManager {
  constructor() {
    this.currentView = 'chats'; // 'chats' | 'friends' | 'requests' | 'settings'
    this.searchDebounceTimer = null;
    this.typingTimeout = null;
    this.currentFilter = 'all'; // 'all' | 'unread' | 'groups'
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
      this.hideModal();
      this.loadConversations();
      this.updateUserProfileBar();
      this.updateBadges();
    } else {
      this.showAuthModal();
    }
  }

  renderApp() {
    const root = document.getElementById('root');
    if (!root) return;

    root.innerHTML = `
      <div class="app-layout" id="appLayout">
        <!-- 1. Left Sidebar Navigation (Deep Green) -->
        <nav class="nav-sidebar" aria-label="Main Navigation">
          <div class="nav-top">
            <div class="brand-wrapper" id="brandHomeBtn" title="Golden Grove">
              <div class="brand-logo">
                <img src="/assets/logo.svg" alt="Golden Grove Logo" width="38" height="38" />
              </div>
              <span class="brand-title">Golden Grove</span>
            </div>

            <div class="nav-items-group" role="tablist">
              <button class="nav-btn active" id="navChatsBtn" role="tab" title="Chats" aria-label="Chats">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <span class="nav-badge" id="chatsNavBadge" style="display: none;">0</span>
              </button>

              <button class="nav-btn" id="navFriendsBtn" role="tab" title="Friends" aria-label="Friends">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </button>

              <button class="nav-btn" id="navRequestsBtn" role="tab" title="Friend Requests" aria-label="Requests">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <line x1="19" y1="8" x2="19" y2="14"></line>
                  <line x1="22" y1="11" x2="16" y2="11"></line>
                </svg>
                <span class="nav-badge" id="requestsNavBadge" style="display: none;">0</span>
              </button>

              <button class="nav-btn" id="navSettingsBtn" role="tab" title="Settings" aria-label="Settings">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </button>
            </div>
          </div>

          <div class="nav-bottom">
            <button class="nav-avatar-btn" id="navProfileBtn" title="Profile" aria-label="Profile">
              <div id="navUserAvatarSlot"></div>
            </button>
          </div>
        </nav>

        <!-- 2. Middle Panel — Messages & Chat Cards -->
        <aside class="middle-panel" id="middlePanel">
          <div class="middle-header">
            <div class="middle-title-row">
              <h1 class="middle-title" id="middlePanelHeading">Messages</h1>
              <button class="action-icon-btn" id="newChatActionBtn" title="New Chat" aria-label="New Chat">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            </div>

            <!-- Rounded Modern Search Input -->
            <div class="search-wrapper">
              <span class="search-icon-left">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              </span>
              <input
                type="text"
                id="chatSearchInput"
                class="search-input-field"
                placeholder="Search conversations..."
                aria-label="Search"
                autocomplete="off"
              />
              <button class="search-clear-icon" id="searchClearBtn" style="display: none;" title="Clear">✕</button>
            </div>

            <!-- Filter Tabs -->
            <div class="filter-tabs-row" id="filterTabsRow">
              <button class="filter-tab-pill active" data-filter="all" id="tabFilterAll">All</button>
              <button class="filter-tab-pill" data-filter="unread" id="tabFilterUnread">Unread</button>
              <button class="filter-tab-pill" data-filter="online" id="tabFilterOnline">Online</button>
            </div>
          </div>

          <!-- Chat List Scroll View -->
          <div class="middle-scroll-list" id="conversationsContainer" role="list">
            <div class="grove-empty-state">
              <div class="grove-empty-icon">🍃</div>
              <p class="grove-empty-title">Your Golden Grove begins here.</p>
              <p class="grove-empty-subtitle">Connect with friends and share moments in nature-inspired tranquility.</p>
              <button class="btn-grove btn-golden" id="emptyStartChatBtn">Find Friends</button>
            </div>
          </div>
        </aside>

        <!-- 3. Right Panel — Main Workspace -->
        <main class="workspace-panel" id="workspacePanel">
          <!-- Active Chat Viewport -->
          <div class="chat-viewport" id="activeChatViewport" style="display: none;">
            <header class="workspace-header">
              <div class="header-contact-left">
                <button class="mobile-back-btn" id="mobileChatBackBtn" title="Back to chats" aria-label="Back">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                  </svg>
                </button>
                <div class="avatar-container" id="chatContactAvatarSlot"></div>
                <div class="header-contact-details">
                  <h2 class="header-contact-name" id="chatContactDisplayName">Friend Name</h2>
                  <div class="header-connection-pill" id="chatConnectionPill">
                    <span class="conn-indicator"></span>
                    <span class="conn-label">Direct WebRTC</span>
                  </div>
                </div>
              </div>

              <!-- Header Call & Info Actions -->
              <div class="header-actions-group">
                <button class="header-tool-btn" id="callVoiceBtn" title="Voice Call" aria-label="Voice Call">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                  </svg>
                </button>
                <button class="header-tool-btn" id="callVideoBtn" title="Video Call" aria-label="Video Call">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7"></polygon>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                  </svg>
                </button>
                <button class="header-tool-btn" id="chatDetailsBtn" title="Conversation Info" aria-label="Info">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </button>
              </div>
            </header>

            <!-- Message Stream Area -->
            <div class="messages-history" id="messagesHistoryStream" role="log" aria-live="polite">
              <!-- Dynamically injected messages -->
            </div>

            <!-- Typing indicator -->
            <div class="typing-box" id="typingBox" style="display: none;">
              <div class="typing-bubble-pill">
                <span class="typing-dot-anim"></span>
                <span class="typing-dot-anim"></span>
                <span class="typing-dot-anim"></span>
                <span class="typing-text-label" id="typingTextLabel">is typing...</span>
              </div>
            </div>

            <!-- Pending attachment strip -->
            <div class="composer-attachment-strip" id="attachmentStrip" style="display: none;">
              <span class="attachment-filename" id="attachmentStripName">attachment.png</span>
              <button class="attachment-cancel" id="attachmentCancelBtn" title="Remove">✕</button>
            </div>

            <!-- Bottom Composer -->
            <footer class="workspace-composer">
              <input type="file" id="fileUploadInput" style="display: none;" />
              <button class="composer-btn-tool" id="attachFileBtn" title="Attach file or photo" aria-label="Attach File">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
              </button>

              <div style="position: relative;">
                <button class="composer-btn-tool" id="toggleEmojiBtn" title="Insert Emoji" aria-label="Emoji">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                    <line x1="9" y1="9" x2="9.01" y2="9"></line>
                    <line x1="15" y1="9" x2="15.01" y2="9"></line>
                  </svg>
                </button>
                <div class="emoji-popover-card" id="emojiPopover" style="display: none;">
                  <div class="emoji-grid-cells">
                    ${['☀️', '🌿', '🍃', '🦊', '🍯', '🌸', '✨', '🌲', '😊', '❤️', '👍', '🎉', '☕', '🔥', '🙌', '🌟', '🕊️', '🌾'].map(
                      (e) => `<button class="emoji-cell-btn" data-emoji="${e}">${e}</button>`
                    ).join('')}
                  </div>
                </div>
              </div>

              <div class="composer-input-field-wrapper">
                <textarea
                  id="chatTextInput"
                  class="composer-input-field"
                  placeholder="Send a message in the Grove..."
                  rows="1"
                  aria-label="Message text"
                ></textarea>
              </div>

              <button class="composer-send-golden-btn" id="sendGoldenBtn" title="Send (Enter)" aria-label="Send Message" disabled>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </footer>
          </div>

          <!-- Empty Splash Screen when no chat selected -->
          <div class="workspace-splash" id="workspaceSplash">
            <div class="splash-nature-card">
              <div class="splash-emblem">
                <img src="/assets/logo.svg" alt="Golden Grove" width="88" height="88" />
              </div>
              <h2 class="splash-heading">Welcome to Golden Grove</h2>
              <p class="splash-description">
                Experience warm, nature-inspired peer-to-peer messaging. Direct WebRTC DataChannels keep your conversations private, swift, and serene.
              </p>
              <div class="splash-feature-tags">
                <span class="nature-tag">☀️ Encrypted WebRTC</span>
                <span class="nature-tag">🌿 Local IndexedDB</span>
                <span class="nature-tag">🍯 Vercel Coordination</span>
              </div>
              <button class="btn-grove btn-golden" id="splashExploreBtn">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                Find Grove Friends
              </button>
            </div>
          </div>

          <!-- Dedicated Friends & Requests Panel View -->
          <div class="friends-page-container" id="friendsDedicatedView" style="display: none;">
            <!-- Rendered dynamically -->
          </div>
        </main>
      </div>

      <!-- Global Modals Dialog Overlay -->
      <div id="groveModalOverlay" class="grove-modal-overlay" style="display: none;">
        <div class="grove-modal-dialog" id="groveModalCard"></div>
      </div>
    `;
  }

  updateUserProfileBar() {
    const user = auth.getCurrentUser();
    const slot = document.getElementById('navUserAvatarSlot');
    if (!slot) return;
    if (user) {
      slot.innerHTML = renderAvatarSvg(user.avatar, 42);
    } else {
      slot.innerHTML = `<div class="user-avatar-circle" style="width: 42px; height: 42px; background-color: #557945; color: #FFF9ED;">👤</div>`;
    }
  }

  async updateBadges() {
    const user = auth.getCurrentUser();
    if (!user) return;
    try {
      // Check unread count
      const convs = await storage.getAllConversations();
      const totalUnread = convs.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
      const chatBadge = document.getElementById('chatsNavBadge');
      if (chatBadge) {
        if (totalUnread > 0) {
          chatBadge.textContent = String(totalUnread);
          chatBadge.style.display = 'flex';
        } else {
          chatBadge.style.display = 'none';
        }
      }

      // Check friend requests
      const reqs = await users.getRequests();
      const incCount = reqs.incoming?.length || 0;
      const reqBadge = document.getElementById('requestsNavBadge');
      if (reqBadge) {
        if (incCount > 0) {
          reqBadge.textContent = String(incCount);
          reqBadge.style.display = 'flex';
        } else {
          reqBadge.style.display = 'none';
        }
      }
    } catch (e) {
      // silent
    }
  }

  bindGlobalEvents() {
    // Navigation Rail Tabs
    document.getElementById('navChatsBtn')?.addEventListener('click', () => {
      this.switchMainView('chats');
    });

    document.getElementById('navFriendsBtn')?.addEventListener('click', () => {
      this.switchMainView('friends');
    });

    document.getElementById('navRequestsBtn')?.addEventListener('click', () => {
      this.switchMainView('requests');
    });

    document.getElementById('navSettingsBtn')?.addEventListener('click', () => {
      this.openSettingsModal();
    });

    document.getElementById('navProfileBtn')?.addEventListener('click', () => {
      this.openProfileModal();
    });

    document.getElementById('brandHomeBtn')?.addEventListener('click', () => {
      this.switchMainView('chats');
    });

    document.getElementById('newChatActionBtn')?.addEventListener('click', () => {
      this.openSearchModal();
    });

    document.getElementById('emptyStartChatBtn')?.addEventListener('click', () => {
      this.openSearchModal();
    });

    document.getElementById('splashExploreBtn')?.addEventListener('click', () => {
      this.switchMainView('friends');
    });

    // Mobile back button
    document.getElementById('mobileChatBackBtn')?.addEventListener('click', () => {
      document.getElementById('appLayout')?.classList.remove('mobile-chat-open');
      chat.setActiveContact(null);
      document.querySelectorAll('.chat-card').forEach((c) => c.classList.remove('active'));
    });

    // Middle panel search input
    const searchInput = document.getElementById('chatSearchInput');
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

    // Filter tabs in middle panel
    document.querySelectorAll('.filter-tab-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab-pill').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter || 'all';
        this.loadConversations();
      });
    });

    // Composer input and Send Button
    const textInput = document.getElementById('chatTextInput');
    const sendBtn = document.getElementById('sendGoldenBtn');

    textInput?.addEventListener('input', () => {
      textInput.style.height = 'auto';
      textInput.style.height = Math.min(textInput.scrollHeight, 120) + 'px';
      const hasContent = textInput.value.trim().length > 0 || !!this.pendingAttachment;
      if (sendBtn) sendBtn.disabled = !hasContent;

      chat.sendTypingStatus(true);
      clearTimeout(this.typingTimeout);
      this.typingTimeout = setTimeout(() => {
        chat.sendTypingStatus(false);
      }, 1500);

      const active = chat.getActiveContact();
      if (active) {
        storage.saveDraft(active.username, textInput.value);
      }
    });

    textInput?.addEventListener('keydown', (e) => {
      const enterToSend = storage.getPreference('enterToSend', true);
      if (e.key === 'Enter' && !e.shiftKey && enterToSend) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    sendBtn?.addEventListener('click', () => {
      this.handleSendMessage();
    });

    // Emoji Popover
    const emojiBtn = document.getElementById('toggleEmojiBtn');
    const emojiPopover = document.getElementById('emojiPopover');

    emojiBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const visible = emojiPopover.style.display === 'block';
      emojiPopover.style.display = visible ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
      if (emojiPopover && !emojiPopover.contains(e.target) && e.target !== emojiBtn) {
        emojiPopover.style.display = 'none';
      }
    });

    emojiPopover?.addEventListener('click', (e) => {
      const cell = e.target.closest('.emoji-cell-btn');
      if (cell) {
        const emoji = cell.dataset.emoji;
        if (textInput) {
          textInput.value += emoji;
          textInput.dispatchEvent(new Event('input'));
          textInput.focus();
        }
      }
    });

    // File Upload
    const attachBtn = document.getElementById('attachFileBtn');
    const fileUpload = document.getElementById('fileUploadInput');

    attachBtn?.addEventListener('click', () => {
      fileUpload?.click();
    });

    fileUpload?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.handleFileSelected(file);
    });

    document.getElementById('attachmentCancelBtn')?.addEventListener('click', () => {
      this.clearPendingAttachment();
    });

    document.getElementById('chatDetailsBtn')?.addEventListener('click', () => {
      this.openChatInfoModal();
    });

    // Chat Manager Event Subscriptions
    chat.on('messageAdded', (msg) => this.handleMessageAdded(msg));
    chat.on('messageStatusUpdated', (data) => this.handleMessageStatusUpdated(data));
    chat.on('conversationUpdated', (conv) => this.handleConversationUpdated(conv));
    chat.on('activeContactChanged', (contact) => this.renderActiveContact(contact));
    chat.on('typingChanged', (data) => this.handleTypingChanged(data));
    chat.on('connectionChange', (data) => this.handleConnectionChange(data));

    auth.onChange((user) => {
      this.updateUserProfileBar();
      if (!user) this.showAuthModal();
      else this.updateBadges();
    });
  }

  switchMainView(view) {
    this.currentView = view;
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));

    const middlePanel = document.getElementById('middlePanel');
    const viewport = document.getElementById('activeChatViewport');
    const splash = document.getElementById('workspaceSplash');
    const friendsView = document.getElementById('friendsDedicatedView');
    const isMobile = window.innerWidth <= 768;

    if (view === 'chats') {
      document.getElementById('navChatsBtn')?.classList.add('active');
      if (middlePanel) middlePanel.style.display = 'flex';
      if (friendsView) friendsView.style.display = 'none';
      if (isMobile) {
        document.getElementById('appLayout')?.classList.remove('mobile-chat-open');
      }
      const active = chat.getActiveContact();
      if (active) {
        if (viewport) viewport.style.display = 'flex';
        if (splash) splash.style.display = 'none';
      } else {
        if (viewport) viewport.style.display = 'none';
        if (splash) splash.style.display = 'flex';
      }
      this.loadConversations();
    } else if (view === 'friends') {
      document.getElementById('navFriendsBtn')?.classList.add('active');
      if (middlePanel) middlePanel.style.display = isMobile ? 'none' : 'flex';
      if (viewport) viewport.style.display = 'none';
      if (splash) splash.style.display = 'none';
      if (friendsView) {
        friendsView.style.display = 'flex';
        this.renderFriendsPage();
      }
      if (isMobile) {
        document.getElementById('appLayout')?.classList.add('mobile-chat-open');
      }
    } else if (view === 'requests') {
      document.getElementById('navRequestsBtn')?.classList.add('active');
      if (middlePanel) middlePanel.style.display = isMobile ? 'none' : 'flex';
      if (viewport) viewport.style.display = 'none';
      if (splash) splash.style.display = 'none';
      if (friendsView) {
        friendsView.style.display = 'flex';
        this.renderRequestsPage();
      }
      if (isMobile) {
        document.getElementById('appLayout')?.classList.add('mobile-chat-open');
      }
    }
  }

  // --- Conversations Middle Panel ---

  async loadConversations() {
    const list = await storage.getAllConversations();
    const container = document.getElementById('conversationsContainer');
    if (!container) return;

    let filtered = list;
    if (this.currentFilter === 'unread') {
      filtered = list.filter((c) => (c.unreadCount || 0) > 0);
    } else if (this.currentFilter === 'online') {
      filtered = list.filter((c) => webrtc.getConnectionStatus(c.contactUsername) === 'connected');
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="grove-empty-state">
          <div class="grove-empty-icon">🍃</div>
          <p class="grove-empty-title">Your Golden Grove begins here.</p>
          <p class="grove-empty-subtitle">Connect with friends and share moments in nature-inspired tranquility.</p>
          <button class="btn-grove btn-golden" id="emptyFindFriendsBtn">Find Friends</button>
        </div>
      `;
      document.getElementById('emptyFindFriendsBtn')?.addEventListener('click', () => this.switchMainView('friends'));
      return;
    }

    container.innerHTML = '';
    const active = chat.getActiveContact();

    for (const conv of filtered) {
      const card = document.createElement('div');
      card.className = `chat-card ${active && active.username === conv.contactUsername ? 'active' : ''}`;
      card.id = `conv_${conv.contactUsername}`;
      card.setAttribute('role', 'listitem');
      card.setAttribute('tabindex', '0');

      const avatarHtml = renderAvatarSvg(conv.contactAvatar, 46);
      const isOnline = webrtc.getConnectionStatus(conv.contactUsername) === 'connected';

      card.innerHTML = `
        <div class="avatar-container">
          ${avatarHtml}
          <span class="pulse-online-dot ${isOnline ? 'online' : ''}" id="dot_${conv.contactUsername}"></span>
        </div>
        <div class="chat-card-content">
          <div class="chat-card-top">
            <span class="chat-card-name">${escapeHtml(conv.contactDisplayName || conv.contactUsername)}</span>
            <span class="chat-card-time">${formatConversationTime(conv.lastTimestamp)}</span>
          </div>
          <div class="chat-card-bottom">
            <span class="chat-card-preview">${escapeHtml(conv.lastMessage || 'Say hello!')}</span>
            ${conv.unreadCount > 0 ? `<span class="chat-unread-badge">${conv.unreadCount}</span>` : ''}
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        this.openConversation(conv.contactUsername, conv.contactDisplayName, conv.contactAvatar);
      });

      container.appendChild(card);
    }

    // Gracefully populate vertical whitespace with a discovery card
    const exploreCard = document.createElement('div');
    exploreCard.className = 'grove-explore-prompt-card';
    exploreCard.id = 'promptExploreGrove';
    exploreCard.innerHTML = `
      <div class="explore-prompt-left">
        <span class="explore-leaf-icon">🍃</span>
        <div class="explore-prompt-texts">
          <span class="explore-prompt-title">Explore Golden Grove</span>
          <span class="explore-prompt-sub">Discover members and build connections</span>
        </div>
      </div>
      <button class="btn-grove btn-golden btn-sm-g" id="promptFindFriendsBtn">Discover</button>
    `;
    container.appendChild(exploreCard);

    document.getElementById('promptFindFriendsBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.switchMainView('friends');
    });
  }

  filterConversations(query) {
    const container = document.getElementById('conversationsContainer');
    if (!container) return;
    if (!query) {
      this.loadConversations();
      return;
    }
    const q = query.toLowerCase();
    const cards = container.querySelectorAll('.chat-card');
    cards.forEach((card) => {
      const match = card.textContent.toLowerCase().includes(q);
      card.style.display = match ? 'flex' : 'none';
    });
  }

  async openConversation(username, displayName, avatar) {
    const contact = {
      username: username.toLowerCase(),
      displayName: displayName || username,
      avatar: avatar || 'avatar_1',
    };

    // Highlight card
    document.querySelectorAll('.chat-card').forEach((c) => c.classList.remove('active'));
    document.getElementById(`conv_${contact.username}`)?.classList.add('active');

    // On mobile: slide into conversation
    document.getElementById('appLayout')?.classList.add('mobile-chat-open');

    // Switch right panel to conversation
    document.getElementById('friendsDedicatedView')?.style.setProperty('display', 'none');
    await chat.setActiveContact(contact);
  }

  renderActiveContact(contact) {
    const splash = document.getElementById('workspaceSplash');
    const viewport = document.getElementById('activeChatViewport');
    if (!contact) {
      if (splash) splash.style.display = 'flex';
      if (viewport) viewport.style.display = 'none';
      return;
    }

    if (splash) splash.style.display = 'none';
    if (viewport) viewport.style.display = 'flex';

    const nameEl = document.getElementById('chatContactDisplayName');
    const avatarSlot = document.getElementById('chatContactAvatarSlot');
    if (nameEl) nameEl.textContent = contact.displayName || contact.username;
    if (avatarSlot) avatarSlot.innerHTML = renderAvatarSvg(contact.avatar, 42);

    this.updateConnectionPill(contact.username);
    this.loadMessageHistory(contact.username);

    // Restore draft
    storage.getDraft(contact.username).then((draft) => {
      const input = document.getElementById('chatTextInput');
      const sendBtn = document.getElementById('sendGoldenBtn');
      if (input) {
        input.value = draft || '';
        input.style.height = 'auto';
        if (draft) input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        if (sendBtn) sendBtn.disabled = !draft;
        input.focus();
      }
    });
  }

  updateConnectionPill(peer) {
    const pill = document.getElementById('chatConnectionPill');
    if (!pill) return;

    const status = webrtc.getConnectionStatus(peer);
    const indicator = pill.querySelector('.conn-indicator');
    const label = pill.querySelector('.conn-label');

    if (status === 'connected') {
      indicator?.classList.remove('connecting', 'failed');
      indicator?.classList.add('connected');
      if (label) label.textContent = 'Direct WebRTC DataChannel';
    } else if (status === 'connecting' || status === 'reconnecting') {
      indicator?.classList.remove('connected', 'failed');
      indicator?.classList.add('connecting');
      if (label) label.textContent = 'Connecting WebRTC...';
    } else {
      indicator?.classList.remove('connected', 'connecting');
      indicator?.classList.add('failed');
      if (label) label.textContent = 'Offline (Signaling Standby)';
    }
  }

  async loadMessageHistory(peer) {
    const stream = document.getElementById('messagesHistoryStream');
    if (!stream) return;
    stream.innerHTML = '';

    const messages = await storage.getMessages(peer);
    for (const msg of messages) {
      this.appendMessageBubble(msg, false);
    }
    this.scrollToBottom();
  }

  appendMessageBubble(msg, shouldScroll = true) {
    const stream = document.getElementById('messagesHistoryStream');
    if (!stream) return;

    const isOut = msg.isOutgoing;
    const row = document.createElement('div');
    row.className = `msg-row ${isOut ? 'outgoing' : 'incoming'}`;
    row.id = `msg_${msg.id}`;

    let statusCheck = '';
    if (isOut) {
      if (msg.status === 'sending') statusCheck = '🕒';
      else if (msg.status === 'sent') statusCheck = '✓';
      else if (msg.status === 'delivered') statusCheck = '✓✓';
      else if (msg.status === 'read') statusCheck = '✓✓';
      else if (msg.status === 'failed') statusCheck = '⚠️';
    }

    let fileHtml = '';
    if (msg.file) {
      if (msg.file.mimeType?.startsWith('image/') && msg.file.dataUrl) {
        fileHtml = `
          <div class="attachment-card-img">
            <img src="${msg.file.dataUrl}" alt="${escapeHtml(msg.file.name)}" loading="lazy" />
          </div>
        `;
      } else {
        fileHtml = `
          <div class="attachment-card-doc">
            <span>📄</span>
            <div>
              <strong>${escapeHtml(msg.file.name)}</strong>
              <small>${formatFileSize(msg.file.size)}</small>
            </div>
            ${msg.file.dataUrl ? `<a href="${msg.file.dataUrl}" download="${escapeHtml(msg.file.name)}">⬇️</a>` : ''}
          </div>
        `;
      }
    }

    row.innerHTML = `
      <div class="msg-bubble ${isOut ? 'bubble-out' : 'bubble-in'}">
        ${fileHtml}
        ${msg.text ? `<p class="msg-text">${escapeHtml(msg.text)}</p>` : ''}
        <div class="msg-meta-row">
          <span>${formatMessageTime(msg.timestamp)}</span>
          ${isOut ? `<span class="check-status">${statusCheck}</span>` : ''}
        </div>
      </div>
    `;

    stream.appendChild(row);
    if (shouldScroll) this.scrollToBottom();
  }

  scrollToBottom() {
    const stream = document.getElementById('messagesHistoryStream');
    if (stream) stream.scrollTop = stream.scrollHeight;
  }

  async handleSendMessage() {
    const input = document.getElementById('chatTextInput');
    const sendBtn = document.getElementById('sendGoldenBtn');
    if (!input) return;

    const text = input.value.trim();
    const file = this.pendingAttachment;
    if (!text && !file) return;

    input.value = '';
    input.style.height = 'auto';
    if (sendBtn) sendBtn.disabled = true;

    this.clearPendingAttachment();

    const active = chat.getActiveContact();
    if (active) storage.saveDraft(active.username, '');

    try {
      await chat.sendMessage(text, file);
    } catch (err) {
      console.error('Failed to send:', err);
    }
  }

  handleFileSelected(file) {
    if (file.size > 8 * 1024 * 1024) {
      alert('File too large (max 8 MB for peer transfer).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      this.pendingAttachment = {
        name: file.name,
        size: file.size,
        mimeType: file.type,
        dataUrl: e.target?.result,
      };
      const strip = document.getElementById('attachmentStrip');
      const name = document.getElementById('attachmentStripName');
      const sendBtn = document.getElementById('sendGoldenBtn');
      if (strip && name) {
        name.textContent = `📎 ${file.name} (${formatFileSize(file.size)})`;
        strip.style.display = 'flex';
      }
      if (sendBtn) sendBtn.disabled = false;
    };
    reader.readAsDataURL(file);
  }

  clearPendingAttachment() {
    this.pendingAttachment = null;
    const strip = document.getElementById('attachmentStrip');
    const fileInput = document.getElementById('fileUploadInput');
    if (strip) strip.style.display = 'none';
    if (fileInput) fileInput.value = '';

    const input = document.getElementById('chatTextInput');
    const sendBtn = document.getElementById('sendGoldenBtn');
    if (sendBtn && input) sendBtn.disabled = input.value.trim().length === 0;
  }

  handleMessageAdded(msg) {
    const active = chat.getActiveContact();
    if (active && (active.username === msg.sender || active.username === msg.recipient)) {
      this.appendMessageBubble(msg, true);
    }
    this.loadConversations();
    this.updateBadges();
  }

  handleMessageStatusUpdated(data) {
    const row = document.getElementById(`msg_${data.messageId}`);
    if (row) {
      const statusEl = row.querySelector('.check-status');
      if (statusEl) {
        if (data.status === 'sent') statusEl.textContent = '✓';
        else if (data.status === 'delivered') statusEl.textContent = '✓✓';
        else if (data.status === 'read') statusEl.textContent = '✓✓';
        else if (data.status === 'failed') statusEl.textContent = '⚠️';
      }
    }
  }

  handleConversationUpdated() {
    this.loadConversations();
    this.updateBadges();
  }

  handleTypingChanged(data) {
    const active = chat.getActiveContact();
    if (active && active.username === data.peer) {
      const box = document.getElementById('typingBox');
      const label = document.getElementById('typingTextLabel');
      if (box && label) {
        if (data.isTyping) {
          label.textContent = `${active.displayName || active.username} is typing...`;
          box.style.display = 'block';
          this.scrollToBottom();
        } else {
          box.style.display = 'none';
        }
      }
    }
  }

  handleConnectionChange(data) {
    const active = chat.getActiveContact();
    if (active && active.username === data.peer) {
      this.updateConnectionPill(data.peer);
    }
    const dot = document.getElementById(`dot_${data.peer}`);
    if (dot) {
      if (data.status === 'connected') dot.classList.add('online');
      else dot.classList.remove('online');
    }
  }

  // --- Dedicated Friends Page View ---

  async renderFriendsPage() {
    const container = document.getElementById('friendsDedicatedView');
    if (!container) return;

    container.innerHTML = `
      <div class="friends-page-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button class="mobile-back-btn" id="mobileFriendsBackBtn" title="Back to chats" aria-label="Back">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <div>
            <h2 class="friends-page-title">Grove Friends & People</h2>
            <p class="friends-page-sub">Discover friends in Golden Grove, send requests, and start peer conversations.</p>
          </div>
        </div>
      </div>

      <div class="search-wrapper" style="margin-bottom: 24px; max-width: 540px;">
        <span class="search-icon-left">🔍</span>
        <input
          type="text"
          id="friendsSearchBox"
          class="search-input-field"
          placeholder="Search by username or name in Golden Grove..."
          autocomplete="off"
        />
      </div>

      <div class="friends-subtabs">
        <button class="friends-subtab-btn active" id="subtabMyFriends">My Friends</button>
        <button class="friends-subtab-btn" id="subtabDiscover">Discover People</button>
      </div>

      <div class="friends-grid" id="friendsCardsGrid">
        <div class="grove-empty-state">
          <p class="grove-empty-subtitle">Loading friends...</p>
        </div>
      </div>
    `;

    document.getElementById('mobileFriendsBackBtn')?.addEventListener('click', () => {
      this.switchMainView('chats');
    });

    const searchInput = document.getElementById('friendsSearchBox');
    const grid = document.getElementById('friendsCardsGrid');
    const myFriendsBtn = document.getElementById('subtabMyFriends');
    const discoverBtn = document.getElementById('subtabDiscover');

    let activeSubtab = 'myFriends';

    const loadFriends = async () => {
      const friends = await users.getFriends();
      if (friends.length === 0) {
        grid.innerHTML = `
          <div class="grove-empty-state">
            <div class="grove-empty-icon">🌳</div>
            <p class="grove-empty-title">No friends added yet.</p>
            <p class="grove-empty-subtitle">Use the search box above or click Discover People to find members.</p>
            <button class="btn-grove btn-golden" id="btnSwitchDiscover">Discover People</button>
          </div>
        `;
        document.getElementById('btnSwitchDiscover')?.addEventListener('click', () => {
          discoverBtn.click();
        });
        return;
      }

      grid.innerHTML = friends
        .map(
          (f) => `
        <div class="friend-grove-card">
          <div class="avatar-container">
            ${renderAvatarSvg(f.avatar, 50)}
            <span class="pulse-online-dot ${f.isOnline ? 'online' : ''}"></span>
          </div>
          <div>
            <h4 style="font-size: 15px; font-weight: 800; color: var(--main-text);">${escapeHtml(f.displayName)}</h4>
            <span style="font-size: 12px; color: var(--deep-green); font-weight: 600;">@${escapeHtml(f.username)}</span>
            <p style="font-size: 12px; color: var(--secondary-text); margin-top: 2px;">${escapeHtml(f.bio || '')}</p>
          </div>
          <div class="card-actions-group">
            <button class="btn-grove btn-golden btn-sm-g start-chat-friend-btn" data-user="${f.username}" data-name="${escapeHtml(
            f.displayName
          )}" data-avatar="${f.avatar}">
              Message
            </button>
          </div>
        </div>
      `
        )
        .join('');

      grid.querySelectorAll('.start-chat-friend-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.switchMainView('chats');
          this.openConversation(btn.dataset.user, btn.dataset.name, btn.dataset.avatar);
        });
      });
    };

    const loadDiscover = async (q = '') => {
      grid.innerHTML = `<div class="grove-empty-state"><p class="grove-empty-subtitle">Searching Grove members...</p></div>`;
      const results = await users.searchUsers(q);
      if (results.length === 0) {
        grid.innerHTML = `
          <div class="grove-empty-state">
            <div class="grove-empty-icon">🔍</div>
            <p class="grove-empty-title">No users found.</p>
            <p class="grove-empty-subtitle">Try another username query.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = results
        .map((u) => {
          let actionBtn = '';
          if (u.relationship === 'friend') {
            actionBtn = `<button class="btn-grove btn-softgreen btn-sm-g start-chat-friend-btn" data-user="${u.username}" data-name="${escapeHtml(
              u.displayName
            )}" data-avatar="${u.avatar}">Chat</button>`;
          } else if (u.relationship === 'sent') {
            actionBtn = `<span class="nature-tag" style="font-size: 11px;">Request Sent</span>`;
          } else if (u.relationship === 'received') {
            actionBtn = `<button class="btn-grove btn-golden btn-sm-g accept-req-btn" data-user="${u.username}">Accept</button>`;
          } else {
            actionBtn = `<button class="btn-grove btn-outline btn-sm-g add-friend-btn" data-user="${u.username}">+ Add Friend</button>`;
          }

          return `
            <div class="friend-grove-card">
              <div class="avatar-container">
                ${renderAvatarSvg(u.avatar, 50)}
                <span class="pulse-online-dot ${u.isOnline ? 'online' : ''}"></span>
              </div>
              <div style="flex: 1; min-width: 0;">
                <h4 style="font-size: 15px; font-weight: 800; color: var(--main-text);">${escapeHtml(u.displayName)}</h4>
                <span style="font-size: 12px; color: var(--deep-green); font-weight: 600;">@${escapeHtml(u.username)}</span>
                <p style="font-size: 12px; color: var(--secondary-text); margin-top: 2px;">${escapeHtml(u.bio || '')}</p>
              </div>
              <div class="card-actions-group">
                ${actionBtn}
              </div>
            </div>
          `;
        })
        .join('');

      grid.querySelectorAll('.start-chat-friend-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.switchMainView('chats');
          this.openConversation(btn.dataset.user, btn.dataset.name, btn.dataset.avatar);
        });
      });

      grid.querySelectorAll('.add-friend-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            await users.sendFriendRequest(btn.dataset.user);
            btn.parentElement.innerHTML = `<span class="nature-tag" style="font-size: 11px;">Request Sent</span>`;
            this.updateBadges();
          } catch (err) {
            alert(err.message);
          }
        });
      });

      grid.querySelectorAll('.accept-req-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            await users.respondFriendRequest(btn.dataset.user, 'accept');
            loadDiscover(searchInput.value);
            this.updateBadges();
          } catch (err) {
            alert(err.message);
          }
        });
      });
    };

    myFriendsBtn.addEventListener('click', () => {
      activeSubtab = 'myFriends';
      myFriendsBtn.classList.add('active');
      discoverBtn.classList.remove('active');
      loadFriends();
    });

    discoverBtn.addEventListener('click', () => {
      activeSubtab = 'discover';
      discoverBtn.classList.add('active');
      myFriendsBtn.classList.remove('active');
      loadDiscover(searchInput.value);
    });

    searchInput.addEventListener('input', (e) => {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => {
        if (activeSubtab === 'myFriends') {
          // If searching, switch to discover tab for search
          discoverBtn.click();
        } else {
          loadDiscover(e.target.value);
        }
      }, 250);
    });

    loadFriends();
  }

  // --- Dedicated Requests Page View ---

  async renderRequestsPage() {
    const container = document.getElementById('friendsDedicatedView');
    if (!container) return;

    container.innerHTML = `
      <div class="friends-page-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button class="mobile-back-btn" id="mobileRequestsBackBtn" title="Back to chats" aria-label="Back">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <div>
            <h2 class="friends-page-title">Friend Requests</h2>
            <p class="friends-page-sub">Manage incoming and sent friend invitations in Golden Grove.</p>
          </div>
        </div>
      </div>

      <div class="friends-subtabs">
        <button class="friends-subtab-btn active" id="subtabIncoming">Incoming Requests</button>
        <button class="friends-subtab-btn" id="subtabOutgoing">Sent Requests</button>
      </div>

      <div class="friends-grid" id="requestsCardsGrid">
        <div class="grove-empty-state"><p class="grove-empty-subtitle">Loading requests...</p></div>
      </div>
    `;

    document.getElementById('mobileRequestsBackBtn')?.addEventListener('click', () => {
      this.switchMainView('chats');
    });

    const grid = document.getElementById('requestsCardsGrid');
    const inBtn = document.getElementById('subtabIncoming');
    const outBtn = document.getElementById('subtabOutgoing');

    const renderIncoming = async () => {
      const data = await users.getRequests();
      const incoming = data.incoming || [];

      if (incoming.length === 0) {
        grid.innerHTML = `
          <div class="grove-empty-state">
            <div class="grove-empty-icon">💌</div>
            <p class="grove-empty-title">No pending incoming requests.</p>
            <p class="grove-empty-subtitle">When members send you a friend invitation, it will appear here.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = incoming
        .map(
          (r) => `
        <div class="friend-grove-card">
          <div class="avatar-container">
            ${renderAvatarSvg(r.avatar, 50)}
          </div>
          <div style="flex: 1; min-width: 0;">
            <h4 style="font-size: 15px; font-weight: 800; color: var(--main-text);">${escapeHtml(r.displayName)}</h4>
            <span style="font-size: 12px; color: var(--deep-green); font-weight: 600;">@${escapeHtml(r.from)}</span>
            <p style="font-size: 12px; color: var(--secondary-text); margin-top: 2px;">${escapeHtml(r.bio || '')}</p>
          </div>
          <div class="card-actions-group">
            <button class="btn-grove btn-golden btn-sm-g accept-action-btn" data-user="${r.from}">Accept</button>
            <button class="btn-grove btn-outline btn-sm-g decline-action-btn" data-user="${r.from}">Decline</button>
          </div>
        </div>
      `
        )
        .join('');

      grid.querySelectorAll('.accept-action-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          await users.respondFriendRequest(btn.dataset.user, 'accept');
          renderIncoming();
          this.updateBadges();
        });
      });

      grid.querySelectorAll('.decline-action-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          await users.respondFriendRequest(btn.dataset.user, 'decline');
          renderIncoming();
          this.updateBadges();
        });
      });
    };

    const renderOutgoing = async () => {
      const data = await users.getRequests();
      const outgoing = data.outgoing || [];

      if (outgoing.length === 0) {
        grid.innerHTML = `
          <div class="grove-empty-state">
            <div class="grove-empty-icon">🕊️</div>
            <p class="grove-empty-title">No sent requests pending.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = outgoing
        .map(
          (r) => `
        <div class="friend-grove-card">
          <div class="avatar-container">
            ${renderAvatarSvg(r.avatar, 50)}
          </div>
          <div style="flex: 1; min-width: 0;">
            <h4 style="font-size: 15px; font-weight: 800; color: var(--main-text);">${escapeHtml(r.displayName)}</h4>
            <span style="font-size: 12px; color: var(--deep-green); font-weight: 600;">@${escapeHtml(r.to)}</span>
          </div>
          <div class="card-actions-group">
            <span class="nature-tag" style="font-size: 11px;">Pending Approval</span>
          </div>
        </div>
      `
        )
        .join('');
    };

    inBtn.addEventListener('click', () => {
      inBtn.classList.add('active');
      outBtn.classList.remove('active');
      renderIncoming();
    });

    outBtn.addEventListener('click', () => {
      outBtn.classList.add('active');
      inBtn.classList.remove('active');
      renderOutgoing();
    });

    renderIncoming();
  }

  // --- Modals ---

  showModal(html) {
    const overlay = document.getElementById('groveModalOverlay');
    const card = document.getElementById('groveModalCard');
    if (!overlay || !card) return;
    const content = html.includes('grove-modal-sheet-handle')
      ? html
      : `<div class="grove-modal-sheet-handle"></div>${html}`;
    card.innerHTML = content;
    overlay.style.display = 'flex';
    overlay.onclick = (e) => {
      if (e.target === overlay) this.hideModal();
    };
  }

  hideModal() {
    const overlay = document.getElementById('groveModalOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  // --- Authentication Modal ---

  showAuthModal() {
    let selectedAvatar = 'avatar_1';

    const renderForm = (isRegister = true) => `
      <div>
        <div class="auth-brand-center">
          <img src="/assets/logo.svg" alt="Golden Grove" width="56" height="56" />
          <h2 style="font-size: 22px; font-weight: 800; color: var(--deep-green); margin-top: 8px;">Golden Grove</h2>
          <p style="font-size: 13.5px; color: var(--secondary-text);">A warm, nature-inspired peer-to-peer messaging haven.</p>
        </div>

        <div class="auth-nav-toggle">
          <button class="auth-toggle-tab ${isRegister ? 'active' : ''}" id="tabReg">Create Account</button>
          <button class="auth-toggle-tab ${!isRegister ? 'active' : ''}" id="tabLog">Sign In</button>
        </div>

        <form id="authForm" autocomplete="off">
          <div class="form-field-group">
            <label for="authUsername" class="form-label-text">Unique Username</label>
            <input
              type="text"
              id="authUsername"
              class="form-control-input"
              placeholder="e.g. golden_leaf"
              required
              autocomplete="username"
            />
            <span class="form-field-hint">3-20 characters (lowercase letters, numbers, underscores).</span>
          </div>

          ${
            isRegister
              ? `
            <div class="form-field-group">
              <label for="authDisplayName" class="form-label-text">Display Name</label>
              <input
                type="text"
                id="authDisplayName"
                class="form-control-input"
                placeholder="e.g. Sylvan Woods"
                required
              />
            </div>

            <div class="form-field-group">
              <label class="form-label-text">Choose Nature Avatar</label>
              <div class="grove-avatar-selector">
                ${GROVE_AVATARS.map(
                  (av) => `
                  <button
                    type="button"
                    class="avatar-choice-btn ${av.id === selectedAvatar ? 'selected' : ''}"
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

            <div class="form-field-group">
              <label for="authBio" class="form-label-text">About / Bio (optional)</label>
              <input
                type="text"
                id="authBio"
                class="form-control-input"
                placeholder="Living peacefully in Golden Grove."
                maxlength="100"
              />
            </div>
          `
              : ''
          }

          <div id="authErrMsg" class="form-banner-error" style="display: none;"></div>

          <button type="submit" class="btn-grove btn-golden btn-block-g" id="authSubmitBtn">
            ${isRegister ? 'Join Golden Grove' : 'Enter Golden Grove'}
          </button>
        </form>
      </div>
    `;

    this.showModal(renderForm(true));

    const bind = (isReg) => {
      document.getElementById('tabReg')?.addEventListener('click', () => {
        this.showModal(renderForm(true));
        bind(true);
      });
      document.getElementById('tabLog')?.addEventListener('click', () => {
        this.showModal(renderForm(false));
        bind(false);
      });

      document.querySelectorAll('.avatar-choice-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.avatar-choice-btn').forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
          selectedAvatar = btn.dataset.avatar;
        });
      });

      const form = document.getElementById('authForm');
      const err = document.getElementById('authErrMsg');
      const submit = document.getElementById('authSubmitBtn');

      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        err.style.display = 'none';
        submit.disabled = true;

        const username = document.getElementById('authUsername')?.value;
        const displayName = document.getElementById('authDisplayName')?.value;
        const bio = document.getElementById('authBio')?.value;

        try {
          if (isReg) {
            await auth.register({ username, displayName, avatar: selectedAvatar, bio });
          } else {
            await auth.login(username);
          }
          const user = auth.getCurrentUser();
          signaling.connect(user.username);
          webrtc.setCurrentUser(user.username);
          this.hideModal();
          this.updateUserProfileBar();
          this.loadConversations();
          this.updateBadges();
        } catch (error) {
          err.textContent = error.message;
          err.style.display = 'block';
          submit.disabled = false;
        }
      });
    };

    bind(true);
  }

  // --- Search / New Chat Modal ---

  openSearchModal(initialQuery = '') {
    const html = `
      <div>
        <div class="modal-header-row">
          <h3 class="modal-title-text">Find Grove Friends</h3>
          <button class="modal-dismiss-btn" id="modalDismissBtn" aria-label="Close">✕</button>
        </div>

        <div class="search-wrapper" style="margin-bottom: 16px;">
          <span class="search-icon-left">🔍</span>
          <input
            type="text"
            id="modalSearchInput"
            class="search-input-field"
            placeholder="Search by username or display name..."
            value="${escapeHtml(initialQuery)}"
            autofocus
            autocomplete="off"
          />
        </div>

        <div id="modalSearchResults" style="max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
          <p class="grove-empty-subtitle" style="text-align: center; padding: 20px;">Type a username to discover registered members...</p>
        </div>
      </div>
    `;

    this.showModal(html);
    document.getElementById('modalDismissBtn')?.addEventListener('click', () => this.hideModal());

    const input = document.getElementById('modalSearchInput');
    const list = document.getElementById('modalSearchResults');

    let debounce = null;
    const runSearch = async (q) => {
      list.innerHTML = `<p class="grove-empty-subtitle" style="text-align: center; padding: 20px;">Searching Golden Grove...</p>`;
      try {
        const results = await users.searchUsers(q);
        if (results.length === 0) {
          list.innerHTML = `
            <div class="grove-empty-state">
              <div class="grove-empty-icon">🍃</div>
              <p class="grove-empty-title">No matching members found.</p>
              <p class="grove-empty-subtitle">Try searching another username.</p>
            </div>
          `;
          return;
        }

        list.innerHTML = results
          .map(
            (u) => `
          <div class="friend-grove-card">
            <div class="avatar-container">
              ${renderAvatarSvg(u.avatar, 46)}
              <span class="pulse-online-dot ${u.isOnline ? 'online' : ''}"></span>
            </div>
            <div style="flex: 1; min-width: 0;">
              <h4 style="font-size: 14.5px; font-weight: 800; color: var(--main-text);">${escapeHtml(u.displayName)}</h4>
              <span style="font-size: 11.5px; color: var(--deep-green); font-weight: 600;">@${escapeHtml(u.username)}</span>
            </div>
            <button class="btn-grove btn-golden btn-sm-g search-start-chat-btn" data-user="${u.username}" data-name="${escapeHtml(
              u.displayName
            )}" data-avatar="${u.avatar}">
              Message
            </button>
          </div>
        `
          )
          .join('');

        list.querySelectorAll('.search-start-chat-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            this.hideModal();
            this.switchMainView('chats');
            this.openConversation(btn.dataset.user, btn.dataset.name, btn.dataset.avatar);
          });
        });
      } catch (e) {
        list.innerHTML = `<div class="form-banner-error">Search failed.</div>`;
      }
    };

    input?.addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => runSearch(e.target.value), 250);
    });

    runSearch(initialQuery);
    setTimeout(() => input?.focus(), 100);
  }

  // --- Profile Modal ---

  openProfileModal() {
    const user = auth.getCurrentUser();
    if (!user) return;
    let selectedAvatar = user.avatar;

    const currentBio = user.bio && !user.bio.includes('MeshChat') ? user.bio : 'Living peacefully in Golden Grove.';

    const html = `
      <div>
        <div class="grove-modal-sheet-handle"></div>
        <div class="modal-header-row">
          <h3 class="modal-title-text">My Grove Profile</h3>
          <button class="modal-dismiss-btn" id="modalDismissBtn" aria-label="Close">✕</button>
        </div>

        <div style="display: flex; justify-content: center; margin-bottom: 18px;" id="profileAvatarSlot">
          ${renderAvatarSvg(selectedAvatar, 68)}
        </div>

        <div class="form-field-group">
          <label class="form-label-text">Choose Nature Avatar</label>
          <div class="grove-avatar-selector">
            ${GROVE_AVATARS.map(
              (av) => `
              <button
                type="button"
                class="avatar-choice-btn ${av.id === selectedAvatar ? 'selected' : ''}"
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

        <form id="profileEditForm">
          <div class="form-field-group">
            <label class="form-label-text">Username</label>
            <div class="input-with-action-group">
              <input type="text" class="form-control-input" value="@${escapeHtml(user.username)}" readonly />
              <button type="button" class="btn-inline-action" id="copyUserHandleBtn" title="Copy username">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span id="copyBtnText">Copy</span>
              </button>
            </div>
          </div>

          <div class="form-field-group">
            <label for="profDisplayName" class="form-label-text">Display Name</label>
            <input type="text" id="profDisplayName" class="form-control-input" value="${escapeHtml(user.displayName)}" required />
          </div>

          <div class="form-field-group">
            <label for="profBio" class="form-label-text">About / Bio</label>
            <input type="text" id="profBio" class="form-control-input" value="${escapeHtml(currentBio)}" placeholder="Living peacefully in Golden Grove." maxlength="100" />
          </div>

          <div id="profSuccessMsg" class="form-banner-success" style="display: none;">Profile updated in Golden Grove!</div>

          <button type="submit" class="btn-grove btn-golden btn-block-g">Save Profile</button>
        </form>

        <div style="margin-top: 18px; border-top: 1px solid var(--border-color); padding-top: 14px;">
          <button class="btn-grove btn-outline btn-block-g" id="profLogoutBtn">Sign Out of Grove</button>
        </div>
      </div>
    `;

    this.showModal(html);
    document.getElementById('modalDismissBtn')?.addEventListener('click', () => this.hideModal());

    document.querySelectorAll('.avatar-choice-btn').forEach((b) => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.avatar-choice-btn').forEach((btn) => btn.classList.remove('selected'));
        b.classList.add('selected');
        selectedAvatar = b.dataset.avatar;
        const slot = document.getElementById('profileAvatarSlot');
        if (slot) slot.innerHTML = renderAvatarSvg(selectedAvatar, 68);
      });
    });

    document.getElementById('copyUserHandleBtn')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(user.username);
      const text = document.getElementById('copyBtnText');
      if (text) text.textContent = 'Copied!';
      setTimeout(() => {
        if (text) text.textContent = 'Copy';
      }, 1500);
    });

    document.getElementById('profileEditForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const displayName = document.getElementById('profDisplayName')?.value;
      const bio = document.getElementById('profBio')?.value;
      try {
        await auth.updateProfile({ displayName, avatar: selectedAvatar, bio });
        const success = document.getElementById('profSuccessMsg');
        if (success) success.style.display = 'block';
        this.updateUserProfileBar();
      } catch (err) {
        alert(err.message);
      }
    });

    document.getElementById('profLogoutBtn')?.addEventListener('click', () => {
      if (confirm('Sign out of Golden Grove?')) {
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
      <div>
        <div class="grove-modal-sheet-handle"></div>
        <div class="modal-header-row">
          <h3 class="modal-title-text">Settings</h3>
          <button class="modal-dismiss-btn" id="modalDismissBtn" aria-label="Close">✕</button>
        </div>

        <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 14px; margin-bottom: 14px;">
          <h4 style="font-size: 14px; font-weight: 700; color: var(--deep-green); margin-bottom: 10px;">Appearance</h4>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13.5px; font-weight: 600;">Theme Mode</span>
            <select id="themeSettingSelect" class="form-control-select">
              <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Golden Grove Warm Light</option>
              <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Dark Forest Night</option>
            </select>
          </div>
        </div>

        <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 14px; margin-bottom: 14px;">
          <h4 style="font-size: 14px; font-weight: 700; color: var(--deep-green); margin-bottom: 10px;">Chat & Behavior</h4>
          
          <div class="toggle-switch-row" style="margin-bottom: 8px;">
            <div>
              <span style="font-size: 13.5px; font-weight: 600; display: block;">Enter to Send</span>
              <small style="color: var(--secondary-text); font-size: 12px;">Press Enter to send, Shift+Enter for new line.</small>
            </div>
            <label class="toggle-switch" aria-label="Enter to Send">
              <input type="checkbox" id="enterToSendCheck" ${enterToSend ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-switch-row">
            <div>
              <span style="font-size: 13.5px; font-weight: 600; display: block;">Read Receipts</span>
              <small style="color: var(--secondary-text); font-size: 12px;">Send peer read acknowledgments (✓✓).</small>
            </div>
            <label class="toggle-switch" aria-label="Read Receipts">
              <input type="checkbox" id="readReceiptsCheck" ${readReceipts ? 'checked' : ''} />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 14px; margin-bottom: 14px;">
          <h4 style="font-size: 14px; font-weight: 700; color: var(--deep-green); margin-bottom: 6px;">WebRTC Peer Network</h4>
          <p style="font-size: 12px; color: var(--secondary-text); margin-bottom: 10px; line-height: 1.4;">
            Direct P2P DataChannels connect peers instantly. Configure an optional TURN relay if behind restrictive corporate networks:
          </p>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="turnUrlInput" class="form-control-input" placeholder="turn:turn.example.com:3478" value="${escapeHtml(
              turnConfig.url || ''
            )}" />
            <button type="button" class="btn-grove btn-golden btn-sm-g" id="saveTurnConfigBtn" style="white-space: nowrap;">Save</button>
          </div>
        </div>

        <div>
          <h4 style="font-size: 14px; font-weight: 700; color: var(--deep-green); margin-bottom: 10px;">Storage & Account</h4>
          <div style="display: flex; gap: 10px;">
            <button class="btn-grove btn-outline btn-sm-g" id="clearLocalHistoryBtn">Clear Local Chats</button>
            <button class="btn-grove btn-danger-soft btn-sm-g" id="deleteAccountBtn">Delete Account</button>
          </div>
        </div>
      </div>
    `;

    this.showModal(html);
    document.getElementById('modalDismissBtn')?.addEventListener('click', () => this.hideModal());

    document.getElementById('themeSettingSelect')?.addEventListener('change', (e) => {
      const theme = e.target.value;
      storage.setPreference('theme', theme);
      document.body.setAttribute('data-theme', theme);
    });

    document.getElementById('enterToSendCheck')?.addEventListener('change', (e) => {
      storage.setPreference('enterToSend', e.target.checked);
    });

    document.getElementById('readReceiptsCheck')?.addEventListener('change', (e) => {
      storage.setPreference('readReceipts', e.target.checked);
    });

    document.getElementById('saveTurnConfigBtn')?.addEventListener('click', () => {
      const url = document.getElementById('turnUrlInput')?.value.trim();
      storage.setPreference('turnServer', { url });
      alert('TURN configuration saved.');
    });

    document.getElementById('clearLocalHistoryBtn')?.addEventListener('click', async () => {
      if (confirm('Clear local conversation history?')) {
        await storage.clearAll();
        this.loadConversations();
        chat.setActiveContact(null);
        this.hideModal();
      }
    });

    document.getElementById('deleteAccountBtn')?.addEventListener('click', async () => {
      if (confirm('Permanently delete your account from Golden Grove?')) {
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
      <div>
        <div class="modal-header-row">
          <h3 class="modal-title-text">Conversation Details</h3>
          <button class="modal-dismiss-btn" id="modalDismissBtn" aria-label="Close">✕</button>
        </div>

        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 20px;">
          ${renderAvatarSvg(contact.avatar, 64)}
          <h3 style="font-size: 18px; font-weight: 800; color: var(--main-text);">${escapeHtml(contact.displayName || contact.username)}</h3>
          <span style="font-size: 12.5px; color: var(--deep-green); font-weight: 700;">@${escapeHtml(contact.username)}</span>
        </div>

        <div style="border-top: 1px solid var(--border-color); padding-top: 14px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; font-size: 13.5px; margin-bottom: 8px;">
            <span style="color: var(--secondary-text);">Connection Channel:</span>
            <strong style="color: var(--deep-green);">${status === 'connected' ? 'Direct P2P DataChannel' : 'Signaling Standby'}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 13.5px;">
            <span style="color: var(--secondary-text);">Storage:</span>
            <strong>IndexedDB Private</strong>
          </div>
        </div>

        <button class="btn-grove btn-outline btn-block-g" id="deleteThisChatHistoryBtn">Delete This Conversation</button>
      </div>
    `;

    this.showModal(html);
    document.getElementById('modalDismissBtn')?.addEventListener('click', () => this.hideModal());

    document.getElementById('deleteThisChatHistoryBtn')?.addEventListener('click', async () => {
      if (confirm(`Delete messages for @${contact.username}?`)) {
        await storage.deleteConversation(contact.username);
        this.loadConversations();
        this.loadMessageHistory(contact.username);
        this.hideModal();
      }
    });
  }
}

export const ui = new UIManager();

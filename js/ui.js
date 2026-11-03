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
import { fileManager } from './files.js';
import { resolveAvatarUrl, DEFAULT_AVATAR, BUILTIN_AVATARS } from './avatars.js';
import { dpModal } from './dp-modal.js';
import {
  escapeHtml,
  formatMessageTime,
  formatConversationTime,
  formatFileSize,
  toggleReaction,
  calculatePollVotes,
  formatConversationExport,
  highlightSearchMatch,
  formatVoiceDuration,
  getFileCategory,
  getFileCategoryBadge,
  sanitizeFileName,
  isBlockedExtension,
  MAX_FILE_SIZE_BYTES,
  validateUsername,
  validateDisplayName,
  validateFullName,
  validatePassword,
  evaluatePasswordStrength,
} from './utils.js';

// Universal Avatar Renderer (Real image assets, no emojis)
export function renderAvatarSvg(avatarIdOrUrl, size = 44, shape = 'circle') {
  if (avatarIdOrUrl === 'saved_notes') {
    return `
      <div class="user-avatar-circle" style="width: ${size}px; height: ${size}px; background-color: var(--golden-yellow); color: #263126; border-radius: ${shape === 'rounded' ? '14px' : '50%'};" title="Saved Messages">
        <span>🔖</span>
      </div>
    `;
  }
  const url = resolveAvatarUrl(avatarIdOrUrl);
  return `
    <div class="user-avatar-circle" style="width: ${size}px; height: ${size}px; border-radius: ${shape === 'rounded' ? '14px' : '50%'}; background: var(--pale-yellow-active);">
      <img src="${escapeHtml(url)}" alt="Avatar" loading="lazy" onerror="this.onerror=null;this.src='/avatars/default_avatar.svg';" />
    </div>
  `;
}

class UIManager {
  constructor() {
    this.currentView = 'chats'; // 'chats' | 'friends' | 'requests' | 'settings'
    this.searchDebounceTimer = null;
    this.typingTimeout = null;
    this.currentFilter = 'all'; // 'all' | 'unread' | 'favorites' | 'groups' | 'saved'
    this.pendingAttachment = null;
    this.replyingTo = null; // Quoted reply preview object { id, text, sender }

    // In-chat search state
    this.isChatSearchOpen = false;
    this.chatSearchMatches = [];
    this.currentSearchMatchIndex = -1;

    // Voice recording state
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.recordingTimer = null;
    this.recordingSeconds = 0;
    this.isRecordingVoice = false;

    // Active call state
    this.activeCall = null;
    this.localMediaStream = null;
    this.callTimerInterval = null;
    this.callDurationSeconds = 0;

    // Audio playback element tracker
    this.activeAudioElements = new Map();
  }

  init() {
    this.applySavedPreferences();
    this.renderApp();
    this.bindGlobalEvents();
    this.checkAuthStatus();
  }

  applySavedPreferences() {
    const palette = storage.getPreference('palette', 'default');
    const theme = storage.getPreference('theme', 'light');
    const wallpaper = storage.getPreference('wallpaper', 'grove');
    const bubble = storage.getPreference('bubble', 'leaf');
    const spacing = storage.getPreference('spacing', 'comfortable');
    const fontSize = storage.getPreference('fontSize', 'normal');

    document.body.setAttribute('data-palette', palette);
    document.body.setAttribute('data-theme', theme);
    document.body.setAttribute('data-wallpaper', wallpaper);
    document.body.setAttribute('data-bubble', bubble);
    document.body.setAttribute('data-spacing', spacing);
    document.body.setAttribute('data-font-size', fontSize);
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

              <button class="nav-btn" id="navAppearanceBtn" role="tab" title="Chat Appearance & Themes" aria-label="Appearance">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 2a10 10 0 0 0 0 20v-4a6 6 0 0 1 0-12V2z"></path>
                </svg>
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
              <div style="display: flex; gap: 6px;">
                <button class="action-icon-btn" id="newChatActionBtn" title="New Chat / Group" aria-label="New Chat">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
              </div>
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
              <button class="filter-tab-pill" data-filter="favorites" id="tabFilterFavorites">Favorites</button>
              <button class="filter-tab-pill" data-filter="groups" id="tabFilterGroups">Groups</button>
              <button class="filter-tab-pill" data-filter="saved" id="tabFilterSaved">Saved</button>
            </div>
          </div>

          <!-- Chat List Scroll View -->
          <div class="middle-scroll-list" id="conversationsContainer" role="list">
            <!-- Dynamically populated conversations -->
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
                <div class="avatar-container" id="chatContactAvatarSlot" style="cursor: pointer;" title="View Profile"></div>
                <div class="header-contact-details">
                  <h2 class="header-contact-name" id="chatContactDisplayName" style="cursor: pointer;" title="View Profile">Friend Name</h2>
                  <div class="header-connection-pill" id="chatConnectionPill">
                    <span class="conn-indicator"></span>
                    <span class="conn-label">Direct WebRTC</span>
                  </div>
                </div>
              </div>

              <!-- Header Call & Info Actions -->
              <div class="header-actions-group">
                <button class="header-tool-btn" id="chatSearchToggleBtn" title="Search in conversation" aria-label="Search Messages">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </button>
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
                <button class="header-tool-btn" id="aiAssistBtn" title="AI Assistant (Summarize, Replies, Tone, Tasks)" aria-label="AI Assistant">
                  <span style="font-size: 15px;">✨</span>
                </button>
                <button class="header-tool-btn" id="chatDetailsBtn" title="Conversation Details & Options" aria-label="Info">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </button>
              </div>
            </header>

            <!-- In-Chat Inline Search Bar (Hidden by default) -->
            <div class="chat-inline-search-bar" id="chatInlineSearchBar" style="display: none;">
              <span style="font-size: 14px;">🔍</span>
              <input type="text" id="inlineSearchInput" class="inline-search-input" placeholder="Search in this chat..." />
              <span class="inline-search-counter" id="inlineSearchCounter">0 of 0</span>
              <button class="composer-btn-tool" id="searchPrevMatchBtn" title="Previous match">▲</button>
              <button class="composer-btn-tool" id="searchNextMatchBtn" title="Next match">▼</button>
              <button class="composer-btn-tool" id="closeInlineSearchBtn" title="Close search">✕</button>
            </div>

            <!-- Pinned Message Banner (Shown when a message is pinned) -->
            <div class="workspace-pinned-banner" id="pinnedBannerContainer" style="display: none;">
              <div class="pinned-content-left" id="pinnedBannerClickArea">
                <span class="pinned-pin-icon">📌</span>
                <span class="pinned-snippet-text" id="pinnedBannerSnippet">Pinned message preview...</span>
              </div>
              <button class="pinned-unpin-btn" id="pinnedBannerDismissBtn" title="Unpin message">✕</button>
            </div>

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

            <!-- Quoted Reply Strip above composer -->
            <div class="composer-reply-strip" id="composerReplyStrip" style="display: none;">
              <div class="composer-reply-info">
                <span class="msg-reply-sender" id="replyStripSender">Replying to friend</span>
                <span class="msg-reply-text" id="replyStripSnippet">Quoted message preview...</span>
              </div>
              <button class="composer-reply-dismiss" id="replyStripDismissBtn" title="Cancel Reply">✕</button>
            </div>

            <!-- Pending attachment strip -->
            <div class="composer-attachment-strip" id="attachmentStrip" style="display: none;">
              <span class="attachment-filename" id="attachmentStripName">attachment.png</span>
              <button class="attachment-cancel" id="attachmentCancelBtn" title="Remove">✕</button>
            </div>

            <!-- Live Voice Recording Bar -->
            <div class="voice-recording-bar" id="voiceRecordingBar" style="display: none; margin: 0 16px 8px;">
              <span class="recording-pulse-dot"></span>
              <span class="recording-timer-text" id="voiceRecordingTimer">0:00</span>
              <span style="font-size: 13px; color: var(--secondary-text); flex: 1;">Recording voice note...</span>
              <button class="composer-btn-tool" id="voiceCancelBtn" title="Discard voice note" style="color: var(--danger-red);">✕</button>
              <button class="composer-send-golden-btn" id="voiceSendBtn" title="Send voice note" style="width: 36px; height: 36px;">✓</button>
            </div>

            <!-- Bottom Composer -->
            <footer class="workspace-composer" id="workspaceComposer">
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
                    ${['☀️', '🌿', '🍃', '🦊', '🍯', '🌸', '✨', '🌲', '😊', '❤️', '👍', '🎉', '☕', '🔥', '🙌', '🌟', '🕊️', '🌾', '🙏', '👏', '🎯', '💡'].map(
                      (e) => `<button class="emoji-cell-btn" data-emoji="${e}">${e}</button>`
                    ).join('')}
                  </div>
                </div>
              </div>

              <!-- Create Poll Button -->
              <button class="composer-btn-tool" id="createPollBtn" title="Create Group Poll" aria-label="Poll">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
              </button>

              <!-- Voice Record Button -->
              <button class="composer-btn-tool" id="recordVoiceBtn" title="Record Voice Note" aria-label="Voice Note">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              </button>

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
              <div style="display: flex; gap: 12px; justify-content: center; margin-top: 18px;">
                <button class="btn-grove btn-golden" id="splashExploreBtn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  Find Grove Friends
                </button>
                <button class="btn-grove btn-outline" id="splashSavedNotesBtn">
                  <span>🔖</span> Saved Messages
                </button>
              </div>
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

      <!-- Global Toast Notifications Container -->
      <div class="grove-toast-container" id="groveToastContainer"></div>

      <!-- Global Image Lightbox Overlay -->
      <div class="grove-lightbox-overlay" id="groveLightboxOverlay" style="display: none;">
        <div class="lightbox-toolbar">
          <a id="lightboxDownloadBtn" class="btn-grove btn-sm-g btn-golden" download="photo.jpg">⬇ Download</a>
          <button id="lightboxCloseBtn" class="btn-grove btn-sm-g btn-outline" style="color: white; border-color: white;">✕ Close</button>
        </div>
        <div class="lightbox-content-wrapper">
          <img id="lightboxMainImg" class="lightbox-main-img" src="" alt="Full preview" />
        </div>
      </div>
    `;
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('groveToastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'grove-toast';
    let icon = '🍃';
    if (type === 'success') icon = '✓';
    else if (type === 'error') icon = '⚠️';
    else if (type === 'copy') icon = '📋';

    toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  openLightbox(src, name = 'photo.jpg') {
    const overlay = document.getElementById('groveLightboxOverlay');
    const img = document.getElementById('lightboxMainImg');
    const download = document.getElementById('lightboxDownloadBtn');
    if (!overlay || !img) return;

    img.src = src;
    if (download) {
      download.href = src;
      download.download = name;
    }
    overlay.style.display = 'flex';

    const closeHandler = () => {
      overlay.style.display = 'none';
      img.src = '';
    };

    document.getElementById('lightboxCloseBtn').onclick = closeHandler;
    overlay.onclick = (e) => {
      if (e.target === overlay) closeHandler();
    };
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
      const convs = await storage.getAllConversations();
      const totalUnread = convs.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
      const chatsBadge = document.getElementById('chatsNavBadge');
      if (chatsBadge) {
        if (totalUnread > 0) {
          chatsBadge.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
          chatsBadge.style.display = 'inline-block';
        } else {
          chatsBadge.style.display = 'none';
        }
      }

      const reqs = await users.getRequests();
      const incomingCount = (reqs.incoming || []).length;
      const reqBadge = document.getElementById('requestsNavBadge');
      if (reqBadge) {
        if (incomingCount > 0) {
          reqBadge.textContent = String(incomingCount);
          reqBadge.style.display = 'inline-block';
        } else {
          reqBadge.style.display = 'none';
        }
      }
    } catch (e) {
      // non-critical badge failure
    }
  }

  bindGlobalEvents() {
    // Navigation Rail Buttons
    document.getElementById('brandHomeBtn')?.addEventListener('click', () => {
      this.switchMainView('chats');
      chat.setActiveContact(null);
    });

    document.getElementById('navChatsBtn')?.addEventListener('click', () => this.switchMainView('chats'));
    document.getElementById('navFriendsBtn')?.addEventListener('click', () => this.switchMainView('friends'));
    document.getElementById('navRequestsBtn')?.addEventListener('click', () => this.switchMainView('requests'));
    document.getElementById('navAppearanceBtn')?.addEventListener('click', () => this.openAppearanceModal());
    document.getElementById('navSettingsBtn')?.addEventListener('click', () => this.openSettingsModal());
    document.getElementById('navProfileBtn')?.addEventListener('click', () => this.openProfileModal());

    // Middle panel actions
    document.getElementById('newChatActionBtn')?.addEventListener('click', () => this.openNewChatOrGroupModal());
    document.getElementById('splashExploreBtn')?.addEventListener('click', () => this.switchMainView('friends'));
    document.getElementById('splashSavedNotesBtn')?.addEventListener('click', () => this.openSavedNotesConversation());

    // Filter Tabs
    const filterTabs = document.getElementById('filterTabsRow');
    filterTabs?.addEventListener('click', (e) => {
      const tab = e.target.closest('.filter-tab-pill');
      if (!tab) return;
      document.querySelectorAll('.filter-tab-pill').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      this.currentFilter = tab.dataset.filter || 'all';
      this.loadConversations();
    });

    // Middle Panel Search Input
    const searchInput = document.getElementById('chatSearchInput');
    const searchClear = document.getElementById('searchClearBtn');

    searchInput?.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      if (searchClear) searchClear.style.display = q ? 'block' : 'none';
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => {
        this.filterConversations(q);
      }, 150);
    });

    searchClear?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
        searchInput.focus();
      }
    });

    // Mobile Back to Chats
    document.getElementById('mobileChatBackBtn')?.addEventListener('click', () => {
      document.getElementById('appLayout')?.classList.remove('mobile-chat-open');
    });

    // Header buttons
    document.getElementById('chatSearchToggleBtn')?.addEventListener('click', () => this.toggleChatSearch());
    document.getElementById('callVoiceBtn')?.addEventListener('click', () => {
      const active = chat.getActiveContact();
      if (active) this.openCallModal(active.username, 'voice');
    });
    document.getElementById('callVideoBtn')?.addEventListener('click', () => {
      const active = chat.getActiveContact();
      if (active) this.openCallModal(active.username, 'video');
    });
    document.getElementById('aiAssistBtn')?.addEventListener('click', () => this.openAiAssistantModal());
    document.getElementById('chatDetailsBtn')?.addEventListener('click', () => this.openChatInfoModal());
    document.getElementById('chatContactDisplayName')?.addEventListener('click', () => {
      const active = chat.getActiveContact();
      if (active && active.username !== '__saved_notes__') this.openUserProfilePreview(active.username);
    });
    document.getElementById('chatContactAvatarSlot')?.addEventListener('click', () => {
      const active = chat.getActiveContact();
      if (active && active.username !== '__saved_notes__') this.openUserProfilePreview(active.username);
    });

    // In-chat search inline bar events
    document.getElementById('closeInlineSearchBtn')?.addEventListener('click', () => this.toggleChatSearch(false));
    document.getElementById('inlineSearchInput')?.addEventListener('input', (e) => this.runChatSearch(e.target.value));
    document.getElementById('searchPrevMatchBtn')?.addEventListener('click', () => this.stepChatSearch(-1));
    document.getElementById('searchNextMatchBtn')?.addEventListener('click', () => this.stepChatSearch(1));

    // Pinned banner
    document.getElementById('pinnedBannerClickArea')?.addEventListener('click', () => {
      const banner = document.getElementById('pinnedBannerContainer');
      const targetId = banner?.dataset.pinnedId;
      if (targetId) {
        const el = document.getElementById(`msg_${targetId}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.classList.add('highlight-pulse');
        setTimeout(() => el?.classList.remove('highlight-pulse'), 1200);
      }
    });
    document.getElementById('pinnedBannerDismissBtn')?.addEventListener('click', async () => {
      const banner = document.getElementById('pinnedBannerContainer');
      const targetId = banner?.dataset.pinnedId;
      if (targetId) {
        await chat.togglePin(targetId);
        this.updatePinnedBanner();
      }
    });

    // Composer Tools & Inputs
    const textInput = document.getElementById('chatTextInput');
    const sendBtn = document.getElementById('sendGoldenBtn');

    textInput?.addEventListener('input', () => {
      textInput.style.height = 'auto';
      textInput.style.height = Math.min(textInput.scrollHeight, 140) + 'px';
      const val = textInput.value.trim();
      if (sendBtn) sendBtn.disabled = val.length === 0 && !this.pendingAttachment;

      const active = chat.getActiveContact();
      if (active) {
        storage.saveDraft(active.username, textInput.value);
        if (active.username !== '__saved_notes__') {
          webrtc.sendTyping(active.username, val.length > 0);
          clearTimeout(this.typingTimeout);
          this.typingTimeout = setTimeout(() => {
            webrtc.sendTyping(active.username, false);
          }, 2500);
        }
      }
    });

    textInput?.addEventListener('keydown', (e) => {
      const enterToSend = storage.getPreference('enterToSend', true);
      if (e.key === 'Enter' && !e.shiftKey) {
        if (enterToSend) {
          e.preventDefault();
          this.handleSendMessage();
        }
      }
    });

    sendBtn?.addEventListener('click', () => this.handleSendMessage());

    // Reply Strip Dismiss
    document.getElementById('replyStripDismissBtn')?.addEventListener('click', () => {
      this.clearReplyState();
    });

    // Emoji Popover
    const emojiBtn = document.getElementById('toggleEmojiBtn');
    const emojiPopover = document.getElementById('emojiPopover');

    emojiBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = emojiPopover.style.display === 'block';
      emojiPopover.style.display = isVisible ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
      if (!emojiPopover?.contains(e.target) && e.target !== emojiBtn) {
        if (emojiPopover) emojiPopover.style.display = 'none';
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

    // Advanced File Upload & Drag-and-Drop Panel
    const attachBtn = document.getElementById('attachFileBtn');
    attachBtn?.addEventListener('click', () => this.openAttachmentModal());

    const fileUpload = document.getElementById('fileUploadInput');
    fileUpload?.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        this.openAttachmentModal(files);
      }
    });

    document.getElementById('attachmentCancelBtn')?.addEventListener('click', () => this.clearPendingAttachment());

    // Drag-and-drop on chat viewport
    const viewport = document.getElementById('activeChatViewport');
    if (viewport) {
      viewport.addEventListener('dragover', (e) => {
        e.preventDefault();
        viewport.classList.add('drag-hover');
      });
      viewport.addEventListener('dragleave', () => viewport.classList.remove('drag-hover'));
      viewport.addEventListener('drop', (e) => {
        e.preventDefault();
        viewport.classList.remove('drag-hover');
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          this.openAttachmentModal(files);
        }
      });
    }

    // Voice Recorder
    document.getElementById('recordVoiceBtn')?.addEventListener('click', () => this.startVoiceRecording());
    document.getElementById('voiceCancelBtn')?.addEventListener('click', () => this.cancelVoiceRecording());
    document.getElementById('voiceSendBtn')?.addEventListener('click', () => this.finishVoiceRecording());

    // Poll Trigger
    document.getElementById('createPollBtn')?.addEventListener('click', () => this.openCreatePollModal());

    // Chat Manager Event Subscriptions
    chat.on('messageAdded', (msg) => this.handleMessageAdded(msg));
    chat.on('messageStatusUpdated', (data) => this.handleMessageStatusUpdated(data));
    chat.on('messageUpdated', (msg) => this.handleMessageUpdated(msg));
    chat.on('messageDeleted', (data) => this.handleMessageDeleted(data));
    chat.on('conversationUpdated', (conv) => this.handleConversationUpdated(conv));
    chat.on('activeContactChanged', (contact) => this.renderActiveContact(contact));
    chat.on('typingChanged', (data) => this.handleTypingChanged(data));
    chat.on('connectionChange', (data) => this.handleConnectionChange(data));
    chat.on('callSignal', (signal) => this.handleIncomingCallSignal(signal));

    auth.onChange((user) => {
      this.updateUserProfileBar();
      if (!user) this.showAuthModal();
      else this.updateBadges();
    });

    // Global Command Palette & Shortcuts
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.openCommandPalette();
      } else if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        this.openShortcutsModal();
      }
    });
  }

  // --- Voice Message Recording Implementation ---

  async startVoiceRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      this.recordingSeconds = 0;
      this.isRecordingVoice = true;

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.start();

      const bar = document.getElementById('voiceRecordingBar');
      const timer = document.getElementById('voiceRecordingTimer');
      if (bar) bar.style.display = 'flex';
      if (timer) timer.textContent = '0:00';

      this.recordingTimer = setInterval(() => {
        this.recordingSeconds++;
        if (timer) timer.textContent = formatVoiceDuration(this.recordingSeconds);
      }, 1000);
    } catch (err) {
      this.showToast('Microphone access is required to record voice messages', 'error');
    }
  }

  cancelVoiceRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach((t) => t.stop());
    }
    clearInterval(this.recordingTimer);
    this.isRecordingVoice = false;
    const bar = document.getElementById('voiceRecordingBar');
    if (bar) bar.style.display = 'none';
  }

  async finishVoiceRecording() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return;

    const duration = this.recordingSeconds;
    clearInterval(this.recordingTimer);
    const bar = document.getElementById('voiceRecordingBar');
    if (bar) bar.style.display = 'none';

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onload = async (e) => {
        const audioUrl = e.target.result;
        const voiceData = { audioUrl, duration };
        const active = chat.getActiveContact();
        if (active) {
          await chat.sendMessage('', null, this.replyingTo, voiceData, null);
          this.clearReplyState();
        }
      };
      reader.readAsDataURL(blob);
      this.mediaRecorder.stream.getTracks().forEach((t) => t.stop());
      this.isRecordingVoice = false;
    };

    this.mediaRecorder.stop();
  }

  // --- Quoted Reply Management ---

  setReplyingTo(msg) {
    this.replyingTo = {
      id: msg.id,
      text: msg.text || (msg.file ? `📎 ${msg.file.name}` : (msg.voice ? '🎙️ Voice Note' : 'Poll')),
      sender: msg.sender,
    };

    const strip = document.getElementById('composerReplyStrip');
    const sender = document.getElementById('replyStripSender');
    const snippet = document.getElementById('replyStripSnippet');
    if (strip && sender && snippet) {
      sender.textContent = `Replying to @${this.replyingTo.sender}`;
      snippet.textContent = this.replyingTo.text;
      strip.style.display = 'flex';
    }

    const input = document.getElementById('chatTextInput');
    input?.focus();
  }

  clearReplyState() {
    this.replyingTo = null;
    const strip = document.getElementById('composerReplyStrip');
    if (strip) strip.style.display = 'none';
  }

  // --- In-Chat Search Logic ---

  toggleChatSearch(forceState) {
    const bar = document.getElementById('chatInlineSearchBar');
    if (!bar) return;

    this.isChatSearchOpen = forceState !== undefined ? forceState : bar.style.display === 'none';
    bar.style.display = this.isChatSearchOpen ? 'flex' : 'none';

    if (this.isChatSearchOpen) {
      const input = document.getElementById('inlineSearchInput');
      input?.focus();
    } else {
      this.clearChatSearchHighlights();
    }
  }

  async runChatSearch(query) {
    this.clearChatSearchHighlights();
    const q = query.trim().toLowerCase();
    const counter = document.getElementById('inlineSearchCounter');

    if (!q) {
      if (counter) counter.textContent = '0 of 0';
      this.chatSearchMatches = [];
      this.currentSearchMatchIndex = -1;
      return;
    }

    const stream = document.getElementById('messagesHistoryStream');
    const bubbles = stream?.querySelectorAll('.msg-text');
    this.chatSearchMatches = [];

    bubbles?.forEach((b) => {
      const raw = b.getAttribute('data-raw-text') || b.textContent;
      b.setAttribute('data-raw-text', raw);
      if (raw.toLowerCase().includes(q)) {
        b.innerHTML = highlightSearchMatch(raw, q);
        this.chatSearchMatches.push(b);
      }
    });

    if (counter) {
      counter.textContent = `${this.chatSearchMatches.length > 0 ? 1 : 0} of ${this.chatSearchMatches.length}`;
    }

    if (this.chatSearchMatches.length > 0) {
      this.currentSearchMatchIndex = 0;
      this.chatSearchMatches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      this.currentSearchMatchIndex = -1;
    }
  }

  stepChatSearch(direction) {
    if (this.chatSearchMatches.length === 0) return;
    this.currentSearchMatchIndex += direction;
    if (this.currentSearchMatchIndex >= this.chatSearchMatches.length) {
      this.currentSearchMatchIndex = 0;
    } else if (this.currentSearchMatchIndex < 0) {
      this.currentSearchMatchIndex = this.chatSearchMatches.length - 1;
    }

    const matchEl = this.chatSearchMatches[this.currentSearchMatchIndex];
    matchEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const counter = document.getElementById('inlineSearchCounter');
    if (counter) {
      counter.textContent = `${this.currentSearchMatchIndex + 1} of ${this.chatSearchMatches.length}`;
    }
  }

  clearChatSearchHighlights() {
    const stream = document.getElementById('messagesHistoryStream');
    stream?.querySelectorAll('.msg-text').forEach((b) => {
      const raw = b.getAttribute('data-raw-text');
      if (raw) {
        b.textContent = raw;
        b.removeAttribute('data-raw-text');
      }
    });
  }

  // --- Pinned Message Header Banner ---

  async updatePinnedBanner() {
    const active = chat.getActiveContact();
    const banner = document.getElementById('pinnedBannerContainer');
    const snippet = document.getElementById('pinnedBannerSnippet');
    if (!active || !banner || !snippet) return;

    const msgs = await storage.getMessages(active.username);
    const pinnedMsgs = msgs.filter((m) => m.pinned);

    if (pinnedMsgs.length > 0) {
      const latest = pinnedMsgs[pinnedMsgs.length - 1];
      snippet.textContent = latest.text || (latest.file ? `📎 ${latest.file.name}` : 'Pinned media');
      banner.dataset.pinnedId = latest.id;
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
      delete banner.dataset.pinnedId;
    }
  }

  // --- View Switcher ---

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

  // --- Saved Notes Conversation Shortcut ---

  async openSavedNotesConversation() {
    this.openConversation('__saved_notes__', 'Saved Messages', 'saved_notes');
  }

  // --- Conversations Middle Panel ---

  async loadConversations() {
    const list = await storage.getAllConversations();
    const container = document.getElementById('conversationsContainer');
    if (!container) return;

    let filtered = list;
    if (this.currentFilter === 'unread') {
      filtered = list.filter((c) => (c.unreadCount || 0) > 0);
    } else if (this.currentFilter === 'favorites') {
      filtered = list.filter((c) => c.isFavorite === true);
    } else if (this.currentFilter === 'groups') {
      filtered = list.filter((c) => c.isGroup === true);
    } else if (this.currentFilter === 'saved') {
      // Show saved messages notes and bookmarked messages
      filtered = list.filter((c) => c.contactUsername === '__saved_notes__');
    }

    container.innerHTML = '';
    const active = chat.getActiveContact();

    // Always provide Saved Messages pinned entry at top when filter is 'all' or 'saved'
    if (this.currentFilter === 'all' || this.currentFilter === 'saved') {
      const savedCard = document.createElement('div');
      savedCard.className = `chat-card ${active && active.username === '__saved_notes__' ? 'active' : ''}`;
      savedCard.innerHTML = `
        <div class="avatar-container">
          ${renderAvatarSvg('saved_notes', 46)}
        </div>
        <div class="chat-card-content">
          <div class="chat-card-top">
            <span class="chat-card-name" style="color: var(--deep-green); font-weight: 800;">Saved Messages</span>
            <span class="chat-card-time">Personal</span>
          </div>
          <div class="chat-card-bottom">
            <span class="chat-card-preview" style="color: var(--secondary-text);">Notes, drafts, and bookmarks</span>
          </div>
        </div>
      `;
      savedCard.addEventListener('click', () => this.openSavedNotesConversation());
      container.appendChild(savedCard);
    }

    if (filtered.length === 0 && this.currentFilter !== 'all' && this.currentFilter !== 'saved') {
      container.innerHTML = `
        <div class="grove-empty-state">
          <div class="grove-empty-icon">🍃</div>
          <p class="grove-empty-title">No conversations in this view.</p>
          <p class="grove-empty-subtitle">Change filters above or find Grove friends.</p>
        </div>
      `;
      return;
    }

    for (const conv of filtered) {
      if (conv.contactUsername === '__saved_notes__') continue; // Handled above

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
            <div style="display: flex; align-items: center; gap: 5px;">
              <span class="chat-card-name">${escapeHtml(conv.contactDisplayName || conv.contactUsername)}</span>
              ${conv.isFavorite ? `<span title="Favorite" style="font-size: 11px;">⭐</span>` : ''}
              ${conv.isMuted ? `<span title="Muted" style="font-size: 11px;">🔇</span>` : ''}
            </div>
            <span class="chat-card-time">${formatConversationTime(conv.lastTimestamp)}</span>
          </div>
          <div class="chat-card-bottom">
            <span class="chat-card-preview">${escapeHtml(conv.lastMessage || 'Say hello in Golden Grove!')}</span>
            ${conv.unreadCount > 0 ? `<span class="chat-unread-badge">${conv.unreadCount}</span>` : ''}
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        this.openConversation(conv.contactUsername, conv.contactDisplayName, conv.contactAvatar);
      });

      container.appendChild(card);
    }
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

    document.querySelectorAll('.chat-card').forEach((c) => c.classList.remove('active'));
    document.getElementById(`conv_${contact.username}`)?.classList.add('active');

    document.getElementById('appLayout')?.classList.add('mobile-chat-open');
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
    this.updatePinnedBanner();
    this.loadMessageHistory(contact.username);

    // Restore draft
    storage.getDraft(contact.username).then((draft) => {
      const input = document.getElementById('chatTextInput');
      const sendBtn = document.getElementById('sendGoldenBtn');
      if (input) {
        input.value = draft || '';
        input.style.height = 'auto';
        if (draft) input.style.height = Math.min(input.scrollHeight, 140) + 'px';
        if (sendBtn) sendBtn.disabled = !draft;
        input.focus();
      }
    });
  }

  updateConnectionPill(peer) {
    const pill = document.getElementById('chatConnectionPill');
    if (!pill) return;

    if (peer === '__saved_notes__') {
      const indicator = pill.querySelector('.conn-indicator');
      const label = pill.querySelector('.conn-label');
      indicator?.classList.remove('connecting', 'failed');
      indicator?.classList.add('connected');
      if (label) label.textContent = 'Personal Vault (Private IndexedDB)';
      return;
    }

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

    // Unread divider logic
    let firstUnreadFound = false;

    for (const msg of messages) {
      if (!msg.isOutgoing && msg.status !== 'read' && !firstUnreadFound) {
        const divider = document.createElement('div');
        divider.className = 'unread-divider-line';
        divider.innerHTML = `<span>Unread Messages</span>`;
        stream.appendChild(divider);
        firstUnreadFound = true;
      }
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

    // Delivery Status checks
    let statusCheck = '';
    if (isOut) {
      if (msg.status === 'sending') statusCheck = '🕒';
      else if (msg.status === 'sent') statusCheck = '✓';
      else if (msg.status === 'delivered') statusCheck = '✓✓';
      else if (msg.status === 'read') statusCheck = '✓✓';
      else if (msg.status === 'failed') statusCheck = '⚠️';
    }

    // 1. Quoted Reply Preview
    let replyHtml = '';
    if (msg.replyTo) {
      replyHtml = `
        <div class="msg-reply-quoted" data-reply-id="${escapeHtml(msg.replyTo.id)}">
          <div class="msg-reply-sender">@${escapeHtml(msg.replyTo.sender)}</div>
          <div class="msg-reply-text">${escapeHtml(msg.replyTo.text)}</div>
        </div>
      `;
    }

    // 2. File Attachments (Images, Videos, Audio, Documents, Spreadsheets, Archives, Code, Generic)
    let fileHtml = '';
    const filesList = Array.isArray(msg.files) && msg.files.length > 0
      ? msg.files
      : (msg.file ? [msg.file] : []);

    if (filesList.length > 0) {
      const currentUser = auth.getCurrentUser();
      const currentUsername = currentUser ? currentUser.username : '';

      const renderedCards = filesList.map((f) => {
        const cat = f.category || getFileCategory(f.name, f.mimeType);
        const badge = getFileCategoryBadge(cat);
        const safeName = f.sanitizedName || sanitizeFileName(f.name || 'file');
        const fileSizeText = formatFileSize(f.size || 0);

        // Build safe download & preview URLs with user parameter for access verification
        let downloadUrl = f.downloadUrl || f.dataUrl || '#';
        if (f.fileId) {
          downloadUrl = `/api/files/${encodeURIComponent(f.fileId)}/download?user=${encodeURIComponent(currentUsername)}`;
        }
        let previewUrl = f.previewUrl || f.dataUrl || downloadUrl;
        if (f.fileId) {
          previewUrl = `/api/files/${encodeURIComponent(f.fileId)}/preview?user=${encodeURIComponent(currentUsername)}`;
        }

        // 1. Image
        if (cat === 'image' || (f.mimeType && f.mimeType.startsWith('image/'))) {
          return `
            <div class="attachment-card-img" style="cursor: pointer;" data-lightbox-src="${escapeHtml(previewUrl)}" data-lightbox-name="${escapeHtml(safeName)}">
              <img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(safeName)}" loading="lazy" />
              <div style="position: absolute; bottom: 6px; right: 6px; display: flex; gap: 4px;">
                <a href="${escapeHtml(downloadUrl)}" download="${escapeHtml(safeName)}" class="btn-grove btn-sm-g btn-golden" style="padding: 4px 8px; font-size: 11px; text-decoration: none;" title="Download image" onclick="event.stopPropagation();">⬇</a>
              </div>
            </div>
          `;
        }

        // 2. Video
        if (cat === 'video' || (f.mimeType && f.mimeType.startsWith('video/'))) {
          return `
            <div class="chat-video-player-card">
              <video controls playsinline preload="metadata" src="${escapeHtml(previewUrl)}"></video>
              <div class="video-card-footer">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;">🎬 ${escapeHtml(safeName)}</span>
                <a href="${escapeHtml(downloadUrl)}" download="${escapeHtml(safeName)}" class="file-download-btn" title="Download video">⬇ ${fileSizeText}</a>
              </div>
            </div>
          `;
        }

        // 3. Audio
        if (cat === 'audio' || (f.mimeType && f.mimeType.startsWith('audio/'))) {
          return `
            <div class="chat-file-card" style="flex-direction: column; align-items: stretch;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div class="chat-file-icon-box" style="background: rgba(93, 146, 83, 0.15); color: var(--soft-green);">🎵</div>
                <div class="chat-file-text-col">
                  <span class="chat-file-title" title="${escapeHtml(safeName)}">${escapeHtml(safeName)}</span>
                  <div class="chat-file-sub">
                    <span class="chat-file-badge" style="background: rgba(93, 146, 83, 0.15); color: var(--soft-green);">Audio</span>
                    <span>${fileSizeText}</span>
                  </div>
                </div>
                <a href="${escapeHtml(downloadUrl)}" download="${escapeHtml(safeName)}" class="file-download-btn" title="Download Audio">⬇</a>
              </div>
              <audio controls preload="metadata" src="${escapeHtml(previewUrl)}" style="width: 100%; height: 32px; margin-top: 6px;"></audio>
            </div>
          `;
        }

        // 4. Documents, Spreadsheets, Presentations, PDFs, Archives, Code, Generic
        return `
          <div class="chat-file-card">
            <div class="chat-file-icon-box" style="background: ${badge.color}22; color: ${badge.color};">
              ${badge.icon}
            </div>
            <div class="chat-file-text-col">
              <span class="chat-file-title" title="${escapeHtml(safeName)}">${escapeHtml(safeName)}</span>
              <div class="chat-file-sub">
                <span class="chat-file-badge" style="background: ${badge.color}22; color: ${badge.color};">${badge.label}</span>
                <span>${fileSizeText}</span>
              </div>
            </div>
            <a href="${escapeHtml(downloadUrl)}" download="${escapeHtml(safeName)}" class="file-download-btn" title="Safe Download">
              ⬇ Download
            </a>
          </div>
        `;
      }).join('');

      fileHtml = `<div class="chat-files-grid">${renderedCards}</div>`;
    }

    // 3. Voice Note Audio Player
    let voiceHtml = '';
    if (msg.voice && msg.voice.audioUrl) {
      voiceHtml = `
        <div class="voice-bubble-player" data-audio-src="${escapeHtml(msg.voice.audioUrl)}">
          <button class="voice-play-btn" title="Play Voice Note">▶</button>
          <div class="voice-waveform-bar">
            <div class="voice-progress-fill"></div>
          </div>
          <span class="voice-duration-label">${formatVoiceDuration(msg.voice.duration || 0)}</span>
        </div>
      `;
    }

    // 4. Interactive Poll Card
    let pollHtml = '';
    if (msg.poll) {
      const user = auth.getCurrentUser();
      const pollStats = calculatePollVotes(msg.poll, user ? user.username : '');
      pollHtml = `
        <div class="poll-card">
          <div class="poll-question">📊 ${escapeHtml(pollStats.question)}</div>
          <div class="poll-options-group">
            ${pollStats.options
              .map(
                (opt) => `
              <button class="poll-option-btn ${opt.hasVoted ? 'user-voted' : ''}" data-poll-id="${msg.id}" data-opt-id="${opt.id}">
                <div class="poll-fill-meter" style="width: ${opt.percentage}%;"></div>
                <span class="poll-opt-text">${escapeHtml(opt.text)}</span>
                <span class="poll-opt-pct">${opt.percentage}% (${opt.votesCount})</span>
              </button>
            `
              )
              .join('')}
          </div>
          <div style="font-size: 11px; color: var(--secondary-text); margin-top: 6px; text-align: right;">
            ${pollStats.totalVotes} total votes
          </div>
        </div>
      `;
    }

    // 5. Reactions Chips
    const reactions = msg.reactions || {};
    const currentUser = auth.getCurrentUser();
    let reactionsChipsHtml = '';
    const reactionKeys = Object.keys(reactions);
    if (reactionKeys.length > 0) {
      reactionsChipsHtml = `
        <div class="msg-reactions-row">
          ${reactionKeys
            .map((emoji) => {
              const usersList = reactions[emoji] || [];
              const userReacted = currentUser && usersList.includes(currentUser.username.toLowerCase());
              return `
                <button class="reaction-chip ${userReacted ? 'user-reacted' : ''}" data-msg-id="${msg.id}" data-emoji="${emoji}" title="${usersList.join(', ')}">
                  <span>${emoji}</span> <span>${usersList.length}</span>
                </button>
              `;
            })
            .join('')}
        </div>
      `;
    }

    // 6. Action Pill on Hover (Reply, Quick React, More)
    const actionPillHtml = `
      <div class="msg-action-pill">
        <button class="msg-action-btn btn-reply-trigger" title="Reply">↩️</button>
        <button class="msg-action-btn btn-react-trigger" title="React">😊</button>
        <button class="msg-action-btn btn-pin-trigger" title="${msg.pinned ? 'Unpin' : 'Pin'}">📌</button>
        <button class="msg-action-btn btn-save-trigger" title="${msg.saved ? 'Unsave' : 'Save to Notes'}">🔖</button>
        <button class="msg-action-btn btn-copy-trigger" title="Copy text">📋</button>
        ${isOut ? `<button class="msg-action-btn btn-edit-trigger" title="Edit message">✏️</button>` : ''}
        ${isOut ? `<button class="msg-action-btn btn-delete-trigger" title="Delete message" style="color: var(--danger-red);">🗑️</button>` : ''}
      </div>
    `;

    // 7. Reaction Picker Popover (Hidden initially)
    const reactionPickerHtml = `
      <div class="reaction-picker-popover" style="display: none;">
        ${['❤️', '👍', '☀️', '🍃', '😂', '🙏', '🔥', '🎉'].map(
          (em) => `<button class="reaction-emoji-btn" data-msg-id="${msg.id}" data-emoji="${em}">${em}</button>`
        ).join('')}
      </div>
    `;

    row.innerHTML = `
      <div class="msg-bubble ${isOut ? 'bubble-out' : 'bubble-in'}">
        ${actionPillHtml}
        ${reactionPickerHtml}
        ${msg.pinned ? `<div style="font-size: 11px; color: var(--golden-yellow); font-weight: 800; margin-bottom: 4px;">📌 Pinned Message</div>` : ''}
        ${replyHtml}
        ${fileHtml}
        ${voiceHtml}
        ${pollHtml}
        ${msg.text ? `<p class="msg-text">${escapeHtml(msg.text)}</p>` : ''}
        ${reactionsChipsHtml}
        <div class="msg-meta-row">
          ${msg.saved ? `<span title="Saved in Notes" style="font-size: 11px;">🔖</span>` : ''}
          ${msg.edited ? `<span class="msg-edited-badge">(edited)</span>` : ''}
          <span>${formatMessageTime(msg.timestamp)}</span>
          ${isOut ? `<span class="check-status">${statusCheck}</span>` : ''}
        </div>
      </div>
    `;

    // Wire up events on the newly created bubble
    this.bindBubbleEvents(row, msg);

    stream.appendChild(row);
    if (shouldScroll) this.scrollToBottom();
  }

  bindBubbleEvents(row, msg) {
    // Reply click on quoted preview
    row.querySelector('.msg-reply-quoted')?.addEventListener('click', (e) => {
      const replyId = e.currentTarget.dataset.replyId;
      const targetMsg = document.getElementById(`msg_${replyId}`);
      if (targetMsg) {
        targetMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetMsg.classList.add('highlight-pulse');
        setTimeout(() => targetMsg.classList.remove('highlight-pulse'), 1200);
      }
    });

    // Image click -> Lightbox
    row.querySelectorAll('.attachment-card-img').forEach((imgEl) => {
      imgEl.addEventListener('click', (e) => {
        const src = imgEl.dataset.lightboxSrc;
        const name = imgEl.dataset.lightboxName;
        if (src) this.openLightbox(src, name);
      });
    });

    // Voice Player Play/Pause
    const voicePlayer = row.querySelector('.voice-bubble-player');
    if (voicePlayer) {
      const playBtn = voicePlayer.querySelector('.voice-play-btn');
      const progressFill = voicePlayer.querySelector('.voice-progress-fill');
      const durationLabel = voicePlayer.querySelector('.voice-duration-label');
      const audioSrc = voicePlayer.dataset.audioSrc;

      let audio = this.activeAudioElements.get(msg.id);
      if (!audio) {
        audio = new Audio(audioSrc);
        this.activeAudioElements.set(msg.id, audio);
      }

      playBtn?.addEventListener('click', () => {
        if (audio.paused) {
          // Pause any other playing audio
          this.activeAudioElements.forEach((a) => {
            if (a !== audio && !a.paused) a.pause();
          });
          audio.play();
          playBtn.textContent = '⏸';
        } else {
          audio.pause();
          playBtn.textContent = '▶';
        }
      });

      audio.ontimeupdate = () => {
        if (audio.duration) {
          const pct = (audio.currentTime / audio.duration) * 100;
          if (progressFill) progressFill.style.width = `${pct}%`;
          if (durationLabel) durationLabel.textContent = formatVoiceDuration(Math.round(audio.currentTime));
        }
      };

      audio.onended = () => {
        playBtn.textContent = '▶';
        if (progressFill) progressFill.style.width = '0%';
        if (durationLabel) durationLabel.textContent = formatVoiceDuration(msg.voice.duration || 0);
      };
    }

    // Poll Option Voting
    row.querySelectorAll('.poll-option-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const optId = btn.dataset.optId;
        await chat.votePoll(msg.id, optId);
      });
    });

    // Existing Reaction Chips Toggle
    row.querySelectorAll('.reaction-chip').forEach((chip) => {
      chip.addEventListener('click', async () => {
        const emoji = chip.dataset.emoji;
        await chat.sendReaction(msg.id, emoji);
      });
    });

    // Hover Action: Reply
    row.querySelector('.btn-reply-trigger')?.addEventListener('click', () => {
      this.setReplyingTo(msg);
    });

    // Hover Action: React (Show floating emoji picker)
    const picker = row.querySelector('.reaction-picker-popover');
    row.querySelector('.btn-react-trigger')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (picker) {
        picker.style.display = picker.style.display === 'flex' ? 'none' : 'flex';
      }
    });

    row.querySelectorAll('.reaction-emoji-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const emoji = btn.dataset.emoji;
        if (picker) picker.style.display = 'none';
        await chat.sendReaction(msg.id, emoji);
      });
    });

    // Hover Action: Pin
    row.querySelector('.btn-pin-trigger')?.addEventListener('click', async () => {
      await chat.togglePin(msg.id);
      this.updatePinnedBanner();
      this.showToast(msg.pinned ? 'Message unpinned' : 'Message pinned to chat header', 'info');
    });

    // Hover Action: Save to Notes
    row.querySelector('.btn-save-trigger')?.addEventListener('click', async () => {
      await chat.toggleSave(msg.id);
      this.showToast(msg.saved ? 'Removed from Saved Messages' : 'Saved to Saved Messages', 'copy');
    });

    // Hover Action: Copy text
    row.querySelector('.btn-copy-trigger')?.addEventListener('click', () => {
      const copyText = msg.text || (msg.file ? msg.file.name : '');
      if (copyText) {
        navigator.clipboard?.writeText(copyText);
        this.showToast('Message copied to clipboard', 'copy');
      }
    });

    // Hover Action: Edit Message (Outgoing only)
    row.querySelector('.btn-edit-trigger')?.addEventListener('click', async () => {
      const newText = prompt('Edit your message:', msg.text);
      if (newText !== null && newText.trim() !== '' && newText.trim() !== msg.text) {
        await chat.editMessage(msg.id, newText.trim());
        this.showToast('Message updated', 'success');
      }
    });

    // Hover Action: Delete Message (Outgoing only)
    row.querySelector('.btn-delete-trigger')?.addEventListener('click', async () => {
      if (confirm('Delete this message for everyone?')) {
        await chat.deleteMessage(msg.id);
        this.showToast('Message deleted', 'info');
      }
    });
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
    const replyTo = this.replyingTo;

    if (!text && !file) return;

    input.value = '';
    input.style.height = 'auto';
    if (sendBtn) sendBtn.disabled = true;

    this.clearPendingAttachment();
    this.clearReplyState();

    const active = chat.getActiveContact();
    if (active) storage.saveDraft(active.username, '');

    try {
      await chat.sendMessage(text, file, replyTo, null, null);
    } catch (err) {
      console.error('Failed to send:', err);
      this.showToast('Failed to send message: ' + err.message, 'error');
    }
  }

  handleFileSelected(file) {
    if (file) {
      this.openAttachmentModal([file]);
    }
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

  // --- Advanced File Sharing Modal ---

  openAttachmentModal(preselectedFiles = []) {
    const active = chat.getActiveContact();
    const currentUser = auth.getCurrentUser();
    if (!currentUser) {
      this.showToast('Please sign in to share files.', 'error');
      return;
    }
    if (!active) {
      this.showToast('Select a conversation to share files.', 'info');
      return;
    }

    // Add any preselected files into fileManager
    if (preselectedFiles && preselectedFiles.length > 0) {
      const { errors } = fileManager.addFiles(preselectedFiles);
      if (errors.length > 0) {
        errors.forEach((err) => this.showToast(err, 'error'));
      }
    }

    const modalHtml = `
      <div style="display: flex; flex-direction: column; height: 100%; max-height: inherit;">
        <div class="grove-modal-sheet-handle"></div>
        <div class="grove-modal-header">
          <div>
            <h3 class="modal-title-text">Share Files in Golden Grove</h3>
            <span style="font-size: 12px; color: var(--secondary-text);">Send securely to @${escapeHtml(active.displayName || active.username)}</span>
          </div>
          <button class="modal-dismiss-btn" id="modalDismissBtn" aria-label="Close">✕</button>
        </div>

        <div class="grove-modal-body" style="padding-top: 10px;">
          <!-- Quota Banner / Max Size Notice -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
            <div class="dropzone-quota-pill">
              <span>🛡️</span>
              <span>Max file size: <strong>50 MB</strong></span>
            </div>
            <div class="dropzone-quota-pill" style="color: var(--soft-green);">
              <span>⚡</span>
              <span>1 MB Chunked Resumable Transfer</span>
            </div>
          </div>

          <!-- Drag & Drop Upload Area -->
          <div class="attachment-dropzone" id="modalAttachmentDropzone">
            <input type="file" id="modalMultiFileInput" multiple style="display: none;" />
            <div class="dropzone-icon">📂</div>
            <h4 class="dropzone-title">Drag & drop files here</h4>
            <p class="dropzone-subtitle">Supports images, videos, audio, PDFs, docs, archives, and spreadsheets</p>
            <button type="button" class="btn-grove btn-outline btn-sm-g" id="modalBrowseFilesBtn">
              Choose Files
            </button>
          </div>

          <!-- Staged Files Queue -->
          <div style="margin-top: 16px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <strong style="font-size: 13.5px; color: var(--main-text);">
              Staged Files (<span id="stagedFilesCountLabel">${fileManager.stagedFiles.length}</span>)
            </strong>
            <button type="button" id="modalClearAllFilesBtn" style="background: none; border: none; font-size: 12px; color: var(--secondary-text); cursor: pointer; text-decoration: underline;" ${fileManager.stagedFiles.length === 0 ? 'disabled' : ''}>
              Clear All
            </button>
          </div>

          <div class="staged-files-list" id="modalStagedFilesList">
            <!-- Dynamically populated staged file cards -->
          </div>

          <!-- Optional Message Caption -->
          <div class="form-field-group" style="margin-top: 8px; margin-bottom: 0;">
            <label class="form-label-text" for="modalFileCaptionInput">Add a message (optional)</label>
            <input type="text" id="modalFileCaptionInput" class="form-control-input" placeholder="Say something about these files..." />
          </div>
        </div>

        <div class="grove-modal-footer" style="display: flex; gap: 10px;">
          <button type="button" class="btn-grove btn-outline" id="modalCancelFilesBtn" style="flex: 1;">Cancel</button>
          <button type="button" class="btn-grove btn-golden" id="modalSendFilesBtn" style="flex: 2;" ${fileManager.stagedFiles.filter((f) => f.status !== 'failed').length === 0 ? 'disabled' : ''}>
            Send Files in Grove
          </button>
        </div>
      </div>
    `;

    this.showModal(modalHtml);

    const renderStagedList = () => {
      const listEl = document.getElementById('modalStagedFilesList');
      const countLabel = document.getElementById('stagedFilesCountLabel');
      const sendBtn = document.getElementById('modalSendFilesBtn');
      const clearBtn = document.getElementById('modalClearAllFilesBtn');
      if (!listEl) return;

      const items = fileManager.stagedFiles;
      if (countLabel) countLabel.textContent = String(items.length);

      const validItems = items.filter((f) => f.status !== 'failed');
      if (sendBtn) {
        sendBtn.disabled = validItems.length === 0;
        const isUploading = items.some((f) => f.status === 'uploading');
        sendBtn.innerHTML = isUploading
          ? `<span>⏳</span> Uploading...`
          : `Send ${validItems.length} File${validItems.length === 1 ? '' : 's'}`;
      }
      if (clearBtn) clearBtn.disabled = items.length === 0;

      if (items.length === 0) {
        listEl.innerHTML = `
          <div style="padding: 24px; text-align: center; color: var(--secondary-text); font-size: 13px; background: rgba(85, 121, 69, 0.04); border-radius: 8px; border: 1px dashed var(--border-color);">
            No files staged yet. Drag and drop files above or click Choose Files.
          </div>
        `;
        return;
      }

      listEl.innerHTML = items
        .map((item) => {
          let thumbHtml = `<span>${item.badge.icon}</span>`;
          if (item.category === 'image' && item.previewObjectUrl) {
            thumbHtml = `<img src="${item.previewObjectUrl}" alt="thumb" />`;
          } else if (item.category === 'video' && item.previewObjectUrl) {
            thumbHtml = `<video src="${item.previewObjectUrl}" muted playsinline></video>`;
          }

          let statusBadgeText = item.status;
          let statusBadgeColor = 'var(--secondary-text)';
          if (item.status === 'completed') {
            statusBadgeText = 'Ready ✓';
            statusBadgeColor = 'var(--soft-green)';
          } else if (item.status === 'uploading') {
            statusBadgeText = `${item.progress}%`;
            statusBadgeColor = 'var(--deep-green)';
          } else if (item.status === 'paused') {
            statusBadgeText = 'Paused';
            statusBadgeColor = 'var(--golden-yellow)';
          } else if (item.status === 'failed') {
            statusBadgeText = 'Error';
            statusBadgeColor = 'var(--danger-red)';
          }

          return `
            <div class="staged-file-card" id="staged_card_${item.id}">
              <div class="staged-file-thumb">
                ${thumbHtml}
              </div>
              <div class="staged-file-info">
                <div class="staged-file-header">
                  <span class="staged-file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
                  <div class="staged-file-controls">
                    ${
                      item.status === 'uploading'
                        ? `<button class="staged-ctrl-btn ctrl-pause-btn" data-id="${item.id}" title="Pause upload">⏸</button>`
                        : ''
                    }
                    ${
                      item.status === 'paused'
                        ? `<button class="staged-ctrl-btn ctrl-resume-btn" data-id="${item.id}" title="Resume upload">▶</button>`
                        : ''
                    }
                    ${
                      item.status === 'failed' && !item.errorMsg.includes('blocked') && !item.errorMsg.includes('exceeds')
                        ? `<button class="staged-ctrl-btn ctrl-retry-btn" data-id="${item.id}" title="Retry upload">🔄</button>`
                        : ''
                    }
                    <button class="staged-ctrl-btn danger ctrl-remove-btn" data-id="${item.id}" title="Remove file">✕</button>
                  </div>
                </div>
                <div class="staged-file-meta">
                  <span class="staged-category-tag" style="background: ${item.badge.color}22; color: ${item.badge.color};">${item.badge.label}</span>
                  <span>${formatFileSize(item.size)}</span>
                  <span style="font-weight: 700; color: ${statusBadgeColor};">${statusBadgeText}</span>
                </div>
                <div class="staged-progress-track">
                  <div class="staged-progress-fill" style="width: ${item.progress || (item.status === 'completed' ? 100 : 0)}%;"></div>
                </div>
                ${item.errorMsg ? `<div class="staged-error-text">${escapeHtml(item.errorMsg)}</div>` : ''}
              </div>
            </div>
          `;
        })
        .join('');

      // Wire button events inside staged list
      listEl.querySelectorAll('.ctrl-pause-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          fileManager.pauseUpload(btn.dataset.id);
          renderStagedList();
        });
      });

      listEl.querySelectorAll('.ctrl-resume-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          await fileManager.resumeUpload(btn.dataset.id, currentUser.username, active.username, () => {
            renderStagedList();
          });
          renderStagedList();
        });
      });

      listEl.querySelectorAll('.ctrl-retry-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          await fileManager.resumeUpload(btn.dataset.id, currentUser.username, active.username, () => {
            renderStagedList();
          });
          renderStagedList();
        });
      });

      listEl.querySelectorAll('.ctrl-remove-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          fileManager.removeFile(btn.dataset.id);
          renderStagedList();
        });
      });
    };

    renderStagedList();

    // Dropzone events
    const dropzone = document.getElementById('modalAttachmentDropzone');
    const multiFileInput = document.getElementById('modalMultiFileInput');
    const browseBtn = document.getElementById('modalBrowseFilesBtn');

    browseBtn?.addEventListener('click', () => multiFileInput?.click());
    multiFileInput?.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const { errors } = fileManager.addFiles(files);
        if (errors.length > 0) {
          errors.forEach((err) => this.showToast(err, 'error'));
        }
        renderStagedList();
      }
    });

    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-active');
    });
    dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('drag-active'));
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-active');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const { errors } = fileManager.addFiles(files);
        if (errors.length > 0) {
          errors.forEach((err) => this.showToast(err, 'error'));
        }
        renderStagedList();
      }
    });

    document.getElementById('modalClearAllFilesBtn')?.addEventListener('click', () => {
      fileManager.clearStaged();
      renderStagedList();
    });

    document.getElementById('modalDismissBtn')?.addEventListener('click', () => {
      fileManager.clearStaged();
      this.hideModal();
    });

    document.getElementById('modalCancelFilesBtn')?.addEventListener('click', () => {
      fileManager.clearStaged();
      this.hideModal();
    });

    // Send action
    document.getElementById('modalSendFilesBtn')?.addEventListener('click', async () => {
      const sendBtn = document.getElementById('modalSendFilesBtn');
      const caption = document.getElementById('modalFileCaptionInput')?.value.trim() || '';

      if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = `<span>⏳</span> Uploading files...`;
      }

      try {
        // Upload all eligible files chunk-by-chunk
        await fileManager.uploadAll(currentUser.username, active.username, () => {
          renderStagedList();
        });

        const completedFiles = fileManager.stagedFiles
          .filter((f) => f.status === 'completed')
          .map((f) => ({
            fileId: f.fileId,
            name: f.sanitizedName || f.name,
            size: f.size,
            mimeType: f.mimeType,
            category: f.category,
            downloadUrl: f.downloadUrl || `/api/files/${f.fileId}/download`,
            previewUrl: f.previewUrl || `/api/files/${f.fileId}/preview`,
            dataUrl: f.previewObjectUrl || null,
          }));

        if (completedFiles.length === 0) {
          this.showToast('No files were successfully uploaded.', 'error');
          if (sendBtn) sendBtn.disabled = false;
          return;
        }

        // Send message with file records
        await chat.sendMessage(caption, null, this.replyingTo, null, null, completedFiles);
        this.clearReplyState();
        fileManager.clearStaged();
        this.hideModal();
        this.showToast(`Shared ${completedFiles.length} file${completedFiles.length === 1 ? '' : 's'} in Grove`, 'success');
      } catch (err) {
        console.error('File send error:', err);
        this.showToast('Failed to send files: ' + err.message, 'error');
        if (sendBtn) sendBtn.disabled = false;
      }
    });
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

  handleMessageUpdated(msg) {
    const existing = document.getElementById(`msg_${msg.id}`);
    if (existing) {
      const wasScrolledBottom = this.isScrolledToBottom();
      const parent = existing.parentNode;
      const nextSibling = existing.nextSibling;
      existing.remove();

      // Create new bubble and place it in the exact same spot
      const tempWrapper = document.createElement('div');
      this.appendMessageBubble(msg, false);
      const newEl = document.getElementById(`msg_${msg.id}`);
      if (newEl && nextSibling) {
        parent.insertBefore(newEl, nextSibling);
      }
      if (wasScrolledBottom) this.scrollToBottom();
    }
    this.updatePinnedBanner();
  }

  isScrolledToBottom() {
    const stream = document.getElementById('messagesHistoryStream');
    if (!stream) return true;
    return stream.scrollHeight - stream.scrollTop - stream.clientHeight < 40;
  }

  handleMessageDeleted(data) {
    const el = document.getElementById(`msg_${data.messageId}`);
    if (el) {
      el.classList.add('fade-out-anim');
      setTimeout(() => el.remove(), 250);
    }
    this.updatePinnedBanner();
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

  // --- Calling Interface (Voice & Video) ---

  openCallModal(peer, callType = 'voice') {
    const active = chat.getActiveContact();
    const targetName = active ? (active.displayName || active.username) : peer;
    const targetAvatar = active ? active.avatar : 'avatar_1';

    this.activeCall = { peer, callType, connected: false };
    this.callDurationSeconds = 0;

    const html = `
      <div class="call-overlay-dialog" id="callOverlayDialog">
        <div class="call-pulse-avatar">
          ${renderAvatarSvg(targetAvatar, 88)}
        </div>
        <h3 style="font-size: 22px; font-weight: 800; margin-bottom: 6px;">${escapeHtml(targetName)}</h3>
        <p style="font-size: 14px; opacity: 0.85;" id="callStatusIndicator">Ringing in Golden Grove...</p>
        <div style="font-size: 16px; font-weight: 700; margin-top: 10px; font-variant-numeric: tabular-nums;" id="callTimerLabel">00:00</div>

        ${callType === 'video' ? `
          <div style="width: 100%; height: 180px; background: rgba(0, 0, 0, 0.4); border-radius: 14px; margin-top: 16px; overflow: hidden; position: relative;">
            <video id="localVideoFeed" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover;"></video>
            <span style="position: absolute; bottom: 8px; left: 8px; font-size: 11px; background: rgba(0, 0, 0, 0.6); padding: 2px 6px; border-radius: 4px;">Local Camera</span>
          </div>
        ` : ''}

        <div class="call-controls-row">
          <button class="call-ctrl-btn" id="callMuteBtn" title="Mute Microphone">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
          </button>
          ${callType === 'video' ? `
            <button class="call-ctrl-btn" id="callCameraToggleBtn" title="Toggle Camera">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
            </button>
          ` : ''}
          <button class="call-ctrl-btn" id="callScreenShareBtn" title="Share Screen">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
          </button>
          <button class="call-ctrl-btn hangup" id="callEndBtn" title="End Call">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path><line x1="23" y1="1" x2="1" y2="23"></line></svg>
          </button>
        </div>
      </div>
    `;

    this.showModal(html);

    // Send call signal to peer
    chat.sendCallSignal(peer, 'offer', callType);

    // Acquire media if available
    navigator.mediaDevices?.getUserMedia({
      audio: true,
      video: callType === 'video',
    }).then((stream) => {
      this.localMediaStream = stream;
      if (callType === 'video') {
        const vid = document.getElementById('localVideoFeed');
        if (vid) vid.srcObject = stream;
      }
    }).catch(() => {
      // Audio or video permission not granted
    });

    // Simulate answering in demo/standalone after 2.5s for seamless testing
    setTimeout(() => {
      if (this.activeCall) {
        this.activeCall.connected = true;
        const status = document.getElementById('callStatusIndicator');
        if (status) status.textContent = `Connected (${callType === 'video' ? 'Encrypted Video' : 'HD Voice'})`;

        this.callTimerInterval = setInterval(() => {
          this.callDurationSeconds++;
          const mins = String(Math.floor(this.callDurationSeconds / 60)).padStart(2, '0');
          const secs = String(this.callDurationSeconds % 60).padStart(2, '0');
          const timer = document.getElementById('callTimerLabel');
          if (timer) timer.textContent = `${mins}:${secs}`;
        }, 1000);
      }
    }, 2500);

    // Call controls
    let isMuted = false;
    document.getElementById('callMuteBtn')?.addEventListener('click', (e) => {
      isMuted = !isMuted;
      this.localMediaStream?.getAudioTracks().forEach((t) => (t.enabled = !isMuted));
      e.currentTarget.style.backgroundColor = isMuted ? 'var(--danger-red)' : 'rgba(255, 255, 255, 0.18)';
      this.showToast(isMuted ? 'Microphone muted' : 'Microphone unmuted', 'info');
    });

    document.getElementById('callCameraToggleBtn')?.addEventListener('click', (e) => {
      const vidTrack = this.localMediaStream?.getVideoTracks()[0];
      if (vidTrack) {
        vidTrack.enabled = !vidTrack.enabled;
        e.currentTarget.style.backgroundColor = !vidTrack.enabled ? 'var(--danger-red)' : 'rgba(255, 255, 255, 0.18)';
      }
    });

    document.getElementById('callScreenShareBtn')?.addEventListener('click', async () => {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const vid = document.getElementById('localVideoFeed');
        if (vid) vid.srcObject = displayStream;
        this.showToast('Screen sharing started', 'success');
      } catch {
        // user canceled screen share
      }
    });

    document.getElementById('callEndBtn')?.addEventListener('click', () => {
      this.endCurrentCall();
    });
  }

  handleIncomingCallSignal(signal) {
    if (signal.action === 'offer') {
      const html = `
        <div class="call-overlay-dialog">
          <div class="call-pulse-avatar">
            ${renderAvatarSvg(signal.avatar || 'avatar_1', 88)}
          </div>
          <h3 style="font-size: 22px; font-weight: 800; margin-bottom: 6px;">${escapeHtml(signal.displayName || signal.caller)}</h3>
          <p style="font-size: 14px; opacity: 0.85;">Incoming ${signal.callType === 'video' ? 'Video' : 'Voice'} Call...</p>
          <div class="call-controls-row">
            <button class="call-ctrl-btn" id="acceptIncomingCallBtn" style="background-color: var(--online-green);" title="Accept Call">📞</button>
            <button class="call-ctrl-btn hangup" id="declineIncomingCallBtn" title="Decline">✕</button>
          </div>
        </div>
      `;
      this.showModal(html);

      document.getElementById('acceptIncomingCallBtn')?.addEventListener('click', () => {
        this.hideModal();
        this.openCallModal(signal.caller, signal.callType);
      });

      document.getElementById('declineIncomingCallBtn')?.addEventListener('click', () => {
        chat.sendCallSignal(signal.caller, 'reject', signal.callType);
        this.hideModal();
      });
    } else if (signal.action === 'end' || signal.action === 'reject') {
      this.endCurrentCall();
      this.showToast('Call ended by peer', 'info');
    }
  }

  endCurrentCall() {
    if (this.activeCall) {
      chat.sendCallSignal(this.activeCall.peer, 'end', this.activeCall.callType);
    }
    clearInterval(this.callTimerInterval);
    if (this.localMediaStream) {
      this.localMediaStream.getTracks().forEach((t) => t.stop());
      this.localMediaStream = null;
    }
    this.activeCall = null;
    this.hideModal();
  }

  // --- AI Assistant Modal ---

  openAiAssistantModal() {
    const active = chat.getActiveContact();
    const contactName = active ? (active.displayName || active.username) : 'Conversation';

    const html = `
      <div style="display: flex; flex-direction: column; height: 100%; max-height: inherit;">
        <div class="grove-modal-sheet-handle"></div>
        <div class="grove-modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">✨</span>
            <h3 class="modal-title-text">Grove AI Assistant</h3>
          </div>
          <button class="modal-dismiss-btn" id="modalDismissBtn" aria-label="Close">✕</button>
        </div>

        <div class="grove-modal-body">
          <p style="font-size: 13px; color: var(--secondary-text); margin-bottom: 16px;">
            Intelligent assistance for <strong>${escapeHtml(contactName)}</strong>. Powered by server-side Gemini 2.5 Flash proxy.
          </p>

          <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;">
            <button class="btn-grove btn-outline btn-block-g ai-action-trigger" data-action="summarize" style="text-align: left; justify-content: flex-start;">
              <span>📝</span> <strong>Summarize Conversation</strong> — Get 2-3 key takeaways
            </button>
            <button class="btn-grove btn-outline btn-block-g ai-action-trigger" data-action="suggest_replies" style="text-align: left; justify-content: flex-start;">
              <span>💡</span> <strong>Suggest Smart Replies</strong> — Fast conversational answers
            </button>
            <button class="btn-grove btn-outline btn-block-g ai-action-trigger" data-action="rewrite_tone" style="text-align: left; justify-content: flex-start;">
              <span>🎨</span> <strong>Tone Polish</strong> — Make current draft warm & graceful
            </button>
            <button class="btn-grove btn-outline btn-block-g ai-action-trigger" data-action="extract_tasks" style="text-align: left; justify-content: flex-start;">
              <span>✅</span> <strong>Extract Action Items</strong> — Identify commitments & dates
            </button>
            <button class="btn-grove btn-outline btn-block-g ai-action-trigger" data-action="translate" style="text-align: left; justify-content: flex-start;">
              <span>🌐</span> <strong>Translate to Spanish</strong> — Multilingual communication
            </button>
          </div>

          <div id="aiResultCard" style="display: none; background: var(--main-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 14px; margin-top: 10px;">
            <h4 style="font-size: 13px; font-weight: 800; color: var(--deep-green); margin-bottom: 8px;" id="aiResultHeading">AI Result</h4>
            <div id="aiResultContent" style="font-size: 13.5px; line-height: 1.5; white-space: pre-wrap; margin-bottom: 12px;"></div>
            <div style="display: flex; gap: 8px;">
              <button class="btn-grove btn-golden btn-sm-g" id="aiInsertComposerBtn">Insert in Composer</button>
              <button class="btn-grove btn-outline btn-sm-g" id="aiCopyResultBtn">Copy</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.showModal(html);
    document.getElementById('modalDismissBtn')?.addEventListener('click', () => this.hideModal());

    document.querySelectorAll('.ai-action-trigger').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        const resultCard = document.getElementById('aiResultCard');
        const resultContent = document.getElementById('aiResultContent');
        const resultHeading = document.getElementById('aiResultHeading');

        if (resultCard && resultContent) {
          resultCard.style.display = 'block';
          resultContent.innerHTML = '<em>Thinking peacefully in Golden Grove...</em>';
        }

        // Gather context
        let text = '';
        if (action === 'rewrite_tone') {
          const input = document.getElementById('chatTextInput');
          text = input ? input.value : '';
          if (!text) text = 'Hey, are you free to meet tomorrow at the park?';
        } else {
          const stream = document.getElementById('messagesHistoryStream');
          const bubbles = stream?.querySelectorAll('.msg-text');
          const msgsArr = [];
          bubbles?.forEach((b) => msgsArr.push(b.textContent));
          text = msgsArr.slice(-10).join('\n') || 'Hello! Welcome to Golden Grove.';
        }

        try {
          const res = await fetch('/api/ai/assist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, text, tone: 'warm and encouraging', targetLang: 'Spanish' }),
          });
          const data = await res.json();

          if (!data.configured) {
            resultHeading.textContent = 'Assistant Configuration Notice';
            resultContent.textContent = data.message;
            return;
          }

          resultHeading.textContent = 'Golden Grove AI Response';
          resultContent.textContent = data.result || 'No response generated.';

          document.getElementById('aiInsertComposerBtn').onclick = () => {
            const input = document.getElementById('chatTextInput');
            const sendBtn = document.getElementById('sendGoldenBtn');
            if (input) {
              input.value = data.result;
              input.dispatchEvent(new Event('input'));
              input.focus();
            }
            if (sendBtn) sendBtn.disabled = false;
            this.hideModal();
          };

          document.getElementById('aiCopyResultBtn').onclick = () => {
            navigator.clipboard?.writeText(data.result);
            this.showToast('AI response copied', 'copy');
          };
        } catch (err) {
          if (resultContent) resultContent.textContent = 'Assistant request failed: ' + err.message;
        }
      });
    });
  }

  // --- Command Palette Modal (Ctrl + K) ---

  async openCommandPalette() {
    const convs = await storage.getAllConversations();
    const friends = await users.getFriends();

    const html = `
      <div class="command-palette-dialog">
        <div class="palette-search-row">
          <span style="font-size: 18px;">🔍</span>
          <input type="text" id="paletteSearchInput" class="palette-search-input" placeholder="Search chats, friends, or jump to settings..." autofocus />
          <span class="palette-badge">ESC to close</span>
        </div>
        <div class="palette-list" id="paletteResultsList">
          <!-- Dynamically populated -->
        </div>
      </div>
    `;

    this.showModal(html);
    const input = document.getElementById('paletteSearchInput');
    const list = document.getElementById('paletteResultsList');

    const renderItems = (q = '') => {
      const query = q.toLowerCase();
      const actions = [
        { label: 'Saved Messages & Notes', icon: '🔖', action: () => this.openSavedNotesConversation() },
        { label: 'Chat Appearance & Wallpapers', icon: '🎨', action: () => this.openAppearanceModal() },
        { label: 'Toggle Dark / Light Theme', icon: '🌓', action: () => this.toggleThemeMode() },
        { label: 'Find Grove Friends', icon: '🌳', action: () => this.switchMainView('friends') },
        { label: 'Friend Requests', icon: '💌', action: () => this.switchMainView('requests') },
        { label: 'Account Settings', icon: '⚙️', action: () => this.openSettingsModal() },
        { label: 'Keyboard Shortcuts Help', icon: '⌨️', action: () => this.openShortcutsModal() },
      ];

      let output = '';

      // Conversation matches
      const matchedConvs = convs.filter((c) => (c.contactDisplayName || c.contactUsername).toLowerCase().includes(query));
      if (matchedConvs.length > 0) {
        output += `<div style="font-size: 11px; font-weight: 800; color: var(--deep-green); padding: 6px 14px; text-transform: uppercase;">Conversations</div>`;
        matchedConvs.forEach((c) => {
          output += `
            <div class="palette-item" data-type="conv" data-user="${c.contactUsername}">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span>💬</span>
                <span>${escapeHtml(c.contactDisplayName || c.contactUsername)}</span>
              </div>
              <span class="palette-badge">Chat</span>
            </div>
          `;
        });
      }

      // Quick Actions
      const matchedActions = actions.filter((a) => a.label.toLowerCase().includes(query));
      if (matchedActions.length > 0) {
        output += `<div style="font-size: 11px; font-weight: 800; color: var(--deep-green); padding: 6px 14px; text-transform: uppercase; margin-top: 6px;">Actions</div>`;
        matchedActions.forEach((a, idx) => {
          output += `
            <div class="palette-item" data-type="action" data-idx="${idx}">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span>${a.icon}</span>
                <span>${a.label}</span>
              </div>
              <span class="palette-badge">Jump</span>
            </div>
          `;
        });
      }

      if (!output) {
        output = `<div style="padding: 24px; text-align: center; color: var(--secondary-text); font-size: 13.5px;">No matches found for "${escapeHtml(q)}"</div>`;
      }

      list.innerHTML = output;

      list.querySelectorAll('.palette-item').forEach((item) => {
        item.addEventListener('click', () => {
          this.hideModal();
          if (item.dataset.type === 'conv') {
            const user = item.dataset.user;
            const target = convs.find((c) => c.contactUsername === user);
            this.switchMainView('chats');
            this.openConversation(user, target?.contactDisplayName || user, target?.contactAvatar);
          } else if (item.dataset.type === 'action') {
            matchedActions[Number(item.dataset.idx)].action();
          }
        });
      });
    };

    renderItems('');
    input?.addEventListener('input', (e) => renderItems(e.target.value));
    setTimeout(() => input?.focus(), 80);
  }

  toggleThemeMode() {
    const cur = storage.getPreference('theme', 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    storage.setPreference('theme', next);
    document.body.setAttribute('data-theme', next);
    this.showToast(`Switched to ${next === 'dark' ? 'Dark Forest' : 'Warm Light'} mode`, 'info');
  }

  // --- Chat Customization & Appearance Modal ---

  openAppearanceModal() {
    const currentPalette = storage.getPreference('palette', 'default');
    const currentTheme = storage.getPreference('theme', 'light');
    const currentWallpaper = storage.getPreference('wallpaper', 'grove');
    const currentBubble = storage.getPreference('bubble', 'leaf');
    const currentSpacing = storage.getPreference('spacing', 'comfortable');
    const currentFontSize = storage.getPreference('fontSize', 'normal');

    const html = `
      <div style="display: flex; flex-direction: column; height: 100%; max-height: inherit;">
        <div class="grove-modal-sheet-handle"></div>
        <div class="grove-modal-header">
          <h3 class="modal-title-text">Chat Customization & Appearance</h3>
          <button class="modal-dismiss-btn" id="modalDismissBtn" aria-label="Close">✕</button>
        </div>

        <div class="grove-modal-body">
          <!-- 1. Color Palettes -->
          <div style="margin-bottom: 16px;">
            <label class="form-label-text">Brand Theme Palette</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <button class="btn-grove ${currentPalette === 'default' ? 'btn-golden' : 'btn-outline'} palette-choice-btn" data-palette="default">
                🌿 Golden Grove (Default)
              </button>
              <button class="btn-grove ${currentPalette === 'forest' ? 'btn-golden' : 'btn-outline'} palette-choice-btn" data-palette="forest">
                🌲 Forest Green
              </button>
              <button class="btn-grove ${currentPalette === 'sun' ? 'btn-golden' : 'btn-outline'} palette-choice-btn" data-palette="sun">
                ☀️ Golden Sun
              </button>
              <button class="btn-grove ${currentPalette === 'cream' ? 'btn-golden' : 'btn-outline'} palette-choice-btn" data-palette="cream">
                🌾 Warm Cream
              </button>
            </div>
          </div>

          <!-- 2. Dark/Light Mode -->
          <div style="margin-bottom: 16px;">
            <label class="form-label-text">Mode</label>
            <div style="display: flex; gap: 8px;">
              <button class="btn-grove ${currentTheme === 'light' ? 'btn-golden' : 'btn-outline'} mode-choice-btn" data-theme="light" style="flex: 1;">
                ☀️ Warm Light
              </button>
              <button class="btn-grove ${currentTheme === 'dark' ? 'btn-golden' : 'btn-outline'} mode-choice-btn" data-theme="dark" style="flex: 1;">
                🌙 Dark Forest
              </button>
            </div>
          </div>

          <!-- 3. Wallpapers -->
          <div style="margin-bottom: 16px;">
            <label class="form-label-text">Chat Wallpaper</label>
            <select id="wallpaperSelect" class="form-control-select">
              <option value="grove" ${currentWallpaper === 'grove' ? 'selected' : ''}>Grove Lattice</option>
              <option value="sunlight" ${currentWallpaper === 'sunlight' ? 'selected' : ''}>Gentle Sunlight</option>
              <option value="fern" ${currentWallpaper === 'fern' ? 'selected' : ''}>Organic Fern</option>
              <option value="minimal" ${currentWallpaper === 'minimal' ? 'selected' : ''}>Minimal Clean</option>
              <option value="starry" ${currentWallpaper === 'starry' ? 'selected' : ''}>Starry Canopy</option>
            </select>
          </div>

          <!-- 4. Bubble Styles -->
          <div style="margin-bottom: 16px;">
            <label class="form-label-text">Bubble Style</label>
            <div style="display: flex; gap: 8px;">
              <button class="btn-grove ${currentBubble === 'leaf' ? 'btn-golden' : 'btn-outline'} bubble-choice-btn" data-bubble="leaf" style="flex: 1;">
                🍃 Leaf Asymmetric
              </button>
              <button class="btn-grove ${currentBubble === 'rounded' ? 'btn-golden' : 'btn-outline'} bubble-choice-btn" data-bubble="rounded" style="flex: 1;">
                ⚪ Rounded
              </button>
              <button class="btn-grove ${currentBubble === 'classic' ? 'btn-golden' : 'btn-outline'} bubble-choice-btn" data-bubble="classic" style="flex: 1;">
                ◽ Classic
              </button>
            </div>
          </div>

          <!-- 5. Spacing & Font Size -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <div>
              <label class="form-label-text">Message Spacing</label>
              <select id="spacingSelect" class="form-control-select">
                <option value="comfortable" ${currentSpacing === 'comfortable' ? 'selected' : ''}>Comfortable</option>
                <option value="compact" ${currentSpacing === 'compact' ? 'selected' : ''}>Compact</option>
              </select>
            </div>
            <div>
              <label class="form-label-text">Text Size</label>
              <select id="fontSizeSelect" class="form-control-select">
                <option value="small" ${currentFontSize === 'small' ? 'selected' : ''}>Small</option>
                <option value="normal" ${currentFontSize === 'normal' ? 'selected' : ''}>Normal</option>
                <option value="large" ${currentFontSize === 'large' ? 'selected' : ''}>Large</option>
              </select>
            </div>
          </div>
        </div>

        <div class="grove-modal-footer">
          <button class="btn-grove btn-outline btn-block-g" id="resetAppearanceBtn">Reset to Defaults</button>
          <button class="btn-grove btn-golden btn-block-g" id="saveAppearanceDoneBtn">Done</button>
        </div>
      </div>
    `;

    this.showModal(html);
    document.getElementById('modalDismissBtn')?.addEventListener('click', () => this.hideModal());
    document.getElementById('saveAppearanceDoneBtn')?.addEventListener('click', () => this.hideModal());

    // Palette triggers
    document.querySelectorAll('.palette-choice-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.palette-choice-btn').forEach((b) => b.className = 'btn-grove btn-outline palette-choice-btn');
        btn.className = 'btn-grove btn-golden palette-choice-btn';
        const p = btn.dataset.palette;
        storage.setPreference('palette', p);
        document.body.setAttribute('data-palette', p);
      });
    });

    // Theme mode triggers
    document.querySelectorAll('.mode-choice-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-choice-btn').forEach((b) => b.className = 'btn-grove btn-outline mode-choice-btn');
        btn.className = 'btn-grove btn-golden mode-choice-btn';
        const t = btn.dataset.theme;
        storage.setPreference('theme', t);
        document.body.setAttribute('data-theme', t);
      });
    });

    // Wallpaper trigger
    document.getElementById('wallpaperSelect')?.addEventListener('change', (e) => {
      const w = e.target.value;
      storage.setPreference('wallpaper', w);
      document.body.setAttribute('data-wallpaper', w);
    });

    // Bubble style trigger
    document.querySelectorAll('.bubble-choice-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.bubble-choice-btn').forEach((b) => b.className = 'btn-grove btn-outline bubble-choice-btn');
        btn.className = 'btn-grove btn-golden bubble-choice-btn';
        const bStyle = btn.dataset.bubble;
        storage.setPreference('bubble', bStyle);
        document.body.setAttribute('data-bubble', bStyle);
      });
    });

    // Spacing trigger
    document.getElementById('spacingSelect')?.addEventListener('change', (e) => {
      const sp = e.target.value;
      storage.setPreference('spacing', sp);
      document.body.setAttribute('data-spacing', sp);
    });

    // Font size trigger
    document.getElementById('fontSizeSelect')?.addEventListener('change', (e) => {
      const fz = e.target.value;
      storage.setPreference('fontSize', fz);
      document.body.setAttribute('data-font-size', fz);
    });

    // Reset button
    document.getElementById('resetAppearanceBtn')?.addEventListener('click', () => {
      storage.setPreference('palette', 'default');
      storage.setPreference('theme', 'light');
      storage.setPreference('wallpaper', 'grove');
      storage.setPreference('bubble', 'leaf');
      storage.setPreference('spacing', 'comfortable');
      storage.setPreference('fontSize', 'normal');
      this.applySavedPreferences();
      this.openAppearanceModal();
      this.showToast('Reset appearance to Golden Grove defaults', 'info');
    });
  }

  // --- Keyboard Shortcuts Help Modal ---

  openShortcutsModal() {
    const html = `
      <div style="display: flex; flex-direction: column; height: 100%; max-height: inherit;">
        <div class="grove-modal-sheet-handle"></div>
        <div class="grove-modal-header">
          <h3 class="modal-title-text">Keyboard Shortcuts</h3>
          <button class="modal-dismiss-btn" id="modalDismissBtn" aria-label="Close">✕</button>
        </div>

        <div class="grove-modal-body">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
              <span>Open Command Palette</span>
              <span class="palette-badge">Ctrl + K / ⌘ + K</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
              <span>Send Message</span>
              <span class="palette-badge">Enter</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
              <span>New Line in Composer</span>
              <span class="palette-badge">Shift + Enter</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
              <span>Close Modal / Cancel Reply</span>
              <span class="palette-badge">Esc</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
              <span>Keyboard Shortcuts Cheat Sheet</span>
              <span class="palette-badge">?</span>
            </div>
          </div>
        </div>

        <div class="grove-modal-footer">
          <button class="btn-grove btn-golden btn-block-g" id="closeShortcutsBtn">Got It</button>
        </div>
      </div>
    `;

    this.showModal(html);
    document.getElementById('modalDismissBtn')?.addEventListener('click', () => this.hideModal());
    document.getElementById('closeShortcutsBtn')?.addEventListener('click', () => this.hideModal());
  }

  // --- User Profile Preview with Block & Report ---

  async openUserProfilePreview(username) {
    const allUsers = await users.searchUsers(username);
    const target = allUsers.find((u) => u.username === username.toLowerCase()) || {
      username,
      displayName: username,
      avatar: 'avatar_1',
      bio: 'Living peacefully in Golden Grove.',
      isOnline: webrtc.getConnectionStatus(username) === 'connected',
    };

    const html = `
      <div style="display: flex; flex-direction: column; height: 100%; max-height: inherit;">
        <div class="grove-modal-sheet-handle"></div>
        <div class="grove-modal-header">
          <h3 class="modal-title-text">Profile Preview</h3>
          <button class="modal-dismiss-btn" id="modalDismissBtn" aria-label="Close">✕</button>
        </div>

        <div class="grove-modal-body" style="text-align: center;">
          <div style="display: flex; justify-content: center; margin-bottom: 12px;">
            ${renderAvatarSvg(target.avatar, 72)}
          </div>
          <h3 style="font-size: 18px; font-weight: 800; color: var(--main-text);">${escapeHtml(target.displayName)}</h3>
          <span style="font-size: 13px; color: var(--deep-green); font-weight: 700;">@${escapeHtml(target.username)}</span>
          <p style="font-size: 13px; color: var(--secondary-text); margin: 12px 0 16px;">${escapeHtml(target.bio || '')}</p>

          <div style="display: flex; justify-content: center; gap: 8px; margin-bottom: 20px;">
            <button class="btn-grove btn-golden btn-sm-g" id="previewMsgBtn">Message</button>
            <button class="btn-grove btn-outline btn-sm-g" id="previewReportBtn">Report Member</button>
            <button class="btn-grove btn-danger-soft btn-sm-g" id="previewBlockBtn">Block Member</button>
          </div>
        </div>
      </div>
    `;

    this.showModal(html);
    document.getElementById('modalDismissBtn')?.addEventListener('click', () => this.hideModal());

    document.getElementById('previewMsgBtn')?.addEventListener('click', () => {
      this.hideModal();
      this.switchMainView('chats');
      this.openConversation(target.username, target.displayName, target.avatar);
    });

    document.getElementById('previewReportBtn')?.addEventListener('click', () => {
      const reason = prompt(`Reason for reporting @${target.username}:`);
      if (reason) {
        this.showToast(`Report submitted for @${target.username}. Thank you for keeping Golden Grove safe.`, 'success');
        this.hideModal();
      }
    });

    document.getElementById('previewBlockBtn')?.addEventListener('click', () => {
      if (confirm(`Block @${target.username}? You will no longer receive peer messages from this user.`)) {
        this.showToast(`@${target.username} has been blocked`, 'info');
        this.hideModal();
      }
    });
  }

  // --- Create Poll Modal ---

  openCreatePollModal() {
    const html = `
      <div style="display: flex; flex-direction: column; height: 100%; max-height: inherit;">
        <div class="grove-modal-sheet-handle"></div>
        <div class="grove-modal-header">
          <h3 class="modal-title-text">Create Group Poll</h3>
          <button class="modal-dismiss-btn" id="modalDismissBtn" aria-label="Close">✕</button>
        </div>

        <div class="grove-modal-body">
          <form id="createPollForm">
            <div class="form-field-group">
              <label for="pollQuestionInput" class="form-label-text">Poll Question</label>
              <input type="text" id="pollQuestionInput" class="form-control-input" placeholder="e.g. Which Grove park should we visit?" required />
            </div>

            <div class="form-field-group">
              <label class="form-label-text">Options</label>
              <input type="text" class="form-control-input poll-opt-input" placeholder="Option 1" required style="margin-bottom: 8px;" />
              <input type="text" class="form-control-input poll-opt-input" placeholder="Option 2" required style="margin-bottom: 8px;" />
              <input type="text" class="form-control-input poll-opt-input" placeholder="Option 3 (optional)" style="margin-bottom: 8px;" />
              <input type="text" class="form-control-input poll-opt-input" placeholder="Option 4 (optional)" />
            </div>
          </form>
        </div>

        <div class="grove-modal-footer">
          <button type="submit" form="createPollForm" class="btn-grove btn-golden btn-block-g">Create Poll</button>
        </div>
      </div>
    `;

    this.showModal(html);
    document.getElementById('modalDismissBtn')?.addEventListener('click', () => this.hideModal());

    document.getElementById('createPollForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const question = document.getElementById('pollQuestionInput')?.value.trim();
      const optionInputs = document.querySelectorAll('.poll-opt-input');
      const options = [];

      optionInputs.forEach((inp, idx) => {
        const txt = inp.value.trim();
        if (txt) {
          options.push({ id: `opt_${idx + 1}`, text: txt, votes: [] });
        }
      });

      if (options.length < 2) {
        alert('Please provide at least 2 options for the poll.');
        return;
      }

      const pollData = { question, options };
      const active = chat.getActiveContact();
      if (active) {
        await chat.sendMessage('', null, null, null, pollData);
        this.hideModal();
      }
    });
  }

  // --- New Chat or Group Modal ---

  async openNewChatOrGroupModal() {
    const friends = await users.getFriends();

    const html = `
      <div style="display: flex; flex-direction: column; height: 100%; max-height: inherit;">
        <div class="grove-modal-sheet-handle"></div>
        <div class="grove-modal-header">
          <h3 class="modal-title-text">Start New Conversation</h3>
          <button class="modal-dismiss-btn" id="modalDismissBtn" aria-label="Close">✕</button>
        </div>

        <div class="auth-nav-toggle" style="margin: 0 20px 12px;">
          <button class="auth-toggle-tab active" id="modalTabDirect">Direct Message</button>
          <button class="auth-toggle-tab" id="modalTabGroup">Create Group</button>
        </div>

        <div class="grove-modal-body" id="newChatModalBody">
          <!-- Direct Message section -->
          <div id="directMessageSection">
            <div class="search-wrapper" style="margin-bottom: 12px;">
              <span class="search-icon-left">🔍</span>
              <input type="text" id="directSearchFriendInput" class="search-input-field" placeholder="Search friends or usernames..." />
            </div>
            <div id="directFriendsList" style="display: flex; flex-direction: column; gap: 8px;">
              ${friends.length === 0 ? `
                <div class="grove-empty-state">
                  <p class="grove-empty-subtitle">No friends added yet. Type a username above to search all members.</p>
                </div>
              ` : friends.map((f) => `
                <div class="friend-grove-card">
                  <div class="avatar-container">${renderAvatarSvg(f.avatar, 44)}</div>
                  <div style="flex: 1; min-width: 0;">
                    <h4 style="font-size: 14.5px; font-weight: 800; color: var(--main-text);">${escapeHtml(f.displayName)}</h4>
                    <span style="font-size: 11.5px; color: var(--deep-green); font-weight: 600;">@${escapeHtml(f.username)}</span>
                  </div>
                  <button class="btn-grove btn-golden btn-sm-g start-direct-chat-btn" data-user="${f.username}" data-name="${escapeHtml(f.displayName)}" data-avatar="${f.avatar}">Chat</button>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Group Creation section -->
          <div id="createGroupSection" style="display: none;">
            <div class="form-field-group">
              <label for="groupNameInput" class="form-label-text">Group Name</label>
              <input type="text" id="groupNameInput" class="form-control-input" placeholder="e.g. Grove Book Club" required />
            </div>
            <div class="form-field-group">
              <label for="groupTopicInput" class="form-label-text">Group Topic / Announcement</label>
              <input type="text" id="groupTopicInput" class="form-control-input" placeholder="Weekly readings and peaceful thoughts" />
            </div>
            <label class="form-label-text">Select Friends to Invite</label>
            <div style="max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px;">
              ${friends.map((f) => `
                <label style="display: flex; align-items: center; gap: 10px; padding: 6px 10px; background: var(--main-bg); border-radius: 8px; cursor: pointer;">
                  <input type="checkbox" class="group-friend-check" value="${f.username}" />
                  ${renderAvatarSvg(f.avatar, 32)}
                  <span style="font-size: 13.5px; font-weight: 600;">${escapeHtml(f.displayName)} (@${escapeHtml(f.username)})</span>
                </label>
              `).join('')}
            </div>
            <button class="btn-grove btn-golden btn-block-g" id="submitCreateGroupBtn">Create Grove Group</button>
          </div>
        </div>
      </div>
    `;

    this.showModal(html);
    document.getElementById('modalDismissBtn')?.addEventListener('click', () => this.hideModal());

    const tabDirect = document.getElementById('modalTabDirect');
    const tabGroup = document.getElementById('modalTabGroup');
    const secDirect = document.getElementById('directMessageSection');
    const secGroup = document.getElementById('createGroupSection');

    tabDirect?.addEventListener('click', () => {
      tabDirect.classList.add('active');
      tabGroup?.classList.remove('active');
      secDirect.style.display = 'block';
      secGroup.style.display = 'none';
    });

    tabGroup?.addEventListener('click', () => {
      tabGroup.classList.add('active');
      tabDirect?.classList.remove('active');
      secDirect.style.display = 'none';
      secGroup.style.display = 'block';
    });

    document.querySelectorAll('.start-direct-chat-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.hideModal();
        this.switchMainView('chats');
        this.openConversation(btn.dataset.user, btn.dataset.name, btn.dataset.avatar);
      });
    });

    // Search input
    const directSearch = document.getElementById('directSearchFriendInput');
    directSearch?.addEventListener('input', async (e) => {
      const q = e.target.value.trim();
      const listContainer = document.getElementById('directFriendsList');
      if (!listContainer) return;

      const results = await users.searchUsers(q);
      listContainer.innerHTML = results.map((u) => `
        <div class="friend-grove-card">
          <div class="avatar-container">${renderAvatarSvg(u.avatar, 44)}</div>
          <div style="flex: 1; min-width: 0;">
            <h4 style="font-size: 14.5px; font-weight: 800; color: var(--main-text);">${escapeHtml(u.displayName)}</h4>
            <span style="font-size: 11.5px; color: var(--deep-green); font-weight: 600;">@${escapeHtml(u.username)}</span>
          </div>
          <button class="btn-grove btn-golden btn-sm-g start-direct-chat-btn" data-user="${u.username}" data-name="${escapeHtml(u.displayName)}" data-avatar="${u.avatar}">Chat</button>
        </div>
      `).join('');

      listContainer.querySelectorAll('.start-direct-chat-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.hideModal();
          this.switchMainView('chats');
          this.openConversation(btn.dataset.user, btn.dataset.name, btn.dataset.avatar);
        });
      });
    });

    // Submit group creation
    document.getElementById('submitCreateGroupBtn')?.addEventListener('click', async () => {
      const name = document.getElementById('groupNameInput')?.value.trim();
      const topic = document.getElementById('groupTopicInput')?.value.trim();
      if (!name) {
        alert('Please enter a group name');
        return;
      }
      const checkedFriends = Array.from(document.querySelectorAll('.group-friend-check:checked')).map((c) => c.value);
      const groupId = `group_${Date.now()}`;

      const groupConv = {
        id: groupId,
        contactUsername: groupId,
        contactDisplayName: name,
        contactAvatar: 'avatar_2',
        lastMessage: topic ? `Announcement: ${topic}` : 'Group created in Golden Grove.',
        lastTimestamp: Date.now(),
        unreadCount: 0,
        isGroup: true,
        isFavorite: false,
        members: checkedFriends,
      };

      await storage.saveConversation(groupConv);
      this.hideModal();
      this.switchMainView('chats');
      this.openConversation(groupId, name, 'avatar_2');
      this.showToast(`Group "${name}" created!`, 'success');
    });
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
          <div class="avatar-container" style="cursor: pointer;" data-user="${f.username}">
            ${renderAvatarSvg(f.avatar, 50)}
            <span class="pulse-online-dot ${f.isOnline ? 'online' : ''}"></span>
          </div>
          <div style="flex: 1; min-width: 0;">
            <h4 style="font-size: 15px; font-weight: 800; color: var(--main-text); cursor: pointer;" class="open-prof-click" data-user="${f.username}">${escapeHtml(f.displayName)}</h4>
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

      grid.querySelectorAll('.open-prof-click').forEach((el) => {
        el.addEventListener('click', () => this.openUserProfilePreview(el.dataset.user));
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
              <div class="avatar-container" style="cursor: pointer;" class="open-prof-click" data-user="${u.username}">
                ${renderAvatarSvg(u.avatar, 50)}
                <span class="pulse-online-dot ${u.isOnline ? 'online' : ''}"></span>
              </div>
              <div style="flex: 1; min-width: 0;">
                <h4 style="font-size: 15px; font-weight: 800; color: var(--main-text); cursor: pointer;" class="open-prof-click" data-user="${u.username}">${escapeHtml(u.displayName)}</h4>
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

      grid.querySelectorAll('.open-prof-click').forEach((el) => {
        el.addEventListener('click', () => this.openUserProfilePreview(el.dataset.user));
      });

      grid.querySelectorAll('.add-friend-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            await users.sendFriendRequest(btn.dataset.user);
            btn.parentElement.innerHTML = `<span class="nature-tag" style="font-size: 11px;">Request Sent</span>`;
            this.showToast('Friend request sent', 'success');
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
            this.showToast('Friend request accepted', 'success');
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
          this.showToast('Friend request accepted', 'success');
          renderIncoming();
          this.updateBadges();
        });
      });

      grid.querySelectorAll('.decline-action-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          await users.respondFriendRequest(btn.dataset.user, 'decline');
          this.showToast('Friend request declined', 'info');
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

  // --- Modals Base ---

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

  showAuthModal(startWithRegister = true) {
    let isRegister = startWithRegister;
    let selectedAvatar = DEFAULT_AVATAR;
    let selectedShape = 'circle';
    let usernameCheckTimer = null;
    let isUsernameAvailable = false;
    let isSubmitting = false;

    const renderAuth = () => `
      <div style="display: flex; flex-direction: column; height: 100%; max-height: inherit;">
        <div class="grove-modal-sheet-handle"></div>
        <div class="auth-brand-center" style="padding: 16px 20px 10px; margin-bottom: 0; text-align: center;">
          <div style="display: flex; justify-content: center; margin-bottom: 6px;">
            <img src="/assets/logo.svg" alt="Golden Grove" width="52" height="52" />
          </div>
          <h2 style="font-size: 21px; font-weight: 800; color: var(--deep-green); margin: 0 0 4px;">Golden Grove</h2>
          <p style="font-size: 13px; color: var(--secondary-text); margin: 0;">A warm, nature-inspired peer-to-peer messaging haven.</p>
        </div>

        <div class="auth-nav-toggle" style="margin: 4px 20px 12px;">
          <button class="auth-toggle-tab ${isRegister ? 'active' : ''}" id="tabRegBtn" type="button">Create Account</button>
          <button class="auth-toggle-tab ${!isRegister ? 'active' : ''}" id="tabLogBtn" type="button">Sign In</button>
        </div>

        <div class="grove-modal-body" style="padding: 0 20px 16px;">
          <form id="authUnifiedForm" autocomplete="off" novalidate>
            ${
              isRegister
                ? `
              <!-- Full Name Field -->
              <div class="form-field-group">
                <label for="authFullName" class="form-label-text">Full Name <span style="color: #DC2626;">*</span></label>
                <input
                  type="text"
                  id="authFullName"
                  class="form-control-input"
                  placeholder="e.g. Sylvan Willow"
                  required
                  autocomplete="name"
                />
                <div id="authFullNameErr" class="field-validation-msg"></div>
              </div>

              <!-- Unique Username Field with Live Availability -->
              <div class="form-field-group">
                <label for="authUsername" class="form-label-text">Unique Username <span style="color: #DC2626;">*</span></label>
                <div class="input-with-action-group">
                  <input
                    type="text"
                    id="authUsername"
                    class="form-control-input"
                    placeholder="e.g. sylvan_willow"
                    required
                    autocomplete="username"
                    spellcheck="false"
                  />
                  <span id="authUsernameStatus" class="username-check-status"></span>
                </div>
                <div id="authUsernameFeedback" class="field-validation-msg"></div>
                <div id="authUsernameSuggestions" class="username-suggestions-row" style="display: none;"></div>
              </div>

              <!-- Password Field with Security Requirements & Strength Meter -->
              <div class="form-field-group">
                <label for="authPassword" class="form-label-text">Password <span style="color: #DC2626;">*</span></label>
                <div class="input-with-action-group">
                  <input
                    type="password"
                    id="authPassword"
                    class="form-control-input"
                    placeholder="Enter a secure password"
                    required
                    autocomplete="new-password"
                  />
                  <button type="button" class="btn-eye-toggle" id="togglePasswordBtn" title="Toggle password visibility" aria-label="Toggle password visibility">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </div>
                <div class="password-strength-container" id="passStrengthContainer">
                  <div class="strength-track">
                    <div class="strength-bar" id="passStrengthBar" style="width: 0%; background: #DC2626;"></div>
                  </div>
                  <div class="strength-meta">
                    <span id="passStrengthLabel" style="font-weight: 700; color: var(--secondary-text);">Strength: Enter password</span>
                    <span id="passReqNotice" style="font-size: 11px; color: var(--secondary-text);">Min 6 chars, letters & numbers</span>
                  </div>
                </div>
                <div id="authPasswordErr" class="field-validation-msg"></div>
              </div>

              <!-- Confirm Password Field -->
              <div class="form-field-group">
                <label for="authConfirmPassword" class="form-label-text">Confirm Password <span style="color: #DC2626;">*</span></label>
                <div class="input-with-action-group">
                  <input
                    type="password"
                    id="authConfirmPassword"
                    class="form-control-input"
                    placeholder="Repeat your password"
                    required
                    autocomplete="new-password"
                  />
                  <button type="button" class="btn-eye-toggle" id="toggleConfirmPasswordBtn" title="Toggle confirm password visibility" aria-label="Toggle password visibility">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </div>
                <div id="authConfirmPasswordErr" class="field-validation-msg"></div>
              </div>

              <!-- Dedicated Profile Picture (DP) Selection Card (Option A & Option B) -->
              <div class="form-field-group">
                <label class="form-label-text">Profile Picture (DP)</label>
                <div class="reg-dp-picker-card">
                  <div class="reg-dp-avatar-preview" id="regDpPreviewSlot">
                    ${renderAvatarSvg(selectedAvatar, 64, selectedShape)}
                  </div>
                  <div class="reg-dp-actions">
                    <div class="reg-dp-shape-row">
                      <span style="font-size: 11.5px; font-weight: 700; color: var(--secondary-text);">Mask:</span>
                      <button type="button" class="btn-shape-toggle ${selectedShape === 'circle' ? 'active' : ''}" id="regShapeCircleBtn">Circle</button>
                      <button type="button" class="btn-shape-toggle ${selectedShape === 'rounded' ? 'active' : ''}" id="regShapeRoundedBtn">Square</button>
                    </div>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                      <button type="button" class="btn-grove btn-outline btn-sm-g" id="regChooseGalleryBtn">
                        🖼️ Built-in Gallery
                      </button>
                      <button type="button" class="btn-grove btn-golden btn-sm-g" id="regUploadPhotoBtn">
                        📤 Upload & Crop
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- About / Bio Field (Optional) -->
              <div class="form-field-group">
                <label for="authBio" class="form-label-text">About / Bio <span style="font-size: 11px; font-weight: normal; color: var(--secondary-text);">(optional, max 120 chars)</span></label>
                <input
                  type="text"
                  id="authBio"
                  class="form-control-input"
                  placeholder="Living peacefully in Golden Grove."
                  maxlength="120"
                />
              </div>
            `
                : `
              <!-- Sign In View -->
              <div class="form-field-group">
                <label for="loginUsername" class="form-label-text">Username</label>
                <input
                  type="text"
                  id="loginUsername"
                  class="form-control-input"
                  placeholder="Enter your Grove username"
                  required
                  autocomplete="username"
                  spellcheck="false"
                />
                <div id="loginUsernameErr" class="field-validation-msg"></div>
              </div>

              <div class="form-field-group">
                <label for="loginPassword" class="form-label-text">Password</label>
                <div class="input-with-action-group">
                  <input
                    type="password"
                    id="loginPassword"
                    class="form-control-input"
                    placeholder="Enter your password"
                    required
                    autocomplete="current-password"
                  />
                  <button type="button" class="btn-eye-toggle" id="toggleLoginPasswordBtn" title="Toggle password visibility">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  </button>
                </div>
                <div id="loginPasswordErr" class="field-validation-msg"></div>
              </div>
            `
            }

            <div id="authErrMsg" class="form-banner-error" style="display: none; margin-top: 10px;"></div>
            <div id="authSuccessMsg" class="form-banner-success" style="display: none; margin-top: 10px;"></div>
          </form>
        </div>

        <div class="grove-modal-footer" style="padding: 12px 20px 16px;">
          <button type="submit" form="authUnifiedForm" class="btn-grove btn-golden btn-block-g" id="authSubmitBtn">
            ${isRegister ? 'Create Account' : 'Sign In to Golden Grove'}
          </button>
          <div style="text-align: center; margin-top: 10px;">
            <button type="button" id="authSwitchModeBtn" style="background: none; border: none; font-size: 13px; color: var(--deep-green); font-weight: 700; cursor: pointer;">
              ${isRegister ? 'Already have an account? Sign In' : 'Need an account? Create one'}
            </button>
          </div>
        </div>
      </div>
    `;

    this.showModal(renderAuth());

    const updatePreviewSlot = () => {
      const slot = document.getElementById('regDpPreviewSlot');
      if (slot) {
        slot.innerHTML = renderAvatarSvg(selectedAvatar, 64, selectedShape);
      }
    };

    const attachAuthListeners = () => {
      // Toggle tabs & links
      const switchMode = (reg) => {
        isRegister = reg;
        this.showModal(renderAuth());
        attachAuthListeners();
      };

      document.getElementById('tabRegBtn')?.addEventListener('click', () => switchMode(true));
      document.getElementById('tabLogBtn')?.addEventListener('click', () => switchMode(false));
      document.getElementById('authSwitchModeBtn')?.addEventListener('click', () => switchMode(!isRegister));

      const submitBtn = document.getElementById('authSubmitBtn');
      const errBanner = document.getElementById('authErrMsg');
      const successBanner = document.getElementById('authSuccessMsg');

      if (isRegister) {
        const fullNameInput = document.getElementById('authFullName');
        const usernameInput = document.getElementById('authUsername');
        const passwordInput = document.getElementById('authPassword');
        const confirmPasswordInput = document.getElementById('authConfirmPassword');
        const bioInput = document.getElementById('authBio');

        const fullNameErr = document.getElementById('authFullNameErr');
        const usernameFeedback = document.getElementById('authUsernameFeedback');
        const usernameStatus = document.getElementById('authUsernameStatus');
        const usernameSuggestions = document.getElementById('authUsernameSuggestions');
        const passwordErr = document.getElementById('authPasswordErr');
        const confirmPasswordErr = document.getElementById('authConfirmPasswordErr');
        const strengthBar = document.getElementById('passStrengthBar');
        const strengthLabel = document.getElementById('passStrengthLabel');

        // Shape toggles
        document.getElementById('regShapeCircleBtn')?.addEventListener('click', () => {
          selectedShape = 'circle';
          document.getElementById('regShapeCircleBtn')?.classList.add('active');
          document.getElementById('regShapeRoundedBtn')?.classList.remove('active');
          updatePreviewSlot();
        });

        document.getElementById('regShapeRoundedBtn')?.addEventListener('click', () => {
          selectedShape = 'rounded';
          document.getElementById('regShapeRoundedBtn')?.classList.add('active');
          document.getElementById('regShapeCircleBtn')?.classList.remove('active');
          updatePreviewSlot();
        });

        // Gallery picker button
        document.getElementById('regChooseGalleryBtn')?.addEventListener('click', () => {
          dpModal.open({
            mode: 'gallery',
            currentAvatar: selectedAvatar,
            shape: selectedShape,
            onSelect: (newAvatar) => {
              selectedAvatar = newAvatar;
              updatePreviewSlot();
            },
          });
        });

        // Upload & crop button
        document.getElementById('regUploadPhotoBtn')?.addEventListener('click', () => {
          dpModal.open({
            mode: 'upload',
            currentAvatar: selectedAvatar,
            shape: selectedShape,
            onSelect: (newAvatar) => {
              selectedAvatar = newAvatar;
              updatePreviewSlot();
            },
          });
        });

        // Password visibility toggles
        document.getElementById('togglePasswordBtn')?.addEventListener('click', () => {
          if (passwordInput) {
            passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
          }
        });
        document.getElementById('toggleConfirmPasswordBtn')?.addEventListener('click', () => {
          if (confirmPasswordInput) {
            confirmPasswordInput.type = confirmPasswordInput.type === 'password' ? 'text' : 'password';
          }
        });

        // Live validation for Full Name
        fullNameInput?.addEventListener('input', () => {
          const val = fullNameInput.value.trim();
          if (val.length > 0 && val.length < 2) {
            if (fullNameErr) {
              fullNameErr.textContent = 'Full name must be at least 2 characters';
              fullNameErr.className = 'field-validation-msg error';
            }
          } else {
            if (fullNameErr) fullNameErr.textContent = '';
          }
        });

        // Live username availability check
        usernameInput?.addEventListener('input', () => {
          clearTimeout(usernameCheckTimer);
          const raw = usernameInput.value;
          const val = raw.trim().toLowerCase();

          if (!val) {
            if (usernameFeedback) usernameFeedback.textContent = '';
            if (usernameStatus) usernameStatus.textContent = '';
            if (usernameSuggestions) usernameSuggestions.style.display = 'none';
            isUsernameAvailable = false;
            return;
          }

          const formatCheck = validateUsername(val);
          if (!formatCheck.valid) {
            if (usernameFeedback) {
              usernameFeedback.textContent = formatCheck.error || 'Invalid username';
              usernameFeedback.className = 'field-validation-msg error';
            }
            if (usernameStatus) usernameStatus.textContent = '❌';
            if (usernameSuggestions) usernameSuggestions.style.display = 'none';
            isUsernameAvailable = false;
            return;
          }

          if (usernameStatus) usernameStatus.textContent = '⏳';
          if (usernameFeedback) {
            usernameFeedback.textContent = 'Checking availability...';
            usernameFeedback.className = 'field-validation-msg checking';
          }

          usernameCheckTimer = setTimeout(async () => {
            try {
              const res = await auth.checkUsername(val);
              if (res.available) {
                isUsernameAvailable = true;
                if (usernameStatus) usernameStatus.textContent = '✅';
                if (usernameFeedback) {
                  usernameFeedback.textContent = '✓ Username is available';
                  usernameFeedback.className = 'field-validation-msg success';
                }
                if (usernameSuggestions) usernameSuggestions.style.display = 'none';
              } else {
                isUsernameAvailable = false;
                if (usernameStatus) usernameStatus.textContent = '❌';
                if (usernameFeedback) {
                  usernameFeedback.textContent = '✕ Username is already taken';
                  usernameFeedback.className = 'field-validation-msg error';
                }
                if (res.suggestions && res.suggestions.length > 0 && usernameSuggestions) {
                  usernameSuggestions.innerHTML = `
                    <span style="font-size: 11px; color: var(--secondary-text); margin-right: 4px;">Suggestions:</span>
                    ${res.suggestions
                      .map(
                        (s) => `
                      <button type="button" class="btn-suggestion-chip" data-suggest="${escapeHtml(s)}">${escapeHtml(s)}</button>
                    `
                      )
                      .join('')}
                  `;
                  usernameSuggestions.style.display = 'flex';
                  usernameSuggestions.querySelectorAll('.btn-suggestion-chip').forEach((chip) => {
                    chip.addEventListener('click', () => {
                      if (usernameInput) {
                        usernameInput.value = chip.dataset.suggest || '';
                        usernameInput.dispatchEvent(new Event('input'));
                      }
                    });
                  });
                }
              }
            } catch {
              if (usernameFeedback) usernameFeedback.textContent = '';
              if (usernameStatus) usernameStatus.textContent = '';
            }
          }, 350);
        });

        // Password strength and validation
        passwordInput?.addEventListener('input', () => {
          const pass = passwordInput.value;
          const strength = evaluatePasswordStrength(pass);
          if (strengthBar) {
            strengthBar.style.width = `${strength.percent}%`;
            strengthBar.style.background = strength.color;
          }
          if (strengthLabel) {
            strengthLabel.textContent = `Strength: ${strength.label}`;
            strengthLabel.style.color = strength.color;
          }

          const valid = validatePassword(pass);
          if (pass.length > 0 && !valid.valid) {
            if (passwordErr) {
              passwordErr.textContent = valid.error || 'Password requirement not met';
              passwordErr.className = 'field-validation-msg error';
            }
          } else {
            if (passwordErr) passwordErr.textContent = '';
          }

          // Also check confirm password match if filled
          if (confirmPasswordInput && confirmPasswordInput.value) {
            checkPasswordMatch();
          }
        });

        const checkPasswordMatch = () => {
          const pass = passwordInput ? passwordInput.value : '';
          const confirmPass = confirmPasswordInput ? confirmPasswordInput.value : '';
          if (!confirmPass) {
            if (confirmPasswordErr) confirmPasswordErr.textContent = '';
            return false;
          }
          if (pass !== confirmPass) {
            if (confirmPasswordErr) {
              confirmPasswordErr.textContent = 'Passwords do not match';
              confirmPasswordErr.className = 'field-validation-msg error';
            }
            return false;
          } else {
            if (confirmPasswordErr) {
              confirmPasswordErr.textContent = '✓ Passwords match';
              confirmPasswordErr.className = 'field-validation-msg success';
            }
            return true;
          }
        };

        confirmPasswordInput?.addEventListener('input', checkPasswordMatch);

        // Submit form
        document.getElementById('authUnifiedForm')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (isSubmitting) return;

          if (errBanner) errBanner.style.display = 'none';
          if (successBanner) successBanner.style.display = 'none';

          const fullName = fullNameInput?.value.trim() || '';
          const username = usernameInput?.value.trim().toLowerCase() || '';
          const password = passwordInput?.value || '';
          const confirmPassword = confirmPasswordInput?.value || '';
          const bio = bioInput?.value.trim() || 'Living peacefully in Golden Grove.';

          // Validation
          const fnCheck = validateFullName(fullName);
          if (!fnCheck.valid) {
            if (fullNameErr) {
              fullNameErr.textContent = fnCheck.error || 'Full name is required';
              fullNameErr.className = 'field-validation-msg error';
            }
            fullNameInput?.focus();
            return;
          }

          const unCheck = validateUsername(username);
          if (!unCheck.valid) {
            if (usernameFeedback) {
              usernameFeedback.textContent = unCheck.error || 'Invalid username';
              usernameFeedback.className = 'field-validation-msg error';
            }
            usernameInput?.focus();
            return;
          }

          const passCheck = validatePassword(password);
          if (!passCheck.valid) {
            if (passwordErr) {
              passwordErr.textContent = passCheck.error || 'Invalid password';
              passwordErr.className = 'field-validation-msg error';
            }
            passwordInput?.focus();
            return;
          }

          if (password !== confirmPassword) {
            if (confirmPasswordErr) {
              confirmPasswordErr.textContent = 'Passwords do not match';
              confirmPasswordErr.className = 'field-validation-msg error';
            }
            confirmPasswordInput?.focus();
            return;
          }

          // Disable and show loading
          isSubmitting = true;
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
              <span class="btn-spinner-icon"></span>
              <span>Creating Golden Grove Account...</span>
            `;
          }

          try {
            await auth.register({
              fullName,
              username,
              password,
              confirmPassword,
              avatar: selectedAvatar,
              bio,
            });

            // Show success state
            if (successBanner) {
              successBanner.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 16px;">🌱</span>
                  <div>
                    <strong>Welcome to Golden Grove, ${escapeHtml(fullName)}!</strong>
                    <div style="font-size: 12px;">Your account is ready. Taking you to the sanctuary...</div>
                  </div>
                </div>
              `;
              successBanner.style.display = 'block';
            }

            const user = auth.getCurrentUser();
            signaling.connect(user.username);
            webrtc.setCurrentUser(user.username);

            setTimeout(() => {
              this.hideModal();
              this.updateUserProfileBar();
              this.loadConversations();
              this.updateBadges();
              this.showToast(`Welcome to Golden Grove, ${user.displayName || user.username}!`, 'success');
            }, 1000);
          } catch (err) {
            isSubmitting = false;
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Create Account';
            }
            if (errBanner) {
              errBanner.textContent = err.message || 'Account registration failed.';
              errBanner.style.display = 'block';
            }
          }
        });
      } else {
        // Sign In View
        const usernameInput = document.getElementById('loginUsername');
        const passwordInput = document.getElementById('loginPassword');
        const usernameErr = document.getElementById('loginUsernameErr');
        const passwordErr = document.getElementById('loginPasswordErr');

        document.getElementById('toggleLoginPasswordBtn')?.addEventListener('click', () => {
          if (passwordInput) {
            passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
          }
        });

        document.getElementById('authUnifiedForm')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (isSubmitting) return;

          if (errBanner) errBanner.style.display = 'none';
          if (successBanner) successBanner.style.display = 'none';

          const username = usernameInput?.value.trim() || '';
          const password = passwordInput?.value || '';

          if (!username) {
            if (usernameErr) {
              usernameErr.textContent = 'Username is required';
              usernameErr.className = 'field-validation-msg error';
            }
            usernameInput?.focus();
            return;
          }

          if (!password) {
            if (passwordErr) {
              passwordErr.textContent = 'Password is required';
              passwordErr.className = 'field-validation-msg error';
            }
            passwordInput?.focus();
            return;
          }

          isSubmitting = true;
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `
              <span class="btn-spinner-icon"></span>
              <span>Signing in...</span>
            `;
          }

          try {
            await auth.login({ username, password });
            const user = auth.getCurrentUser();
            signaling.connect(user.username);
            webrtc.setCurrentUser(user.username);

            if (successBanner) {
              successBanner.textContent = `Welcome back, ${user.displayName || user.username}!`;
              successBanner.style.display = 'block';
            }

            setTimeout(() => {
              this.hideModal();
              this.updateUserProfileBar();
              this.loadConversations();
              this.updateBadges();
            }, 600);
          } catch (err) {
            isSubmitting = false;
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Sign In to Golden Grove';
            }
            if (errBanner) {
              errBanner.textContent = err.message || 'Invalid username or password.';
              errBanner.style.display = 'block';
            }
          }
        });
      }
    };

    attachAuthListeners();
  }

  // --- Profile Modal (Edit Full Name, Username with Availability, DP Selection, Bio, Live Preview) ---

  openProfileModal() {
    const user = auth.getCurrentUser();
    if (!user) return;

    let selectedAvatar = user.avatar || DEFAULT_AVATAR;
    let selectedShape = user.avatarShape || 'circle';
    let usernameCheckTimer = null;
    let isUsernameValid = true;
    let isSaving = false;

    const currentBio = user.bio && !user.bio.includes('MeshChat') ? user.bio : 'Living peacefully in Golden Grove.';

    const html = `
      <div style="display: flex; flex-direction: column; height: 100%; max-height: inherit;">
        <div class="grove-modal-sheet-handle"></div>
        <div class="grove-modal-header">
          <h3 class="modal-title-text">My Grove Profile</h3>
          <button class="modal-dismiss-btn" id="modalDismissBtn" aria-label="Close">✕</button>
        </div>

        <div class="grove-modal-body">
          <!-- Profile Picture Hero Section -->
          <div class="profile-hero-section">
            <div class="profile-avatar-display" id="profileAvatarSlot">
              ${renderAvatarSvg(selectedAvatar, 72, selectedShape)}
            </div>
            <div class="profile-dp-controls">
              <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;">
                <button type="button" class="btn-grove btn-outline btn-sm-g" id="profileChooseGalleryBtn">
                  🖼️ Gallery
                </button>
                <button type="button" class="btn-grove btn-golden btn-sm-g" id="profileUploadPhotoBtn">
                  📤 Upload & Crop
                </button>
                <button type="button" class="btn-grove btn-outline btn-sm-g" id="profileResetDpBtn" title="Reset to default DP">
                  ↺ Reset
                </button>
              </div>
              <div class="reg-dp-shape-row" style="margin-top: 8px; justify-content: center;">
                <span style="font-size: 11.5px; font-weight: 700; color: var(--secondary-text);">Shape:</span>
                <button type="button" class="btn-shape-toggle ${selectedShape === 'circle' ? 'active' : ''}" id="profShapeCircleBtn">Circle</button>
                <button type="button" class="btn-shape-toggle ${selectedShape === 'rounded' ? 'active' : ''}" id="profShapeRoundedBtn">Square</button>
              </div>
            </div>
          </div>

          <!-- Live Profile Preview Card -->
          <div class="live-preview-box">
            <div class="live-preview-tag">Preview Card</div>
            <div class="live-preview-content">
              <div id="livePreviewAvatar">${renderAvatarSvg(selectedAvatar, 48, selectedShape)}</div>
              <div style="flex: 1; min-width: 0;">
                <div id="livePreviewName" style="font-weight: 800; font-size: 14.5px; color: var(--main-text); line-height: 1.2;">
                  ${escapeHtml(user.displayName || user.username)}
                </div>
                <div id="livePreviewUsername" style="font-size: 12px; color: var(--deep-green); font-weight: 700;">
                  @${escapeHtml(user.username)}
                </div>
                <div id="livePreviewBio" style="font-size: 12px; color: var(--secondary-text); margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHtml(currentBio)}
                </div>
              </div>
            </div>
          </div>

          <form id="profileEditForm" autocomplete="off">
            <!-- Full Name Input -->
            <div class="form-field-group">
              <label for="profDisplayName" class="form-label-text">Full Name <span style="color: #DC2626;">*</span></label>
              <input
                type="text"
                id="profDisplayName"
                class="form-control-input"
                value="${escapeHtml(user.displayName || user.username)}"
                required
              />
              <div id="profDisplayNameErr" class="field-validation-msg"></div>
            </div>

            <!-- Username Input with Availability Checking -->
            <div class="form-field-group">
              <label for="profUsername" class="form-label-text">Username <span style="color: #DC2626;">*</span></label>
              <div class="input-with-action-group">
                <input
                  type="text"
                  id="profUsername"
                  class="form-control-input"
                  value="${escapeHtml(user.username)}"
                  required
                  spellcheck="false"
                />
                <button type="button" class="btn-inline-action" id="copyUserHandleBtn" title="Copy username">
                  <span id="copyBtnText">Copy</span>
                </button>
              </div>
              <div id="profUsernameFeedback" class="field-validation-msg"></div>
              <div id="profUsernameSuggestions" class="username-suggestions-row" style="display: none;"></div>
            </div>

            <!-- Bio with 120 character limit -->
            <div class="form-field-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <label for="profBio" class="form-label-text" style="margin-bottom: 0;">About / Bio</label>
                <span id="bioCharCounter" style="font-size: 11.5px; color: var(--secondary-text); font-weight: 600;">
                  ${currentBio.length}/120
                </span>
              </div>
              <textarea
                id="profBio"
                class="form-control-input"
                rows="2"
                maxlength="120"
                style="resize: none;"
                placeholder="Living peacefully in Golden Grove."
              >${escapeHtml(currentBio)}</textarea>
            </div>

            <div id="profErrorMsg" class="form-banner-error" style="display: none;"></div>
            <div id="profSuccessMsg" class="form-banner-success" style="display: none;">Profile updated successfully!</div>
          </form>
        </div>

        <div class="grove-modal-footer">
          <div style="display: flex; gap: 8px;">
            <button type="button" class="btn-grove btn-golden btn-block-g" id="saveProfileTriggerBtn">
              Save Profile
            </button>
            <button type="button" class="btn-grove btn-outline" id="cancelProfileBtn" style="min-width: 90px;">
              Cancel
            </button>
          </div>
          <button type="button" class="btn-grove btn-danger-soft btn-block-g" id="profLogoutBtn" style="margin-top: 8px;">
            Sign Out of Grove
          </button>
        </div>
      </div>
    `;

    this.showModal(html);
    document.getElementById('modalDismissBtn')?.addEventListener('click', () => this.hideModal());
    document.getElementById('cancelProfileBtn')?.addEventListener('click', () => this.hideModal());

    const updateDpVisuals = () => {
      const slot = document.getElementById('profileAvatarSlot');
      if (slot) slot.innerHTML = renderAvatarSvg(selectedAvatar, 72, selectedShape);
      const previewAvatar = document.getElementById('livePreviewAvatar');
      if (previewAvatar) previewAvatar.innerHTML = renderAvatarSvg(selectedAvatar, 48, selectedShape);
    };

    // Shape toggles
    document.getElementById('profShapeCircleBtn')?.addEventListener('click', () => {
      selectedShape = 'circle';
      document.getElementById('profShapeCircleBtn')?.classList.add('active');
      document.getElementById('profShapeRoundedBtn')?.classList.remove('active');
      updateDpVisuals();
    });

    document.getElementById('profShapeRoundedBtn')?.addEventListener('click', () => {
      selectedShape = 'rounded';
      document.getElementById('profShapeRoundedBtn')?.classList.add('active');
      document.getElementById('profShapeCircleBtn')?.classList.remove('active');
      updateDpVisuals();
    });

    // Gallery Picker
    document.getElementById('profileChooseGalleryBtn')?.addEventListener('click', () => {
      dpModal.open({
        mode: 'gallery',
        currentAvatar: selectedAvatar,
        shape: selectedShape,
        onSelect: (newAvatar) => {
          selectedAvatar = newAvatar;
          updateDpVisuals();
        },
      });
    });

    // Upload & Crop
    document.getElementById('profileUploadPhotoBtn')?.addEventListener('click', () => {
      dpModal.open({
        mode: 'upload',
        currentAvatar: selectedAvatar,
        shape: selectedShape,
        onSelect: (newAvatar) => {
          selectedAvatar = newAvatar;
          updateDpVisuals();
        },
      });
    });

    // Reset DP
    document.getElementById('profileResetDpBtn')?.addEventListener('click', () => {
      selectedAvatar = DEFAULT_AVATAR;
      updateDpVisuals();
    });

    // Copy handle
    document.getElementById('copyUserHandleBtn')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(user.username);
      const text = document.getElementById('copyBtnText');
      if (text) text.textContent = 'Copied!';
      setTimeout(() => {
        if (text) text.textContent = 'Copy';
      }, 1500);
    });

    // Live preview updating on name change
    const nameInput = document.getElementById('profDisplayName');
    const usernameInput = document.getElementById('profUsername');
    const bioInput = document.getElementById('profBio');
    const charCounter = document.getElementById('bioCharCounter');
    const usernameFeedback = document.getElementById('profUsernameFeedback');
    const usernameSuggestions = document.getElementById('profUsernameSuggestions');
    const errBanner = document.getElementById('profErrorMsg');
    const successBanner = document.getElementById('profSuccessMsg');

    nameInput?.addEventListener('input', () => {
      const val = nameInput.value.trim();
      const preview = document.getElementById('livePreviewName');
      if (preview) preview.textContent = val || 'Your Name';
    });

    bioInput?.addEventListener('input', () => {
      const val = bioInput.value;
      if (charCounter) charCounter.textContent = `${val.length}/120`;
      const preview = document.getElementById('livePreviewBio');
      if (preview) preview.textContent = val.trim() || 'Living peacefully in Golden Grove.';
    });

    // Username change availability check
    usernameInput?.addEventListener('input', () => {
      clearTimeout(usernameCheckTimer);
      const val = usernameInput.value.trim().toLowerCase();
      const preview = document.getElementById('livePreviewUsername');
      if (preview) preview.textContent = `@${val || 'username'}`;

      if (val === user.username.toLowerCase()) {
        isUsernameValid = true;
        if (usernameFeedback) usernameFeedback.textContent = '';
        if (usernameSuggestions) usernameSuggestions.style.display = 'none';
        return;
      }

      const formatCheck = validateUsername(val);
      if (!formatCheck.valid) {
        isUsernameValid = false;
        if (usernameFeedback) {
          usernameFeedback.textContent = formatCheck.error || 'Invalid username';
          usernameFeedback.className = 'field-validation-msg error';
        }
        if (usernameSuggestions) usernameSuggestions.style.display = 'none';
        return;
      }

      if (usernameFeedback) {
        usernameFeedback.textContent = 'Checking availability...';
        usernameFeedback.className = 'field-validation-msg checking';
      }

      usernameCheckTimer = setTimeout(async () => {
        try {
          const res = await auth.checkUsername(val, user.username);
          if (res.available) {
            isUsernameValid = true;
            if (usernameFeedback) {
              usernameFeedback.textContent = '✓ Username is available';
              usernameFeedback.className = 'field-validation-msg success';
            }
            if (usernameSuggestions) usernameSuggestions.style.display = 'none';
          } else {
            isUsernameValid = false;
            if (usernameFeedback) {
              usernameFeedback.textContent = '✕ Username is already taken';
              usernameFeedback.className = 'field-validation-msg error';
            }
            if (res.suggestions && res.suggestions.length > 0 && usernameSuggestions) {
              usernameSuggestions.innerHTML = `
                <span style="font-size: 11px; color: var(--secondary-text); margin-right: 4px;">Suggestions:</span>
                ${res.suggestions
                  .map(
                    (s) => `
                  <button type="button" class="btn-suggestion-chip" data-suggest="${escapeHtml(s)}">${escapeHtml(s)}</button>
                `
                  )
                  .join('')}
              `;
              usernameSuggestions.style.display = 'flex';
              usernameSuggestions.querySelectorAll('.btn-suggestion-chip').forEach((chip) => {
                chip.addEventListener('click', () => {
                  if (usernameInput) {
                    usernameInput.value = chip.dataset.suggest || '';
                    usernameInput.dispatchEvent(new Event('input'));
                  }
                });
              });
            }
          }
        } catch {
          if (usernameFeedback) usernameFeedback.textContent = '';
        }
      }, 350);
    });

    // Save profile handler
    const submitProfile = async () => {
      if (isSaving) return;
      if (errBanner) errBanner.style.display = 'none';
      if (successBanner) successBanner.style.display = 'none';

      const displayName = nameInput?.value.trim() || '';
      const newUsername = usernameInput?.value.trim().toLowerCase() || '';
      const bio = bioInput?.value.trim() || '';

      const nameCheck = validateFullName(displayName);
      if (!nameCheck.valid) {
        if (errBanner) {
          errBanner.textContent = nameCheck.error || 'Please provide a valid full name';
          errBanner.style.display = 'block';
        }
        nameInput?.focus();
        return;
      }

      if (!isUsernameValid) {
        if (errBanner) {
          errBanner.textContent = 'Please choose an available username';
          errBanner.style.display = 'block';
        }
        usernameInput?.focus();
        return;
      }

      isSaving = true;
      const saveBtn = document.getElementById('saveProfileTriggerBtn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `
          <span class="btn-spinner-icon"></span>
          <span>Saving Changes...</span>
        `;
      }

      try {
        await auth.updateProfile({
          newUsername: newUsername !== user.username ? newUsername : undefined,
          displayName,
          avatar: selectedAvatar,
          avatarShape: selectedShape,
          bio,
        });

        if (successBanner) {
          successBanner.textContent = '✓ Profile updated successfully in Golden Grove!';
          successBanner.style.display = 'block';
        }

        this.updateUserProfileBar();
        this.loadConversations();
        this.showToast('Profile updated', 'success');

        setTimeout(() => this.hideModal(), 700);
      } catch (err) {
        isSaving = false;
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Profile';
        }
        if (errBanner) {
          errBanner.textContent = err.message || 'Failed to update profile.';
          errBanner.style.display = 'block';
        }
      }
    };

    document.getElementById('saveProfileTriggerBtn')?.addEventListener('click', submitProfile);
    document.getElementById('profileEditForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      submitProfile();
    });

    // Logout
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
    const user = auth.getCurrentUser() || { displayName: 'Grove Member', username: 'grove_user', avatar: DEFAULT_AVATAR };
    const currentTheme = storage.getPreference('theme', 'light');
    const enterToSend = storage.getPreference('enterToSend', true);
    const readReceipts = storage.getPreference('readReceipts', true);
    const turnConfig = storage.getPreference('turnServer', { url: '', username: '', credential: '' });

    const html = `
      <div style="display: flex; flex-direction: column; height: 100%; max-height: inherit;">
        <div class="grove-modal-sheet-handle"></div>
        <div class="grove-modal-header">
          <h3 class="modal-title-text">Settings</h3>
          <button class="modal-dismiss-btn" id="modalDismissBtn" aria-label="Close">✕</button>
        </div>

        <div class="grove-modal-body">
          <!-- User Profile Summary Card with Edit Profile & DP Link -->
          <div class="settings-profile-card">
            <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
              ${renderAvatarSvg(user.avatar, 46, user.avatarShape || 'circle')}
              <div style="min-width: 0;">
                <div style="font-weight: 800; font-size: 14.5px; color: var(--main-text); line-height: 1.2;">
                  ${escapeHtml(user.displayName || user.username)}
                </div>
                <div style="font-size: 12px; color: var(--deep-green); font-weight: 700;">
                  @${escapeHtml(user.username)}
                </div>
              </div>
            </div>
            <button type="button" class="btn-grove btn-golden btn-sm-g" id="settingsEditProfileBtn" style="white-space: nowrap;">
              Edit Profile & DP
            </button>
          </div>

          <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 14px; margin-bottom: 14px;">
            <h4 style="font-size: 13.5px; font-weight: 700; color: var(--deep-green); margin-bottom: 8px;">Appearance</h4>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13.5px; font-weight: 600;">Theme Mode</span>
              <select id="themeSettingSelect" class="form-control-select">
                <option value="light" ${currentTheme === 'light' ? 'selected' : ''}>Golden Grove Warm Light</option>
                <option value="dark" ${currentTheme === 'dark' ? 'selected' : ''}>Dark Forest Night</option>
              </select>
            </div>
          </div>

          <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 14px; margin-bottom: 14px;">
            <h4 style="font-size: 13.5px; font-weight: 700; color: var(--deep-green); margin-bottom: 8px;">Chat & Behavior</h4>
            
            <div class="toggle-switch-row" style="margin-bottom: 8px;">
              <div>
                <span style="font-size: 13.5px; font-weight: 600; display: block;">Enter to Send</span>
                <small style="color: var(--secondary-text); font-size: 12px;">Press Enter to send, Shift+Enter for newline.</small>
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

          <div>
            <h4 style="font-size: 13.5px; font-weight: 700; color: var(--deep-green); margin-bottom: 6px;">WebRTC Peer Network</h4>
            <p style="font-size: 12px; color: var(--secondary-text); margin-bottom: 8px; line-height: 1.4;">
              Direct P2P DataChannels connect peers instantly. Configure an optional TURN relay if behind symmetric NAT:
            </p>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="turnUrlInput" class="form-control-input" placeholder="turn:turn.example.com:3478" value="${escapeHtml(
                turnConfig.url || ''
              )}" />
              <button type="button" class="btn-grove btn-golden btn-sm-g" id="saveTurnConfigBtn" style="white-space: nowrap;">Save</button>
            </div>
          </div>
        </div>

        <div class="grove-modal-footer">
          <button class="btn-grove btn-outline btn-block-g" id="clearLocalHistoryBtn">Clear Local Chats</button>
          <button class="btn-grove btn-danger-soft btn-block-g" id="deleteAccountBtn">Delete Account</button>
        </div>
      </div>
    `;

    this.showModal(html);
    document.getElementById('modalDismissBtn')?.addEventListener('click', () => this.hideModal());

    document.getElementById('settingsEditProfileBtn')?.addEventListener('click', () => {
      this.openProfileModal();
    });

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
      this.showToast('TURN configuration saved', 'success');
    });

    document.getElementById('clearLocalHistoryBtn')?.addEventListener('click', async () => {
      if (confirm('Clear local conversation history?')) {
        await storage.clearAll();
        this.loadConversations();
        chat.setActiveContact(null);
        this.hideModal();
        this.showToast('Local history cleared', 'info');
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

  // --- Chat Info Modal (with Mute, Favorite, Export, Clear) ---

  async openChatInfoModal() {
    const contact = chat.getActiveContact();
    if (!contact) return;
    const status = webrtc.getConnectionStatus(contact.username);
    const conv = await storage.getConversation(contact.username);

    const isFav = conv ? conv.isFavorite : false;
    const isMuted = conv ? conv.isMuted : false;

    const html = `
      <div style="display: flex; flex-direction: column; height: 100%; max-height: inherit;">
        <div class="grove-modal-sheet-handle"></div>
        <div class="grove-modal-header">
          <h3 class="modal-title-text">Conversation Details</h3>
          <button class="modal-dismiss-btn" id="modalDismissBtn" aria-label="Close">✕</button>
        </div>

        <div class="grove-modal-body">
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 16px;">
            ${renderAvatarSvg(contact.avatar, 56)}
            <h3 style="font-size: 17px; font-weight: 800; color: var(--main-text);">${escapeHtml(contact.displayName || contact.username)}</h3>
            <span style="font-size: 12.5px; color: var(--deep-green); font-weight: 700;">@${escapeHtml(contact.username)}</span>
          </div>

          <div style="border-top: 1px solid var(--border-color); padding-top: 14px; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; font-size: 13.5px; margin-bottom: 8px;">
              <span style="color: var(--secondary-text);">Connection:</span>
              <strong style="color: var(--deep-green);">${status === 'connected' ? 'Direct P2P DataChannel' : 'Signaling Standby'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13.5px; margin-bottom: 8px;">
              <span style="color: var(--secondary-text);">Storage:</span>
              <strong>Private IndexedDB</strong>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button class="btn-grove btn-outline btn-block-g" id="toggleFavoriteChatBtn" style="justify-content: flex-start;">
              <span>⭐</span> ${isFav ? 'Remove from Favorites' : 'Add to Favorites'}
            </button>
            <button class="btn-grove btn-outline btn-block-g" id="toggleMuteChatBtn" style="justify-content: flex-start;">
              <span>🔇</span> ${isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
            </button>
            <button class="btn-grove btn-outline btn-block-g" id="exportChatBtn" style="justify-content: flex-start;">
              <span>📤</span> Export Chat History (.txt)
            </button>
          </div>
        </div>

        <div class="grove-modal-footer">
          <button class="btn-grove btn-danger-soft btn-block-g" id="deleteThisChatHistoryBtn">Clear Conversation Messages</button>
        </div>
      </div>
    `;

    this.showModal(html);
    document.getElementById('modalDismissBtn')?.addEventListener('click', () => this.hideModal());

    document.getElementById('toggleFavoriteChatBtn')?.addEventListener('click', async () => {
      await storage.toggleConversationFavorite(contact.username);
      this.loadConversations();
      this.hideModal();
      this.showToast(isFav ? 'Removed from favorites' : 'Added to favorites', 'success');
    });

    document.getElementById('toggleMuteChatBtn')?.addEventListener('click', async () => {
      await storage.toggleConversationMuted(contact.username);
      this.loadConversations();
      this.hideModal();
      this.showToast(isMuted ? 'Conversation unmuted' : 'Conversation muted', 'info');
    });

    document.getElementById('exportChatBtn')?.addEventListener('click', async () => {
      const msgs = await storage.getMessages(contact.username);
      const exportedText = formatConversationExport(contact.displayName || contact.username, msgs);
      const blob = new Blob([exportedText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `golden_grove_${contact.username}_export.txt`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Conversation exported', 'success');
      this.hideModal();
    });

    document.getElementById('deleteThisChatHistoryBtn')?.addEventListener('click', async () => {
      if (confirm(`Clear all messages for @${contact.username}?`)) {
        await storage.deleteConversation(contact.username);
        this.loadConversations();
        this.loadMessageHistory(contact.username);
        this.hideModal();
        this.showToast('Messages cleared', 'info');
      }
    });
  }
}

export const ui = new UIManager();

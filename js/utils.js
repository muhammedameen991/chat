/**
 * MeshChat - Pure Utility Functions & Business Logic
 * Vanilla JavaScript (ES modules)
 * No DOM dependencies - runs cleanly in both Node.js test runner and browser.
 */

const RESERVED_USERNAMES = new Set([
  'admin',
  'system',
  'meshchat',
  'support',
  'everyone',
  'all',
  'root',
  'moderator',
  'server',
]);

/**
 * Validates and sanitizes a username.
 * Rules: 3-20 characters, lowercase alphanumeric and underscores, no reserved words.
 * @param {string} username
 * @returns {{ valid: boolean, error?: string, sanitized: string }}
 */
export function validateUsername(username) {
  if (typeof username !== 'string') {
    return { valid: false, error: 'Username must be a string', sanitized: '' };
  }

  const sanitized = username.trim().toLowerCase();

  if (sanitized.length < 3) {
    return { valid: false, error: 'Username must be at least 3 characters', sanitized };
  }

  if (sanitized.length > 20) {
    return { valid: false, error: 'Username cannot exceed 20 characters', sanitized };
  }

  if (!/^[a-z0-9_]+$/.test(sanitized)) {
    return {
      valid: false,
      error: 'Username can only contain letters, numbers, and underscores',
      sanitized,
    };
  }

  if (RESERVED_USERNAMES.has(sanitized)) {
    return { valid: false, error: 'This username is reserved and cannot be used', sanitized };
  }

  return { valid: true, sanitized };
}

/**
 * Validates a display name.
 * @param {string} name
 * @returns {{ valid: boolean, error?: string, sanitized: string }}
 */
export function validateDisplayName(name) {
  if (typeof name !== 'string') {
    return { valid: false, error: 'Display name must be a string', sanitized: '' };
  }
  const sanitized = name.trim();
  if (sanitized.length === 0) {
    return { valid: false, error: 'Display name cannot be empty', sanitized };
  }
  if (sanitized.length > 30) {
    return { valid: false, error: 'Display name cannot exceed 30 characters', sanitized };
  }
  return { valid: true, sanitized };
}

const STATUS_ORDER = {
  failed: -1,
  sending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

/**
 * Ensures delivery status transitions only move forward (sending -> sent -> delivered -> read).
 * @param {'failed'|'sending'|'sent'|'delivered'|'read'} current
 * @param {'failed'|'sending'|'sent'|'delivered'|'read'} target
 * @returns {'failed'|'sending'|'sent'|'delivered'|'read'}
 */
export function transitionMessageStatus(current, target) {
  if (target === 'failed') return 'failed';
  if (current === 'failed') return target; // retry can promote to sending/sent

  const curOrder = STATUS_ORDER[current] ?? 0;
  const tgtOrder = STATUS_ORDER[target] ?? 0;

  return tgtOrder >= curOrder ? target : current;
}

/**
 * Creates a structured chat message payload.
 * @param {{ sender: string, recipient: string, text: string, file?: any, customId?: string }} params
 */
export function createChatMessage(params) {
  const sanitizedText = typeof params.text === 'string' ? params.text.trim() : '';
  const now = Date.now();
  const rand = Math.random().toString(36).substring(2, 9);
  const id = params.customId || `msg_${now}_${rand}`;

  return {
    id,
    conversationId: params.recipient.toLowerCase(),
    sender: params.sender.toLowerCase(),
    recipient: params.recipient.toLowerCase(),
    text: sanitizedText,
    file: params.file,
    timestamp: now,
    status: 'sending',
    isOutgoing: true,
  };
}

/**
 * Safe HTML escaping to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats timestamps for chat messages (e.g. 10:45 AM).
 * @param {number} timestamp
 * @returns {string}
 */
export function formatMessageTime(timestamp) {
  if (!timestamp || isNaN(timestamp)) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Formats relative date/time for conversation list (e.g. 10:45 AM, Yesterday, Oct 31).
 * @param {number} timestamp
 * @returns {string}
 */
export function formatConversationTime(timestamp) {
  if (!timestamp || isNaN(timestamp)) return '';
  const now = new Date();
  const date = new Date(timestamp);

  const isToday =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    yesterday.getFullYear() === date.getFullYear() &&
    yesterday.getMonth() === date.getMonth() &&
    yesterday.getDate() === date.getDate();

  if (isYesterday) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Formats byte size for file attachments.
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes <= 0 || isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i] || 'B'}`;
}

/**
 * Filters a list of user profiles matching a search query.
 * @param {Array<{ username: string, displayName: string, avatar: string }>} users
 * @param {string} query
 * @param {string} [excludeUsername]
 */
export function filterUsers(users, query, excludeUsername) {
  const q = (query || '').trim().toLowerCase();
  const exclude = excludeUsername ? excludeUsername.trim().toLowerCase() : '';

  return (users || []).filter((user) => {
    if (exclude && user.username.toLowerCase() === exclude) {
      return false;
    }
    if (!q) return true;
    const matchUser = user.username.toLowerCase().includes(q);
    const matchName = (user.displayName || '').toLowerCase().includes(q);
    return matchUser || matchName;
  });
}

/**
 * Validates signaling message schema.
 * @param {any} data
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateSignalingMessage(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Signaling message must be an object' };
  }
  if (!data.from || typeof data.from !== 'string') {
    return { valid: false, error: 'Missing or invalid "from" field' };
  }
  if (!data.to || typeof data.to !== 'string') {
    return { valid: false, error: 'Missing or invalid "to" field' };
  }
  const validTypes = ['offer', 'answer', 'candidate', 'ping', 'bye', 'ack', 'message'];
  if (!data.type || !validTypes.includes(data.type)) {
    return { valid: false, error: `Invalid "type" field: ${data.type}` };
  }
  return { valid: true };
}

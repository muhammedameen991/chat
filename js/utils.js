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
 * @param {{ sender: string, recipient: string, text: string, file?: any, files?: any[], replyTo?: any, voice?: any, poll?: any, customId?: string }} params
 */
export function createChatMessage(params) {
  const sanitizedText = typeof params.text === 'string' ? params.text.trim() : '';
  const now = Date.now();
  const rand = Math.random().toString(36).substring(2, 9);
  const id = params.customId || `msg_${now}_${rand}`;

  const filesList = Array.isArray(params.files)
    ? params.files
    : params.file
      ? [params.file]
      : [];
  const primaryFile = filesList[0] || null;

  return {
    id,
    conversationId: params.recipient.toLowerCase(),
    sender: params.sender.toLowerCase(),
    recipient: params.recipient.toLowerCase(),
    text: sanitizedText,
    file: primaryFile,
    files: filesList,
    replyTo: params.replyTo || null,
    voice: params.voice || null,
    poll: params.poll || null,
    reactions: {},
    pinned: false,
    saved: false,
    edited: false,
    timestamp: now,
    status: 'sending',
    isOutgoing: true,
  };
}

/**
 * Toggles an emoji reaction from a user on a message reactions map.
 * @param {Record<string, string[]>} reactions
 * @param {string} emoji
 * @param {string} username
 * @returns {Record<string, string[]>}
 */
export function toggleReaction(reactions = {}, emoji, username) {
  const result = { ...reactions };
  const user = String(username).toLowerCase();
  const currentUsers = Array.isArray(result[emoji]) ? [...result[emoji]] : [];

  const idx = currentUsers.indexOf(user);
  if (idx >= 0) {
    currentUsers.splice(idx, 1);
  } else {
    currentUsers.push(user);
  }

  if (currentUsers.length === 0) {
    delete result[emoji];
  } else {
    result[emoji] = currentUsers;
  }

  return result;
}

/**
 * Calculates poll vote distribution and percentages.
 * @param {{ question: string, options: Array<{ id: string, text: string, votes?: string[] }> }} poll
 * @param {string} [currentUsername]
 */
export function calculatePollVotes(poll, currentUsername) {
  if (!poll || !Array.isArray(poll.options)) {
    return { totalVotes: 0, options: [], userVotedId: null };
  }

  const user = currentUsername ? currentUsername.toLowerCase() : '';
  let totalVotes = 0;
  let userVotedId = null;

  poll.options.forEach((opt) => {
    const votes = Array.isArray(opt.votes) ? opt.votes : [];
    totalVotes += votes.length;
    if (user && votes.map((v) => v.toLowerCase()).includes(user)) {
      userVotedId = opt.id;
    }
  });

  const options = poll.options.map((opt) => {
    const votes = Array.isArray(opt.votes) ? opt.votes : [];
    const count = votes.length;
    const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    return {
      id: opt.id,
      text: opt.text,
      count,
      percentage,
      isUserVote: userVotedId === opt.id,
    };
  });

  return { totalVotes, options, userVotedId };
}

/**
 * Formats a chat history into an exportable plain-text document.
 * @param {string} contactName
 * @param {Array<any>} messages
 * @returns {string}
 */
export function formatConversationExport(contactName, messages = []) {
  const dateStr = new Date().toLocaleString();
  const header = `=================================================\n` +
    ` Golden Grove — Conversation Export\n` +
    ` Conversation with: ${contactName}\n` +
    ` Exported on: ${dateStr}\n` +
    ` Total Messages: ${messages.length}\n` +
    `=================================================\n\n`;

  const body = messages
    .map((m) => {
      const time = new Date(m.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const date = new Date(m.timestamp || Date.now()).toLocaleDateString();
      const sender = m.isOutgoing ? 'You' : (m.sender || contactName);
      let content = m.text || '';
      if (m.replyTo) {
        content = `[Replying to "${m.replyTo.text?.slice(0, 30)}..."] ${content}`;
      }
      if (m.file) {
        content += ` [Attachment: ${m.file.name} (${formatFileSize(m.file.size)})]`;
      }
      if (m.voice) {
        content += ` [Voice Note: ${formatVoiceDuration(m.voice.duration)}]`;
      }
      return `[${date} ${time}] ${sender}: ${content}`;
    })
    .join('\n');

  return header + body;
}

/**
 * Highlights matches in text safely escaping HTML.
 * @param {string} text
 * @param {string} query
 * @returns {string}
 */
export function highlightSearchMatch(text, query) {
  if (!text) return '';
  if (!query || !query.trim()) return escapeHtml(text);

  const cleanQuery = query.trim();
  const escaped = escapeHtml(text);
  const regex = new RegExp(`(${cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
}

/**
 * Formats seconds into MM:SS format for audio recording and playback.
 * @param {number} seconds
 * @returns {string}
 */
export function formatVoiceDuration(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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

// ================= FILE SHARING UTILITIES ================= //

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const UPLOAD_CHUNK_SIZE_BYTES = 1024 * 1024; // 1 MB

export const BLOCKED_FILE_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.vbs', '.msi', '.com', '.scr',
  '.pif', '.hta', '.cpl', '.jar', '.php', '.asp', '.aspx', '.cgi',
]);

/**
 * Extracts normalized lowercase file extension including dot, or empty string.
 * @param {string} fileName
 * @returns {string}
 */
export function getFileExtension(fileName) {
  if (typeof fileName !== 'string') return '';
  const clean = fileName.trim();
  const lastDot = clean.lastIndexOf('.');
  if (lastDot < 0 || lastDot === clean.length - 1) return '';
  return clean.slice(lastDot).toLowerCase();
}

/**
 * Checks whether the file extension is blocked for security.
 * @param {string} fileName
 * @returns {boolean}
 */
export function isBlockedExtension(fileName) {
  const ext = getFileExtension(fileName);
  return BLOCKED_FILE_EXTENSIONS.has(ext);
}

/**
 * Sanitizes untrusted filenames to prevent directory traversal and script exploits.
 * @param {string} fileName
 * @returns {string}
 */
export function sanitizeFileName(fileName) {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return `file_${Date.now()}`;
  }
  // Remove control characters & null bytes
  let clean = fileName.replace(/[\x00-\x1f\x7f]/g, '').trim();
  // Strip path traversal sequences
  clean = clean.replace(/(\.\.[\/\\])+/g, '').replace(/[/\\]/g, '_');
  const ext = getFileExtension(clean);
  const baseWithoutExt = ext ? clean.slice(0, clean.length - ext.length) : clean;
  // Keep alphanumeric, dash, underscore, space, dot
  let safeBase = baseWithoutExt.replace(/[^a-zA-Z0-9_\-\.\s()]/g, '_').trim().slice(0, 80);
  if (!safeBase) safeBase = 'file';
  return `${safeBase}${ext}`;
}

/**
 * Determines the category of a file based on its extension and MIME type.
 * @param {string} fileName
 * @param {string} [mimeType]
 * @returns {'image'|'video'|'audio'|'pdf'|'document'|'sheet'|'presentation'|'archive'|'code'|'generic'}
 */
export function getFileCategory(fileName, mimeType = '') {
  const ext = getFileExtension(fileName);
  const mime = (mimeType || '').toLowerCase();

  if (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif'].includes(ext)) {
    return 'image';
  }
  if (mime.startsWith('video/') || ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v'].includes(ext)) {
    return 'video';
  }
  if (mime.startsWith('audio/') || ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus'].includes(ext)) {
    return 'audio';
  }
  if (mime === 'application/pdf' || ext === '.pdf') {
    return 'pdf';
  }
  if (
    mime.includes('sheet') ||
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    mime.includes('csv') ||
    ['.xls', '.xlsx', '.csv', '.tsv', '.ods'].includes(ext)
  ) {
    return 'sheet';
  }
  if (
    mime.includes('presentation') ||
    mime.includes('powerpoint') ||
    ['.ppt', '.pptx', '.odp', '.key'].includes(ext)
  ) {
    return 'presentation';
  }
  if (
    mime.includes('word') ||
    mime.includes('wordprocessingml') ||
    mime.includes('msword') ||
    mime.includes('text/plain') ||
    mime.includes('markdown') ||
    ['.doc', '.docx', '.odt', '.rtf', '.txt', '.md'].includes(ext)
  ) {
    return 'document';
  }
  if (
    mime.includes('zip') ||
    mime.includes('tar') ||
    mime.includes('compressed') ||
    mime.includes('archive') ||
    ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'].includes(ext)
  ) {
    return 'archive';
  }
  if (
    mime.includes('javascript') ||
    mime.includes('typescript') ||
    mime.includes('json') ||
    mime.includes('xml') ||
    ['.js', '.ts', '.tsx', '.jsx', '.json', '.html', '.css', '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.sql', '.yaml', '.yml'].includes(ext)
  ) {
    return 'code';
  }
  return 'generic';
}

/**
 * Returns visual styling and iconography badge for a file category.
 * @param {'image'|'video'|'audio'|'pdf'|'document'|'sheet'|'presentation'|'archive'|'code'|'generic'} category
 */
export function getFileCategoryBadge(category) {
  switch (category) {
    case 'image':
      return { icon: '🖼️', label: 'Image', color: '#557945', bg: '#E8F2E4' };
    case 'video':
      return { icon: '🎬', label: 'Video', color: '#D97706', bg: '#FEF3C7' };
    case 'audio':
      return { icon: '🎵', label: 'Audio', color: '#5D9253', bg: '#E8F2E4' };
    case 'pdf':
      return { icon: '📕', label: 'PDF', color: '#DC2626', bg: '#FEE2E2' };
    case 'document':
      return { icon: '📄', label: 'Document', color: '#2563EB', bg: '#DBEAFE' };
    case 'sheet':
      return { icon: '📊', label: 'Spreadsheet', color: '#16A34A', bg: '#DCFCE7' };
    case 'presentation':
      return { icon: '📽️', label: 'Slides', color: '#EA580C', bg: '#FFEDD5' };
    case 'archive':
      return { icon: '📦', label: 'Archive', color: '#7C3AED', bg: '#EDE9FE' };
    case 'code':
      return { icon: '💻', label: 'Code', color: '#475569', bg: '#F1F5F9' };
    case 'generic':
    default:
      return { icon: '📎', label: 'Attachment', color: '#64748B', bg: '#F8FAFC' };
  }
}

/**
 * Calculates chunk count and chunk sizing for resumable slice uploads.
 * @param {number} fileSize
 * @param {number} [chunkSize]
 * @returns {{ totalChunks: number, chunkSize: number }}
 */
export function calculateChunks(fileSize, chunkSize = UPLOAD_CHUNK_SIZE_BYTES) {
  if (typeof fileSize !== 'number' || fileSize <= 0) {
    return { totalChunks: 0, chunkSize };
  }
  return {
    totalChunks: Math.ceil(fileSize / chunkSize),
    chunkSize,
  };
}

/**
 * Validates a user full name.
 * @param {string} fullName
 * @returns {{ valid: boolean, error?: string, sanitized: string }}
 */
export function validateFullName(fullName) {
  if (typeof fullName !== 'string') {
    return { valid: false, error: 'Full name must be a string', sanitized: '' };
  }
  const sanitized = fullName.trim();
  if (sanitized.length < 2) {
    return { valid: false, error: 'Full name must be at least 2 characters', sanitized };
  }
  if (sanitized.length > 50) {
    return { valid: false, error: 'Full name cannot exceed 50 characters', sanitized };
  }
  return { valid: true, sanitized };
}

/**
 * Validates password meets security requirements:
 * At least 6 characters, contains at least one letter and one number.
 * @param {string} password
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters' };
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one letter and one number' };
  }
  return { valid: true };
}

/**
 * Evaluates password strength:
 * Returns score (0-4), label, percentage, and color.
 * @param {string} password
 * @returns {{ score: number, label: string, percent: number, color: string }}
 */
export function evaluatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { score: 0, label: 'Weak', percent: 0, color: '#DC2626' };
  }

  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) {
    return { score: 1, label: 'Weak', percent: 25, color: '#DC2626' };
  } else if (score === 2) {
    return { score: 2, label: 'Fair', percent: 50, color: '#F1A344' };
  } else if (score === 3 || score === 4) {
    return { score: 3, label: 'Good', percent: 75, color: '#5D9253' };
  } else {
    return { score: 4, label: 'Strong', percent: 100, color: '#557945' };
  }
}



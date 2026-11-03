/**
 * MeshChat - Local Persistence Layer
 * Implements IndexedDB for conversations, messages, and drafts.
 * Uses localStorage only for lightweight UI preferences.
 */

const DB_NAME = 'meshchat_db';
const DB_VERSION = 1;

class MeshStorage {
  constructor() {
    /** @type {IDBDatabase | null} */
    this.db = null;
    this.initPromise = this.init();
  }

  async init() {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB is not available in this environment');
      return null;
    }

    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = /** @type {IDBOpenDBRequest} */ (event.target).result;

        // Conversations store: keyed by contact username
        if (!db.objectStoreNames.contains('conversations')) {
          const convStore = db.createObjectStore('conversations', { keyPath: 'id' });
          convStore.createIndex('by_lastTimestamp', 'lastTimestamp', { unique: false });
        }

        // Messages store: keyed by message ID
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('by_conversation', 'conversationId', { unique: false });
          msgStore.createIndex('by_timestamp', 'timestamp', { unique: false });
        }

        // Drafts store: keyed by conversationId
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'conversationId' });
        }
      };

      request.onsuccess = (event) => {
        this.db = /** @type {IDBOpenDBRequest} */ (event.target).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('Failed to open IndexedDB:', event);
        reject(event);
      };
    });
  }

  async getDb() {
    if (!this.db) {
      await this.initPromise;
    }
    return this.db;
  }

  // --- Conversations ---

  async saveConversation(conv) {
    const db = await this.getDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('conversations', 'readwrite');
      const store = tx.objectStore('conversations');
      const req = store.put(conv);
      req.onsuccess = () => resolve(conv);
      req.onerror = () => reject(req.error);
    });
  }

  async getConversation(id) {
    const db = await this.getDb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('conversations', 'readonly');
      const store = tx.objectStore('conversations');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllConversations() {
    const db = await this.getDb();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction('conversations', 'readonly');
      const store = tx.objectStore('conversations');
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        // Sort by lastTimestamp descending
        list.sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteConversation(id) {
    const db = await this.getDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['conversations', 'messages', 'drafts'], 'readwrite');
      tx.objectStore('conversations').delete(id);
      tx.objectStore('drafts').delete(id);

      // Delete all messages matching conversationId
      const msgStore = tx.objectStore('messages');
      const index = msgStore.index('by_conversation');
      const range = IDBKeyRange.only(id);
      const req = index.openCursor(range);
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Messages ---

  async saveMessage(msg) {
    const db = await this.getDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const req = store.put(msg);
      req.onsuccess = () => resolve(msg);
      req.onerror = () => reject(req.error);
    });
  }

  async getMessages(conversationId) {
    const db = await this.getDb();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const index = store.index('by_conversation');
      const range = IDBKeyRange.only(conversationId);
      const req = index.getAll(range);
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => a.timestamp - b.timestamp);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async updateMessageStatus(id, newStatus) {
    const db = await this.getDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const msg = getReq.result;
        if (msg) {
          msg.status = newStatus;
          store.put(msg);
          resolve(msg);
        } else {
          resolve(null);
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async editMessage(id, newText) {
    const db = await this.getDb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const msg = getReq.result;
        if (msg) {
          msg.text = newText;
          msg.edited = true;
          msg.editedAt = Date.now();
          store.put(msg);
          resolve(msg);
        } else {
          resolve(null);
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async togglePinMessage(id) {
    const db = await this.getDb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const msg = getReq.result;
        if (msg) {
          msg.pinned = !msg.pinned;
          store.put(msg);
          resolve(msg);
        } else {
          resolve(null);
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async toggleSaveMessage(id) {
    const db = await this.getDb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['messages', 'conversations'], 'readwrite');
      const msgStore = tx.objectStore('messages');
      const getReq = msgStore.get(id);
      getReq.onsuccess = () => {
        const msg = getReq.result;
        if (msg) {
          msg.saved = !msg.saved;
          msgStore.put(msg);
          resolve(msg);
        } else {
          resolve(null);
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async setMessageReaction(id, emoji, username) {
    const db = await this.getDb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const msg = getReq.result;
        if (msg) {
          msg.reactions = msg.reactions || {};
          const current = Array.isArray(msg.reactions[emoji]) ? [...msg.reactions[emoji]] : [];
          const user = String(username).toLowerCase();
          const idx = current.indexOf(user);
          if (idx >= 0) {
            current.splice(idx, 1);
          } else {
            current.push(user);
          }
          if (current.length === 0) {
            delete msg.reactions[emoji];
          } else {
            msg.reactions[emoji] = current;
          }
          store.put(msg);
          resolve(msg);
        } else {
          resolve(null);
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async votePollOption(messageId, optionId, username) {
    const db = await this.getDb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const getReq = store.get(messageId);
      getReq.onsuccess = () => {
        const msg = getReq.result;
        if (msg && msg.poll && Array.isArray(msg.poll.options)) {
          const user = String(username).toLowerCase();
          msg.poll.options.forEach((opt) => {
            opt.votes = Array.isArray(opt.votes) ? opt.votes : [];
            const idx = opt.votes.indexOf(user);
            if (opt.id === optionId) {
              if (idx < 0) opt.votes.push(user);
            } else {
              if (idx >= 0) opt.votes.splice(idx, 1);
            }
          });
          store.put(msg);
          resolve(msg);
        } else {
          resolve(null);
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async deleteMessage(id) {
    const db = await this.getDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async searchAllMessages(query) {
    const db = await this.getDb();
    if (!db || !query || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        const matches = list
          .filter((m) => m.text && m.text.toLowerCase().includes(q))
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        resolve(matches);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getSavedMessages() {
    const db = await this.getDb();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messages', 'readonly');
      const store = tx.objectStore('messages');
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        const matches = list
          .filter((m) => m.saved === true || m.conversationId === '__saved_notes__')
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        resolve(matches);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async toggleConversationFavorite(conversationId) {
    const conv = await this.getConversation(conversationId);
    if (!conv) return null;
    conv.isFavorite = !conv.isFavorite;
    await this.saveConversation(conv);
    return conv;
  }

  async toggleConversationMuted(conversationId) {
    const conv = await this.getConversation(conversationId);
    if (!conv) return null;
    conv.isMuted = !conv.isMuted;
    await this.saveConversation(conv);
    return conv;
  }

  async toggleConversationArchived(conversationId) {
    const conv = await this.getConversation(conversationId);
    if (!conv) return null;
    conv.isArchived = !conv.isArchived;
    await this.saveConversation(conv);
    return conv;
  }

  // --- Drafts ---

  async saveDraft(conversationId, text) {
    const db = await this.getDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      const store = tx.objectStore('drafts');
      if (!text || text.trim() === '') {
        store.delete(conversationId);
      } else {
        store.put({ conversationId, text });
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async getDraft(conversationId) {
    const db = await this.getDb();
    if (!db) return '';
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', 'readonly');
      const store = tx.objectStore('drafts');
      const req = store.get(conversationId);
      req.onsuccess = () => resolve(req.result ? req.result.text : '');
      req.onerror = () => reject(req.error);
    });
  }

  // Clear all local data
  async clearAll() {
    const db = await this.getDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['conversations', 'messages', 'drafts'], 'readwrite');
      tx.objectStore('conversations').clear();
      tx.objectStore('messages').clear();
      tx.objectStore('drafts').clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Preferences (localStorage only) ---

  getPreference(key, defaultValue) {
    try {
      const val = localStorage.getItem(`meshchat_pref_${key}`);
      return val !== null ? JSON.parse(val) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  setPreference(key, value) {
    try {
      localStorage.setItem(`meshchat_pref_${key}`, JSON.stringify(value));
    } catch (err) {
      console.warn('Failed to save preference:', err);
    }
  }
}

export const storage = new MeshStorage();

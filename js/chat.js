/**
 * MeshChat - Chat Coordination & Message Pipeline
 * Orchestrates conversation history, message lifecycle, delivery acks,
 * typing notifications, and file transfer.
 */

import { auth } from './auth.js';
import { storage } from './storage.js';
import { webrtc } from './webrtc.js';
import { createChatMessage, transitionMessageStatus } from './utils.js';

export class ChatManager {
  constructor() {
    this.activeContact = null;
    this.typingTimers = new Map();
    this.listeners = new Map();

    // Listen to WebRTC events
    webrtc.on('chatMessage', (e) => this.handleIncomingMessage(e.peer, e.message));
    webrtc.on('messageStatus', (e) => this.handleStatusUpdate(e.peer, e.messageId, e.status));
    webrtc.on('typing', (e) => this.handleTyping(e.peer, e.isTyping));
    webrtc.on('connectionStatus', (e) => this.emit('connectionChange', e));
  }

  getActiveContact() {
    return this.activeContact;
  }

  /**
   * Sets current active conversation.
   */
  async setActiveContact(contact) {
    this.activeContact = contact;
    if (contact) {
      // Connect / initiate WebRTC peer connection
      webrtc.getOrCreatePeer(contact.username, true);

      // Reset unread count for this conversation
      const conv = await storage.getConversation(contact.username);
      if (conv && conv.unreadCount > 0) {
        conv.unreadCount = 0;
        await storage.saveConversation(conv);
        this.emit('conversationUpdated', conv);
      }

      // Mark unread incoming messages as read
      const msgs = await storage.getMessages(contact.username);
      for (const m of msgs) {
        if (!m.isOutgoing && m.status !== 'read') {
          await storage.updateMessageStatus(m.id, 'read');
          webrtc.sendReadAck(contact.username, m.id);
        }
      }
    }
    this.emit('activeContactChanged', contact);
  }

  /**
   * Sends a new message to the active contact.
   */
  async sendMessage(text, fileData = null) {
    if (!this.activeContact) throw new Error('No active conversation');
    const currentUser = auth.getCurrentUser();
    if (!currentUser) throw new Error('Not logged in');

    const peer = this.activeContact.username;

    // Create message structure
    const msg = createChatMessage({
      sender: currentUser.username,
      recipient: peer,
      text,
      file: fileData,
    });

    // Save locally to IndexedDB as sending
    await storage.saveMessage(msg);

    // Update conversation metadata
    const conv = {
      id: peer,
      contactUsername: peer,
      contactDisplayName: this.activeContact.displayName || peer,
      contactAvatar: this.activeContact.avatar || 'avatar_1',
      lastMessage: fileData ? `📎 ${fileData.name}` : text,
      lastTimestamp: msg.timestamp,
      unreadCount: 0,
      pinned: false,
    };
    await storage.saveConversation(conv);

    this.emit('messageAdded', msg);
    this.emit('conversationUpdated', conv);

    // Send payload over WebRTC DataChannel (or relay fallback)
    const payload = {
      type: 'chat',
      id: msg.id,
      text: msg.text,
      file: msg.file,
      timestamp: msg.timestamp,
      sender: currentUser.username,
      displayName: currentUser.displayName,
      avatar: currentUser.avatar,
    };

    try {
      const res = await webrtc.sendData(peer, payload);
      if (res.success) {
        // Local transport accepted: update status to 'sent'
        msg.status = 'sent';
        await storage.updateMessageStatus(msg.id, 'sent');
        this.emit('messageStatusUpdated', { messageId: msg.id, status: 'sent', peer });
      } else {
        msg.status = 'failed';
        await storage.updateMessageStatus(msg.id, 'failed');
        this.emit('messageStatusUpdated', { messageId: msg.id, status: 'failed', peer });
      }
    } catch (err) {
      msg.status = 'failed';
      await storage.updateMessageStatus(msg.id, 'failed');
      this.emit('messageStatusUpdated', { messageId: msg.id, status: 'failed', peer });
    }

    return msg;
  }

  /**
   * Handles incoming message from peer.
   */
  async handleIncomingMessage(peer, data) {
    const isCurrentActive = this.activeContact && this.activeContact.username === peer;

    const msg = {
      id: data.id,
      conversationId: peer,
      sender: peer,
      recipient: auth.getCurrentUser()?.username || '',
      text: data.text || '',
      file: data.file || null,
      timestamp: data.timestamp || Date.now(),
      status: isCurrentActive ? 'read' : 'delivered',
      isOutgoing: false,
    };

    // Save to IndexedDB
    await storage.saveMessage(msg);

    // Update conversation list
    let conv = await storage.getConversation(peer);
    if (!conv) {
      conv = {
        id: peer,
        contactUsername: peer,
        contactDisplayName: data.displayName || peer,
        contactAvatar: data.avatar || 'avatar_1',
        lastMessage: data.file ? `📎 ${data.file.name}` : data.text,
        lastTimestamp: msg.timestamp,
        unreadCount: isCurrentActive ? 0 : 1,
        pinned: false,
      };
    } else {
      conv.lastMessage = data.file ? `📎 ${data.file.name}` : data.text;
      conv.lastTimestamp = msg.timestamp;
      if (!isCurrentActive) {
        conv.unreadCount = (conv.unreadCount || 0) + 1;
      }
    }
    await storage.saveConversation(conv);

    this.emit('messageAdded', msg);
    this.emit('conversationUpdated', conv);

    // If currently active, acknowledge read
    if (isCurrentActive) {
      webrtc.sendReadAck(peer, msg.id);
    }
  }

  /**
   * Updates message delivery state (sent -> delivered -> read)
   */
  async handleStatusUpdate(peer, messageId, newStatus) {
    const msgs = await storage.getMessages(peer);
    const existing = msgs.find((m) => m.id === messageId);
    if (!existing) return;

    const updatedStatus = transitionMessageStatus(existing.status, newStatus);
    if (updatedStatus !== existing.status) {
      await storage.updateMessageStatus(messageId, updatedStatus);
      this.emit('messageStatusUpdated', { messageId, status: updatedStatus, peer });
    }
  }

  handleTyping(peer, isTyping) {
    this.emit('typingChanged', { peer, isTyping });
  }

  sendTypingStatus(isTyping) {
    if (!this.activeContact) return;
    webrtc.sendTyping(this.activeContact.username, isTyping);
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event).delete(handler);
  }

  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const fn of handlers) {
        try {
          fn(data);
        } catch (e) {
          console.error(`Error in Chat listener for ${event}:`, e);
        }
      }
    }
  }
}

export const chat = new ChatManager();

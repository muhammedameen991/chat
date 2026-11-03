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
    webrtc.on('messageReaction', (e) => this.handleIncomingReaction(e.peer, e.messageId, e.emoji, e.username));
    webrtc.on('messageEdited', (e) => this.handleIncomingEdit(e.peer, e.messageId, e.newText));
    webrtc.on('messageDeleted', (e) => this.handleIncomingDelete(e.peer, e.messageId));
    webrtc.on('messagePinned', (e) => this.handleIncomingPin(e.peer, e.messageId, e.pinned));
    webrtc.on('pollVoted', (e) => this.handleIncomingPollVote(e.peer, e.messageId, e.optionId, e.username));
    webrtc.on('callSignal', (e) => this.emit('callSignal', e));
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
      if (contact.username !== '__saved_notes__') {
        webrtc.getOrCreatePeer(contact.username, true);
      }

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
          if (contact.username !== '__saved_notes__') {
            webrtc.sendReadAck(contact.username, m.id);
          }
        }
      }
    }
    this.emit('activeContactChanged', contact);
  }

  /**
   * Sends a new message to the active contact.
   */
  async sendMessage(text, fileData = null, replyTo = null, voiceData = null, pollData = null, filesData = null) {
    if (!this.activeContact) throw new Error('No active conversation');
    const currentUser = auth.getCurrentUser();
    if (!currentUser) throw new Error('Not logged in');

    const peer = this.activeContact.username;

    // Handle single or multiple files
    const allFiles = Array.isArray(filesData)
      ? filesData
      : Array.isArray(fileData)
        ? fileData
        : fileData
          ? [fileData]
          : [];

    // Create message structure
    const msg = createChatMessage({
      sender: currentUser.username,
      recipient: peer,
      text,
      file: allFiles[0] || null,
      files: allFiles,
      replyTo: replyTo ? { id: replyTo.id, text: replyTo.text, sender: replyTo.sender } : null,
      voice: voiceData,
      poll: pollData,
    });

    // Save locally to IndexedDB as sending (or sent if saved notes)
    if (peer === '__saved_notes__') {
      msg.status = 'read';
    }
    await storage.saveMessage(msg);

    // Update conversation metadata
    let lastSummary = text;
    if (allFiles.length > 1) lastSummary = `📎 ${allFiles.length} files shared`;
    else if (allFiles.length === 1) lastSummary = `📎 ${allFiles[0].name}`;
    else if (voiceData) lastSummary = `🎙️ Voice Note (${Math.round(voiceData.duration)}s)`;
    else if (pollData) lastSummary = `📊 Poll: ${pollData.question}`;

    const existingConv = await storage.getConversation(peer);
    const conv = {
      id: peer,
      contactUsername: peer,
      contactDisplayName: this.activeContact.displayName || peer,
      contactAvatar: this.activeContact.avatar || 'avatar_1',
      lastMessage: lastSummary,
      lastTimestamp: msg.timestamp,
      unreadCount: 0,
      isFavorite: existingConv ? existingConv.isFavorite : false,
      isMuted: existingConv ? existingConv.isMuted : false,
      isArchived: existingConv ? existingConv.isArchived : false,
      isGroup: existingConv ? existingConv.isGroup : false,
    };
    await storage.saveConversation(conv);

    this.emit('messageAdded', msg);
    this.emit('conversationUpdated', conv);

    if (peer === '__saved_notes__') {
      return msg;
    }

    // Send payload over WebRTC DataChannel (or relay fallback)
    const payload = {
      type: 'chat',
      id: msg.id,
      text: msg.text,
      file: msg.file,
      files: msg.files,
      replyTo: msg.replyTo,
      voice: msg.voice,
      poll: msg.poll,
      timestamp: msg.timestamp,
      sender: currentUser.username,
      displayName: currentUser.displayName,
      avatar: currentUser.avatar,
    };

    try {
      const res = await webrtc.sendData(peer, payload);
      if (res.success) {
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
   * Toggles emoji reaction on a message and notifies peer.
   */
  async sendReaction(messageId, emoji) {
    const user = auth.getCurrentUser();
    if (!user) return;
    const msg = await storage.setMessageReaction(messageId, emoji, user.username);
    if (!msg) return;

    this.emit('messageUpdated', msg);

    if (this.activeContact && this.activeContact.username !== '__saved_notes__') {
      webrtc.sendData(this.activeContact.username, {
        type: 'reaction',
        messageId,
        emoji,
        username: user.username,
      });
    }
  }

  /**
   * Edits own message and notifies peer.
   */
  async editMessage(messageId, newText) {
    const msg = await storage.editMessage(messageId, newText);
    if (!msg) return;

    this.emit('messageUpdated', msg);

    if (this.activeContact && this.activeContact.username !== '__saved_notes__') {
      webrtc.sendData(this.activeContact.username, {
        type: 'edit',
        messageId,
        newText,
      });
    }
  }

  /**
   * Deletes a message locally and notifies peer.
   */
  async deleteMessage(messageId) {
    await storage.deleteMessage(messageId);
    this.emit('messageDeleted', { messageId });

    if (this.activeContact && this.activeContact.username !== '__saved_notes__') {
      webrtc.sendData(this.activeContact.username, {
        type: 'delete',
        messageId,
      });
    }
  }

  /**
   * Toggles pin status for a message.
   */
  async togglePin(messageId) {
    const msg = await storage.togglePinMessage(messageId);
    if (!msg) return;

    this.emit('messageUpdated', msg);

    if (this.activeContact && this.activeContact.username !== '__saved_notes__') {
      webrtc.sendData(this.activeContact.username, {
        type: 'pin',
        messageId,
        pinned: msg.pinned,
      });
    }
  }

  /**
   * Toggles bookmark/saved message.
   */
  async toggleSave(messageId) {
    const msg = await storage.toggleSaveMessage(messageId);
    if (msg) {
      this.emit('messageUpdated', msg);
    }
  }

  /**
   * Casts a vote on a group poll option.
   */
  async votePoll(messageId, optionId) {
    const user = auth.getCurrentUser();
    if (!user) return;
    const msg = await storage.votePollOption(messageId, optionId, user.username);
    if (!msg) return;

    this.emit('messageUpdated', msg);

    if (this.activeContact && this.activeContact.username !== '__saved_notes__') {
      webrtc.sendData(this.activeContact.username, {
        type: 'poll_vote',
        messageId,
        optionId,
        username: user.username,
      });
    }
  }

  /**
   * Sends audio/video call control signal.
   */
  sendCallSignal(peer, action, callType, payload = {}) {
    const user = auth.getCurrentUser();
    if (!user || !peer) return;

    webrtc.sendData(peer, {
      type: 'call_signal',
      action, // 'offer' | 'answer' | 'reject' | 'end'
      callType, // 'voice' | 'video'
      caller: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      payload,
    });
  }

  async handleIncomingReaction(peer, messageId, emoji, username) {
    const msg = await storage.setMessageReaction(messageId, emoji, username);
    if (msg) {
      this.emit('messageUpdated', msg);
    }
  }

  async handleIncomingEdit(peer, messageId, newText) {
    const msg = await storage.editMessage(messageId, newText);
    if (msg) {
      this.emit('messageUpdated', msg);
    }
  }

  async handleIncomingDelete(peer, messageId) {
    await storage.deleteMessage(messageId);
    this.emit('messageDeleted', { messageId });
  }

  async handleIncomingPin(peer, messageId, pinned) {
    const msgs = await storage.getMessages(peer);
    const target = msgs.find((m) => m.id === messageId);
    if (target) {
      target.pinned = pinned;
      await storage.saveMessage(target);
      this.emit('messageUpdated', target);
    }
  }

  async handleIncomingPollVote(peer, messageId, optionId, username) {
    const msg = await storage.votePollOption(messageId, optionId, username);
    if (msg) {
      this.emit('messageUpdated', msg);
    }
  }

  /**
   * Handles incoming message from peer.
   */
  async handleIncomingMessage(peer, data) {
    const isCurrentActive = this.activeContact && this.activeContact.username === peer;

    const incomingFiles = Array.isArray(data.files)
      ? data.files
      : data.file
        ? [data.file]
        : [];

    let summary = data.text || '';
    if (incomingFiles.length > 1) summary = `📎 ${incomingFiles.length} files shared`;
    else if (incomingFiles.length === 1) summary = `📎 ${incomingFiles[0].name}`;
    else if (data.voice) summary = `🎙️ Voice Note (${Math.round(data.voice.duration)}s)`;
    else if (data.poll) summary = `📊 Poll: ${data.poll.question}`;

    const msg = {
      id: data.id,
      conversationId: peer,
      sender: peer,
      recipient: auth.getCurrentUser()?.username || '',
      text: data.text || '',
      file: incomingFiles[0] || null,
      files: incomingFiles,
      replyTo: data.replyTo || null,
      voice: data.voice || null,
      poll: data.poll || null,
      reactions: {},
      pinned: false,
      saved: false,
      edited: false,
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
        lastMessage: summary,
        lastTimestamp: msg.timestamp,
        unreadCount: isCurrentActive ? 0 : 1,
        isFavorite: false,
        isMuted: false,
        isArchived: false,
        isGroup: false,
      };
    } else {
      conv.lastMessage = summary;
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

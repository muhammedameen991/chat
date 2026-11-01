/**
 * MeshChat - WebRTC Real-Time P2P Communication Engine
 * Manages RTCPeerConnection, RTCDataChannel, automated SDP offer/answer exchange,
 * ICE candidate negotiation, delivery acks, typing indicators, and chunked file transfer.
 */

import { signaling } from './signaling.js';
import { storage } from './storage.js';

export class WebRTCManager {
  constructor() {
    /** @type {Map<string, { pc: RTCPeerConnection, channel: RTCDataChannel | null, status: string, pendingCandidates: RTCIceCandidateInit[] }>} */
    this.peers = new Map();
    this.currentUser = null;
    this.eventListeners = new Map();

    // Default public STUN servers
    this.defaultIceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ];

    // Listen to signaling messages
    signaling.onSignal((signal) => this.handleSignalingMessage(signal));
  }

  setCurrentUser(username) {
    this.currentUser = username ? username.trim().toLowerCase() : null;
  }

  getIceServers() {
    const servers = [...this.defaultIceServers];
    const turnConfig = storage.getPreference('turnServer', null);
    if (turnConfig && turnConfig.url) {
      const entry = { urls: turnConfig.url };
      if (turnConfig.username) entry.username = turnConfig.username;
      if (turnConfig.credential) entry.credential = turnConfig.credential;
      servers.push(entry);
    }
    return servers;
  }

  /**
   * Gets or initializes peer connection for a contact.
   * @param {string} peerUsername
   * @param {boolean} [isInitiator=false]
   */
  async getOrCreatePeer(peerUsername, isInitiator = false) {
    const peer = peerUsername.trim().toLowerCase();
    if (this.peers.has(peer)) {
      const existing = this.peers.get(peer);
      if (existing.pc.connectionState !== 'closed' && existing.pc.connectionState !== 'failed') {
        if (isInitiator && (!existing.channel || existing.channel.readyState !== 'open')) {
          this.initiateOffer(peer);
        }
        return existing;
      }
      this.closePeer(peer);
    }

    const pc = new RTCPeerConnection({
      iceServers: this.getIceServers(),
    });

    const peerData = {
      pc,
      channel: null,
      status: 'connecting',
      pendingCandidates: [],
    };
    this.peers.set(peer, peerData);
    this.emit('connectionStatus', { peer, status: 'connecting' });

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signaling.send(peer, 'candidate', event.candidate.toJSON());
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      let uiStatus = 'connecting';
      if (state === 'connected') uiStatus = 'connected';
      else if (state === 'disconnected') uiStatus = 'reconnecting';
      else if (state === 'failed') uiStatus = 'failed';
      else if (state === 'closed') uiStatus = 'offline';

      peerData.status = uiStatus;
      this.emit('connectionStatus', { peer, status: uiStatus });
    };

    // Remote data channel handler (for answering side)
    pc.ondatachannel = (event) => {
      this.setupDataChannel(peer, event.channel);
    };

    if (isInitiator) {
      // Create data channel
      const channel = pc.createDataChannel('meshchat_channel', {
        ordered: true,
      });
      this.setupDataChannel(peer, channel);
      await this.initiateOffer(peer);
    }

    return peerData;
  }

  setupDataChannel(peer, channel) {
    const peerData = this.peers.get(peer);
    if (!peerData) return;

    peerData.channel = channel;

    channel.onopen = () => {
      peerData.status = 'connected';
      this.emit('connectionStatus', { peer, status: 'connected', directP2P: true });
    };

    channel.onclose = () => {
      peerData.status = 'disconnected';
      this.emit('connectionStatus', { peer, status: 'disconnected', directP2P: false });
    };

    channel.onerror = (err) => {
      console.warn(`DataChannel error with ${peer}:`, err);
    };

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handlePeerData(peer, data);
      } catch (err) {
        console.error('Failed to parse peer message:', err);
      }
    };
  }

  async initiateOffer(peer) {
    const peerData = this.peers.get(peer);
    if (!peerData) return;
    try {
      const offer = await peerData.pc.createOffer();
      await peerData.pc.setLocalDescription(offer);
      await signaling.send(peer, 'offer', offer);
    } catch (err) {
      console.error(`Failed to initiate offer to ${peer}:`, err);
    }
  }

  /**
   * Handles incoming signaling messages from server
   */
  async handleSignalingMessage(signal) {
    if (!signal || !signal.from || signal.from === this.currentUser) return;
    const peer = signal.from.toLowerCase();

    switch (signal.type) {
      case 'offer': {
        const peerData = await this.getOrCreatePeer(peer, false);
        try {
          await peerData.pc.setRemoteDescription(new RTCSessionDescription(signal.payload));

          // Drain queued candidates
          while (peerData.pendingCandidates.length > 0) {
            const cand = peerData.pendingCandidates.shift();
            await peerData.pc.addIceCandidate(new RTCIceCandidate(cand));
          }

          const answer = await peerData.pc.createAnswer();
          await peerData.pc.setLocalDescription(answer);
          await signaling.send(peer, 'answer', answer);
        } catch (err) {
          console.error(`Error handling offer from ${peer}:`, err);
        }
        break;
      }

      case 'answer': {
        const peerData = this.peers.get(peer);
        if (peerData && peerData.pc.signalingState !== 'stable') {
          try {
            await peerData.pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
            // Drain queued candidates
            while (peerData.pendingCandidates.length > 0) {
              const cand = peerData.pendingCandidates.shift();
              await peerData.pc.addIceCandidate(new RTCIceCandidate(cand));
            }
          } catch (err) {
            console.error(`Error handling answer from ${peer}:`, err);
          }
        }
        break;
      }

      case 'candidate': {
        const peerData = this.peers.get(peer);
        if (peerData && signal.payload) {
          try {
            if (peerData.pc.remoteDescription) {
              await peerData.pc.addIceCandidate(new RTCIceCandidate(signal.payload));
            } else {
              peerData.pendingCandidates.push(signal.payload);
            }
          } catch (err) {
            console.error(`Error adding ICE candidate from ${peer}:`, err);
          }
        }
        break;
      }

      case 'message': {
        // Fallback message relay via signaling channel
        if (signal.payload) {
          this.handlePeerData(peer, signal.payload);
        }
        break;
      }

      case 'ack': {
        if (signal.payload) {
          this.emit('messageStatus', {
            peer,
            messageId: signal.payload.messageId,
            status: signal.payload.status || 'delivered',
          });
        }
        break;
      }

      case 'typing': {
        if (signal.payload) {
          this.emit('typing', {
            peer,
            isTyping: !!signal.payload.isTyping,
          });
        }
        break;
      }

      case 'bye': {
        this.closePeer(peer);
        break;
      }
    }
  }

  /**
   * Handles incoming direct data payload from peer (via DataChannel or Relay)
   */
  handlePeerData(peer, data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'chat': {
        this.emit('chatMessage', { peer, message: data });
        // Automatically send delivery acknowledgment back to peer
        this.sendAck(peer, data.id, 'delivered');
        break;
      }

      case 'ack': {
        this.emit('messageStatus', {
          peer,
          messageId: data.messageId,
          status: data.status || 'delivered',
        });
        break;
      }

      case 'read': {
        this.emit('messageStatus', {
          peer,
          messageId: data.messageId,
          status: 'read',
        });
        break;
      }

      case 'typing': {
        this.emit('typing', {
          peer,
          isTyping: !!data.isTyping,
        });
        break;
      }

      case 'file_meta': {
        this.emit('fileMeta', { peer, fileMeta: data });
        break;
      }

      case 'file_chunk': {
        this.emit('fileChunk', { peer, chunk: data });
        break;
      }
    }
  }

  /**
   * Sends data to peer using direct RTCDataChannel if open, or signaling relay fallback.
   */
  async sendData(peer, data) {
    const peerData = this.peers.get(peer);

    // 1. Try direct WebRTC DataChannel
    if (peerData && peerData.channel && peerData.channel.readyState === 'open') {
      try {
        peerData.channel.send(JSON.stringify(data));
        return { success: true, transport: 'webrtc' };
      } catch (err) {
        console.warn('DataChannel send failed, falling back to signaling:', err);
      }
    }

    // 2. Fallback to signaling relay
    const sent = await signaling.send(peer, 'message', data);
    return { success: sent, transport: 'signaling_relay' };
  }

  async sendAck(peer, messageId, status = 'delivered') {
    const ackPayload = { type: 'ack', messageId, status, timestamp: Date.now() };
    await this.sendData(peer, ackPayload);
  }

  async sendReadAck(peer, messageId) {
    const readPayload = { type: 'read', messageId, timestamp: Date.now() };
    await this.sendData(peer, readPayload);
  }

  async sendTyping(peer, isTyping) {
    const typingPayload = { type: 'typing', isTyping, timestamp: Date.now() };
    await this.sendData(peer, typingPayload);
  }

  getConnectionStatus(peer) {
    const peerData = this.peers.get(peer.toLowerCase());
    if (!peerData) return 'disconnected';
    if (peerData.channel && peerData.channel.readyState === 'open') {
      return 'connected';
    }
    return peerData.status || 'connecting';
  }

  closePeer(peer) {
    const peerData = this.peers.get(peer);
    if (peerData) {
      try {
        if (peerData.channel) peerData.channel.close();
        peerData.pc.close();
      } catch (e) {
        // ignored
      }
      this.peers.delete(peer);
      this.emit('connectionStatus', { peer, status: 'offline' });
    }
  }

  on(event, handler) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(handler);
    return () => this.eventListeners.get(event).delete(handler);
  }

  emit(event, data) {
    const set = this.eventListeners.get(event);
    if (set) {
      for (const fn of set) {
        try {
          fn(data);
        } catch (e) {
          console.error(`Error in WebRTC listener for ${event}:`, e);
        }
      }
    }
  }
}

export const webrtc = new WebRTCManager();

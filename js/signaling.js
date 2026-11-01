/**
 * MeshChat - Signaling Client
 * Handles real-time signaling exchange using Server-Sent Events (SSE) and HTTP polling fallback.
 * Dispatches WebRTC connection offers, answers, ICE candidates, delivery acks, and presence.
 */

export class SignalingClient {
  constructor() {
    this.currentUser = null;
    this.eventSource = null;
    this.listeners = new Set();
    this.pollInterval = null;
    this.heartbeatInterval = null;
    this.lastSignalTimestamp = 0;
    this.isConnected = false;
    this.statusListeners = new Set();
  }

  /**
   * Initializes signaling session for the given username.
   * @param {string} username
   */
  connect(username) {
    if (!username) return;
    this.disconnect();
    this.currentUser = username.trim().toLowerCase();
    this.lastSignalTimestamp = Date.now() - 30000; // fetch recent if missed

    this.startSse();
    this.startHeartbeat();
  }

  startSse() {
    if (typeof window === 'undefined' || !window.EventSource) {
      this.startPolling();
      return;
    }

    try {
      const url = `/api/signaling/stream?user=${encodeURIComponent(this.currentUser)}`;
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.notifyStatus(true);
        // Stop polling if active
        if (this.pollInterval) {
          clearInterval(this.pollInterval);
          this.pollInterval = null;
        }
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.timestamp) {
            this.lastSignalTimestamp = Math.max(this.lastSignalTimestamp, data.timestamp);
          }
          this.dispatchSignal(data);
        } catch (err) {
          console.warn('Invalid SSE data received:', err);
        }
      };

      this.eventSource.onerror = () => {
        // Fall back to polling on SSE disconnect or serverless timeout
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        this.startPolling();
      };
    } catch (err) {
      this.startPolling();
    }
  }

  startPolling() {
    if (this.pollInterval) return;

    // Immediately poll once
    this.pollOnce();

    // Poll every 1.5 seconds
    this.pollInterval = setInterval(() => {
      this.pollOnce();
    }, 1500);
  }

  async pollOnce() {
    if (!this.currentUser) return;
    try {
      const res = await fetch(
        `/api/signaling/poll?user=${encodeURIComponent(this.currentUser)}&since=${this.lastSignalTimestamp}`
      );
      if (res.ok) {
        const data = await res.json();
        this.isConnected = true;
        this.notifyStatus(true);
        if (data.signals && Array.isArray(data.signals)) {
          for (const sig of data.signals) {
            if (sig.timestamp > this.lastSignalTimestamp) {
              this.lastSignalTimestamp = sig.timestamp;
            }
            this.dispatchSignal(sig);
          }
        }
      }
    } catch (err) {
      this.isConnected = false;
      this.notifyStatus(false);
    }
  }

  startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    const sendBeat = async () => {
      if (!this.currentUser) return;
      try {
        await fetch('/api/users/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: this.currentUser }),
        });
      } catch (e) {
        // silent
      }
    };
    sendBeat();
    this.heartbeatInterval = setInterval(sendBeat, 25000);
  }

  /**
   * Sends a signaling message to a target peer.
   * @param {string} to
   * @param {string} type ('offer' | 'answer' | 'candidate' | 'ack' | 'typing' | 'message' | 'bye')
   * @param {any} payload
   */
  async send(to, type, payload) {
    if (!this.currentUser || !to) return false;
    const body = {
      from: this.currentUser,
      to: to.trim().toLowerCase(),
      type,
      payload: payload ?? null,
      timestamp: Date.now(),
    };

    try {
      const res = await fetch('/api/signaling/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return res.ok;
    } catch (err) {
      console.error('Signaling send failed:', err);
      return false;
    }
  }

  onSignal(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  onStatusChange(callback) {
    this.statusListeners.add(callback);
    callback(this.isConnected);
    return () => this.statusListeners.delete(callback);
  }

  notifyStatus(connected) {
    for (const cb of this.statusListeners) {
      cb(connected);
    }
  }

  dispatchSignal(signal) {
    if (!signal) return;
    for (const listener of this.listeners) {
      try {
        listener(signal);
      } catch (err) {
        console.error('Signal listener error:', err);
      }
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.isConnected = false;
    this.notifyStatus(false);
  }
}

export const signaling = new SignalingClient();

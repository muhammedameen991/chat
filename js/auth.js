/**
 * Golden Grove — Authentication & Session Management
 * Handles real username-based registration, password security, session state,
 * profile picture uploading, live username availability check, and profile editing.
 * Never fakes credentials or hardcodes users.
 */

import { validateUsername, validateDisplayName } from './utils.js';
import { DEFAULT_AVATAR } from './avatars.js';

const SESSION_KEY = 'golden_grove_current_user';

export class AuthManager {
  constructor() {
    this.currentUser = this.loadStoredUser();
    this.listeners = new Set();
  }

  loadStoredUser() {
    try {
      // Check modern Golden Grove key, fallback to legacy key if migrating
      let data = localStorage.getItem(SESSION_KEY);
      if (!data) {
        data = localStorage.getItem('meshchat_current_user');
      }
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isLoggedIn() {
    return !!this.currentUser && !!this.currentUser.username;
  }

  /**
   * Real-time username availability check against shared user registry.
   * @param {string} username
   * @param {string} [exclude] - Optional username to exclude when editing profile
   * @returns {Promise<{ available: boolean, reason?: string, suggestions?: string[] }>}
   */
  async checkUsername(username, exclude = '') {
    const clean = (username || '').trim().toLowerCase();
    if (!clean) {
      return { available: false, reason: 'Username is required.' };
    }

    try {
      const url = `/api/users/check-username?username=${encodeURIComponent(clean)}${
        exclude ? `&exclude=${encodeURIComponent(exclude.toLowerCase())}` : ''
      }`;
      const res = await fetch(url);
      const data = await res.json();
      return data;
    } catch (err) {
      // Local fallback validation if offline
      const val = validateUsername(clean);
      return { available: val.valid, reason: val.error };
    }
  }

  /**
   * Registers a new account with full name, unique username, password, and DP.
   * @param {{ fullName: string, username: string, password: string, confirmPassword?: string, avatar?: string, bio?: string }} params
   */
  async register({ fullName, username, password, confirmPassword, avatar, bio }) {
    const userVal = validateUsername(username);
    if (!userVal.valid) {
      throw new Error(userVal.error);
    }

    const nameVal = validateDisplayName(fullName || userVal.sanitized);
    if (!nameVal.valid) {
      throw new Error(nameVal.error);
    }

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    if (confirmPassword && confirmPassword !== password) {
      throw new Error('Passwords do not match.');
    }

    const payload = {
      username: userVal.sanitized,
      fullName: nameVal.sanitized,
      displayName: nameVal.sanitized,
      password,
      confirmPassword,
      avatar: avatar || DEFAULT_AVATAR,
      bio: (bio || 'Living peacefully in Golden Grove.').slice(0, 120),
    };

    const res = await fetch('/api/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create Grove account.');
    }

    this.setCurrentUser(data.user);
    return data.user;
  }

  /**
   * Signs in with a registered username and password.
   * @param {{ username: string, password?: string } | string} credentials
   */
  async login(credentials) {
    let username = '';
    let password = '';

    if (typeof credentials === 'string') {
      username = credentials;
    } else if (credentials && typeof credentials === 'object') {
      username = credentials.username || '';
      password = credentials.password || '';
    }

    const userVal = validateUsername(username);
    if (!userVal.valid) {
      throw new Error(userVal.error);
    }

    const res = await fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userVal.sanitized, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Account not found or password incorrect.');
    }

    this.setCurrentUser(data.user);
    return data.user;
  }

  /**
   * Uploads a custom cropped DP image to the server.
   * @param {string} imageBase64 - Base64 data URL
   * @param {string} [mimeType='image/jpeg']
   * @returns {Promise<string>} The uploaded avatar URL
   */
  async uploadAvatar(imageBase64, mimeType = 'image/jpeg') {
    const res = await fetch('/api/users/upload-avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        mimeType,
        username: this.currentUser?.username,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to upload profile picture.');
    }

    return data.avatarUrl;
  }

  /**
   * Updates current user's profile details including optional username change.
   * @param {{ newUsername?: string, displayName?: string, avatar?: string, bio?: string }} params
   */
  async updateProfile({ newUsername, displayName, avatar, bio }) {
    if (!this.currentUser) throw new Error('Not signed in.');

    const payload = {
      username: this.currentUser.username,
      newUsername: newUsername ? newUsername.trim().toLowerCase() : undefined,
      displayName: displayName ? displayName.trim() : undefined,
      avatar,
      bio,
    };

    const res = await fetch('/api/users/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update profile.');
    }

    this.setCurrentUser(data.user);
    return data.user;
  }

  /**
   * Deletes the user account permanently.
   */
  async deleteAccount() {
    if (!this.currentUser) return;
    try {
      await fetch('/api/users/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: this.currentUser.username }),
      });
    } catch (e) {
      console.warn('Delete account error:', e);
    }
    this.logout();
  }

  setCurrentUser(user) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem('meshchat_current_user');
    }
    this.notify();
  }

  logout() {
    this.setCurrentUser(null);
  }

  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      cb(this.currentUser);
    }
  }
}

export const auth = new AuthManager();

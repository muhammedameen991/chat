/**
 * MeshChat - Authentication & Session Management
 * Handles real username-based registration, login, logout, account deletion, and profile state.
 * Never fakes credentials or hardcodes users.
 */

import { validateUsername, validateDisplayName } from './utils.js';

const SESSION_KEY = 'meshchat_current_user';

export class AuthManager {
  constructor() {
    this.currentUser = this.loadStoredUser();
    this.listeners = new Set();
  }

  loadStoredUser() {
    try {
      const data = localStorage.getItem(SESSION_KEY);
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
   * Registers a new unique username.
   */
  async register({ username, displayName, avatar, bio }) {
    const userVal = validateUsername(username);
    if (!userVal.valid) {
      throw new Error(userVal.error);
    }

    const nameVal = validateDisplayName(displayName || userVal.sanitized);
    if (!nameVal.valid) {
      throw new Error(nameVal.error);
    }

    const payload = {
      username: userVal.sanitized,
      displayName: nameVal.sanitized,
      avatar: avatar || 'avatar_1',
      bio: (bio || 'Hey there! I am using MeshChat.').slice(0, 100),
    };

    const res = await fetch('/api/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to register account');
    }

    this.setCurrentUser(data.user);
    return data.user;
  }

  /**
   * Signs in with an existing registered username.
   */
  async login(username) {
    const userVal = validateUsername(username);
    if (!userVal.valid) {
      throw new Error(userVal.error);
    }

    const res = await fetch('/api/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userVal.sanitized }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Account not found. Please check your username or register.');
    }

    this.setCurrentUser(data.user);
    return data.user;
  }

  /**
   * Updates current user's profile.
   */
  async updateProfile({ displayName, avatar, bio }) {
    if (!this.currentUser) throw new Error('Not logged in');

    const res = await fetch('/api/users/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.currentUser.username,
        displayName,
        avatar,
        bio,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update profile');
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

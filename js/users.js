/**
 * Golden Grove - Friend & User Discovery Module
 * Searches actual registered user accounts and manages friend connections.
 */

import { auth } from './auth.js';

export class UsersManager {
  /**
   * Search registered users by username or display name.
   * @param {string} query
   * @returns {Promise<Array<{ username: string, displayName: string, avatar: string, bio: string, isOnline: boolean, relationship: string }>>}
   */
  async searchUsers(query) {
    const currentUser = auth.getCurrentUser()?.username || '';
    const q = encodeURIComponent((query || '').trim());
    const res = await fetch(`/api/users/search?q=${q}&currentUser=${encodeURIComponent(currentUser)}`);

    if (!res.ok) {
      throw new Error('Failed to search users');
    }

    const data = await res.json();
    return data.results || [];
  }

  /**
   * Fetch current user's friends.
   */
  async getFriends() {
    const currentUser = auth.getCurrentUser()?.username || '';
    if (!currentUser) return [];
    const res = await fetch(`/api/users/friends?username=${encodeURIComponent(currentUser)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.friends || [];
  }

  /**
   * Fetch incoming and outgoing friend requests.
   */
  async getRequests() {
    const currentUser = auth.getCurrentUser()?.username || '';
    if (!currentUser) return { incoming: [], outgoing: [] };
    const res = await fetch(`/api/users/requests?username=${encodeURIComponent(currentUser)}`);
    if (!res.ok) return { incoming: [], outgoing: [] };
    return await res.json();
  }

  /**
   * Send a friend request.
   */
  async sendFriendRequest(toUsername) {
    const currentUser = auth.getCurrentUser()?.username || '';
    if (!currentUser) throw new Error('Not logged in');
    const res = await fetch('/api/users/requests/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: currentUser, to: toUsername }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send friend request');
    return data;
  }

  /**
   * Accept or decline a friend request.
   */
  async respondFriendRequest(fromUsername, action) {
    const currentUser = auth.getCurrentUser()?.username || '';
    if (!currentUser) throw new Error('Not logged in');
    const res = await fetch('/api/users/requests/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromUsername, to: currentUser, action }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to respond to request');
    return data;
  }
}

export const users = new UsersManager();

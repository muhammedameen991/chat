/**
 * MeshChat - Friend & User Discovery Module
 * Searches actual registered user accounts. No hardcoded or fake users.
 */

import { auth } from './auth.js';

export class UsersManager {
  /**
   * Search real registered users by username or display name.
   * @param {string} query
   * @returns {Promise<Array<{ username: string, displayName: string, avatar: string, bio: string, isOnline: boolean }>>}
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
   * Fetch specific user profile.
   * @param {string} username
   */
  async getUser(username) {
    const list = await this.searchUsers(username);
    return list.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
  }
}

export const users = new UsersManager();

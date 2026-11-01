/**
 * Vercel Serverless Function: /api/users
 * Real user discovery and authentication coordination for MeshChat on Vercel.
 */

let usersStore = globalThis.__meshchat_users || {};
globalThis.__meshchat_users = usersStore;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Support both /api/users/<action> path routing and ?action=<action> query param
  const urlPath = req.url ? req.url.split('?')[0] : '';
  const pathParts = urlPath.split('/').filter(Boolean);
  const lastSegment = pathParts[pathParts.length - 1] || '';
  const action = req.query.action || (lastSegment !== 'users' ? lastSegment : '');

  // Search users: GET /api/users/search or GET /api/users
  if (req.method === 'GET') {
    const query = (req.query.q || '').trim().toLowerCase();
    const current = (req.query.currentUser || '').trim().toLowerCase();
    const now = Date.now();

    const results = Object.values(usersStore)
      .filter((u) => {
        if (current && u.username === current) return false;
        if (!query) return true;
        return u.username.includes(query) || (u.displayName || '').toLowerCase().includes(query);
      })
      .map((u) => ({
        username: u.username,
        displayName: u.displayName,
        avatar: u.avatar,
        bio: u.bio,
        isOnline: now - (u.lastActive || 0) < 45 * 1000,
        lastActive: u.lastActive,
      }));

    return res.status(200).json({ results });
  }

  // Register, Login, or Heartbeat
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (action === 'register') {
      const { username, displayName, avatar, bio } = body || {};
      if (!username || typeof username !== 'string') {
        return res.status(400).json({ error: 'Username is required' });
      }
      const cleanUser = username.trim().toLowerCase();
      if (cleanUser.length < 3 || cleanUser.length > 20 || !/^[a-z0-9_]+$/.test(cleanUser)) {
        return res.status(400).json({ error: 'Username must be 3-20 characters alphanumeric or underscore' });
      }
      if (usersStore[cleanUser]) {
        return res.status(409).json({ error: 'Username is already taken' });
      }

      const cleanName = displayName && displayName.trim() ? displayName.trim().slice(0, 30) : cleanUser;
      const user = {
        username: cleanUser,
        displayName: cleanName,
        avatar: avatar || 'avatar_1',
        bio: bio || 'Hey there! I am using MeshChat.',
        createdAt: Date.now(),
        lastActive: Date.now(),
      };

      usersStore[cleanUser] = user;
      globalThis.__meshchat_users = usersStore;
      return res.status(201).json({ success: true, user });
    }

    if (action === 'login') {
      const { username } = body || {};
      const cleanUser = (username || '').trim().toLowerCase();
      const user = usersStore[cleanUser];
      if (!user) {
        return res.status(404).json({ error: 'Account not found. Please register first.' });
      }
      user.lastActive = Date.now();
      return res.status(200).json({ success: true, user });
    }

    if (action === 'heartbeat') {
      const { username } = body || {};
      const cleanUser = (username || '').trim().toLowerCase();
      if (usersStore[cleanUser]) {
        usersStore[cleanUser].lastActive = Date.now();
      }
      return res.status(200).json({ ok: true, timestamp: Date.now() });
    }

    // Default POST fallback if no action matched: check body fields
    if (body?.username && body?.displayName) {
      // Treat as register
      const cleanUser = body.username.trim().toLowerCase();
      if (usersStore[cleanUser]) {
        return res.status(409).json({ error: 'Username is already taken' });
      }
      const user = {
        username: cleanUser,
        displayName: body.displayName.trim().slice(0, 30),
        avatar: body.avatar || 'avatar_1',
        bio: body.bio || 'Hey there! I am using MeshChat.',
        createdAt: Date.now(),
        lastActive: Date.now(),
      };
      usersStore[cleanUser] = user;
      globalThis.__meshchat_users = usersStore;
      return res.status(201).json({ success: true, user });
    }
  }

  // Update profile
  if (req.method === 'PATCH' || action === 'profile') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { username, displayName, avatar, bio } = body || {};
    const cleanUser = (username || '').trim().toLowerCase();
    const user = usersStore[cleanUser];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (displayName) user.displayName = displayName.trim().slice(0, 30);
    if (avatar) user.avatar = avatar;
    if (typeof bio === 'string') user.bio = bio.slice(0, 100);
    user.lastActive = Date.now();
    return res.status(200).json({ success: true, user });
  }

  // Delete account
  if (req.method === 'DELETE' || action === 'account') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { username } = body || req.query || {};
    const cleanUser = (username || '').trim().toLowerCase();
    if (usersStore[cleanUser]) {
      delete usersStore[cleanUser];
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: `Method ${req.method} or action ${action} not allowed` });
}

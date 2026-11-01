/**
 * Vercel Serverless Function: /api/users
 * Real user discovery and friend relationships coordination for Golden Grove on Vercel.
 */

let usersStore = globalThis.__goldengrove_users || {};
let friendsStore = globalThis.__goldengrove_friends || {};
let requestsStore = globalThis.__goldengrove_requests || [];

globalThis.__goldengrove_users = usersStore;
globalThis.__goldengrove_friends = friendsStore;
globalThis.__goldengrove_requests = requestsStore;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse path and action
  const urlPath = req.url ? req.url.split('?')[0] : '';
  const pathParts = urlPath.split('/').filter(Boolean);
  const lastSegment = pathParts[pathParts.length - 1] || '';
  const isReqSub = pathParts.includes('requests');
  const action = req.query.action || (lastSegment !== 'users' ? lastSegment : '');

  // 1. GET Requests (Search, Friends list, Friend Requests)
  if (req.method === 'GET') {
    // Friends list: /api/users/friends
    if (action === 'friends' || pathParts.includes('friends')) {
      const current = (req.query.username || '').trim().toLowerCase();
      const list = friendsStore[current] || [];
      const now = Date.now();
      const friends = list
        .map((u) => usersStore[u])
        .filter(Boolean)
        .map((u) => ({
          username: u.username,
          displayName: u.displayName,
          avatar: u.avatar,
          bio: u.bio,
          isOnline: now - (u.lastActive || 0) < 45 * 1000,
          lastActive: u.lastActive,
        }));
      return res.status(200).json({ friends });
    }

    // Friend Requests: /api/users/requests
    if (action === 'requests' || isReqSub) {
      const current = (req.query.username || '').trim().toLowerCase();
      const incoming = requestsStore
        .filter((r) => r.to === current)
        .map((r) => {
          const u = usersStore[r.from];
          return {
            id: r.id,
            from: r.from,
            to: r.to,
            timestamp: r.timestamp,
            displayName: u?.displayName || r.from,
            avatar: u?.avatar || 'avatar_1',
            bio: u?.bio || '',
          };
        });

      const outgoing = requestsStore
        .filter((r) => r.from === current)
        .map((r) => {
          const u = usersStore[r.to];
          return {
            id: r.id,
            from: r.from,
            to: r.to,
            timestamp: r.timestamp,
            displayName: u?.displayName || r.to,
            avatar: u?.avatar || 'avatar_1',
            bio: u?.bio || '',
          };
        });

      return res.status(200).json({ incoming, outgoing });
    }

    // User Search: /api/users/search or GET /api/users
    const query = (req.query.q || '').trim().toLowerCase();
    const current = (req.query.currentUser || '').trim().toLowerCase();
    const now = Date.now();

    const results = Object.values(usersStore)
      .filter((u) => {
        if (current && u.username === current) return false;
        if (!query) return true;
        return u.username.includes(query) || (u.displayName || '').toLowerCase().includes(query);
      })
      .map((u) => {
        const userFriends = current ? (friendsStore[current] || []) : [];
        const isFriend = userFriends.includes(u.username);
        const outgoingReq = current
          ? requestsStore.find((r) => r.from === current && r.to === u.username)
          : null;
        const incomingReq = current
          ? requestsStore.find((r) => r.from === u.username && r.to === current)
          : null;

        let relationship = 'none';
        if (isFriend) relationship = 'friend';
        else if (outgoingReq) relationship = 'sent';
        else if (incomingReq) relationship = 'received';

        return {
          username: u.username,
          displayName: u.displayName,
          avatar: u.avatar,
          bio: u.bio,
          isOnline: now - (u.lastActive || 0) < 45 * 1000,
          lastActive: u.lastActive,
          relationship,
        };
      });

    return res.status(200).json({ results });
  }

  // 2. POST Requests (Register, Login, Heartbeat, Send Request, Respond to Request)
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Send Friend Request: /api/users/requests/send
    if (action === 'send' || (isReqSub && pathParts.includes('send'))) {
      const { from, to } = body || {};
      const cleanFrom = (from || '').trim().toLowerCase();
      const cleanTo = (to || '').trim().toLowerCase();

      if (!cleanFrom || !cleanTo) return res.status(400).json({ error: 'from and to required' });
      if (cleanFrom === cleanTo) return res.status(400).json({ error: 'Cannot friend yourself' });
      if (!usersStore[cleanTo]) return res.status(404).json({ error: 'User does not exist' });

      const fromFriends = friendsStore[cleanFrom] || [];
      if (fromFriends.includes(cleanTo)) return res.status(400).json({ error: 'Already friends' });

      const existing = requestsStore.find(
        (r) => (r.from === cleanFrom && r.to === cleanTo) || (r.from === cleanTo && r.to === cleanFrom)
      );
      if (existing) return res.status(400).json({ error: 'Request already exists' });

      const newReq = {
        id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        from: cleanFrom,
        to: cleanTo,
        timestamp: Date.now(),
      };
      requestsStore.push(newReq);
      globalThis.__goldengrove_requests = requestsStore;
      return res.status(201).json({ success: true, request: newReq });
    }

    // Respond to Friend Request: /api/users/requests/respond
    if (action === 'respond' || (isReqSub && pathParts.includes('respond'))) {
      const { from, to, action: subAction } = body || {};
      const cleanFrom = (from || '').trim().toLowerCase();
      const cleanTo = (to || '').trim().toLowerCase();

      const idx = requestsStore.findIndex((r) => r.from === cleanFrom && r.to === cleanTo);
      if (idx === -1) return res.status(404).json({ error: 'Request not found' });

      requestsStore.splice(idx, 1);
      globalThis.__goldengrove_requests = requestsStore;

      if (subAction === 'accept') {
        if (!friendsStore[cleanFrom]) friendsStore[cleanFrom] = [];
        if (!friendsStore[cleanTo]) friendsStore[cleanTo] = [];
        if (!friendsStore[cleanFrom].includes(cleanTo)) friendsStore[cleanFrom].push(cleanTo);
        if (!friendsStore[cleanTo].includes(cleanFrom)) friendsStore[cleanTo].push(cleanFrom);
        globalThis.__goldengrove_friends = friendsStore;
      }
      return res.status(200).json({ success: true, action: subAction });
    }

    // Register Account
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
        bio: bio || 'Welcome to my Golden Grove haven.',
        createdAt: Date.now(),
        lastActive: Date.now(),
      };

      usersStore[cleanUser] = user;
      globalThis.__goldengrove_users = usersStore;
      return res.status(201).json({ success: true, user });
    }

    // Login
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

    // Heartbeat
    if (action === 'heartbeat') {
      const { username } = body || {};
      const cleanUser = (username || '').trim().toLowerCase();
      if (usersStore[cleanUser]) {
        usersStore[cleanUser].lastActive = Date.now();
      }
      return res.status(200).json({ ok: true, timestamp: Date.now() });
    }
  }

  // PATCH: Update profile
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

  // DELETE: Delete account
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

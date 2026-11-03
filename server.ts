import express, { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '15mb' }));

// Data storage directory and file for persistent registered users and signals
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'meshchat_data.json');
const AVATARS_DIR = path.join(DATA_DIR, 'avatars');

interface UserRecord {
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  passwordHash?: string;
  salt?: string;
  createdAt: number;
  lastActive: number;
}

// Scrypt password hashing with cryptographic salt
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const userSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, userSalt, 64).toString('hex');
  return { hash, salt: userSalt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const computed = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

function stripSensitiveUser(user: UserRecord): Omit<UserRecord, 'passwordHash' | 'salt'> {
  const { passwordHash, salt, ...safe } = user;
  return safe;
}

interface SignalEnvelope {
  id: string;
  from: string;
  to: string;
  type: string;
  payload: any;
  timestamp: number;
}

interface FriendRequest {
  id: string;
  from: string;
  to: string;
  timestamp: number;
}

export interface StoredFileRecord {
  id: string;
  originalName: string;
  sanitizedName: string;
  mimeType: string;
  size: number;
  totalChunks: number;
  uploadedChunks: number[];
  isComplete: boolean;
  sender: string;
  recipient: string;
  uploadedAt: number;
  fileExtension: string;
}

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

interface AppDatabase {
  users: Record<string, UserRecord>;
  signals: SignalEnvelope[];
  friends: Record<string, string[]>;
  requests: FriendRequest[];
  files: Record<string, StoredFileRecord>;
}

// In-memory state
let db: AppDatabase = {
  users: {},
  signals: [],
  friends: {},
  requests: [],
  files: {},
};

// Load data from file if exists
function loadDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    if (!fs.existsSync(AVATARS_DIR)) {
      fs.mkdirSync(AVATARS_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      db = JSON.parse(content);
      if (!db.friends) db.friends = {};
      if (!db.requests) db.requests = [];
      if (!db.users) db.users = {};
      if (!db.signals) db.signals = [];
      if (!db.files) db.files = {};
    }
  } catch (err) {
    console.error('Error loading database:', err);
  }
}

// Save data to file safely
function saveDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

loadDatabase();

// Clean up stale signals periodically (older than 2 minutes)
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 1000;
  if (db.signals.length > 0) {
    db.signals = db.signals.filter((s) => s.timestamp > cutoff);
  }
}, 30 * 1000);

// Active SSE client connections map: username -> Response[]
const sseClients = new Map<string, Response[]>();

function dispatchSignalToUser(toUser: string, signal: SignalEnvelope) {
  const clients = sseClients.get(toUser.toLowerCase());
  if (clients && clients.length > 0) {
    const data = `data: ${JSON.stringify(signal)}\n\n`;
    for (const res of clients) {
      try {
        res.write(data);
      } catch (err) {
        // Ignored, handled in close
      }
    }
  }
}

// ================= API ROUTES ================= //

// Health check and WebRTC config
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    registeredUsersCount: Object.keys(db.users).length,
    activeSseConnections: Array.from(sseClients.values()).reduce((sum, list) => sum + list.length, 0),
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  });
});

// Real-time Username Availability Check
app.get('/api/users/check-username', (req: Request, res: Response) => {
  const raw = typeof req.query.username === 'string' ? req.query.username.trim() : '';
  const exclude = typeof req.query.exclude === 'string' ? req.query.exclude.trim().toLowerCase() : '';

  if (!raw) {
    res.json({ available: false, reason: 'Username cannot be empty.' });
    return;
  }
  const clean = raw.toLowerCase();
  if (clean.length < 3) {
    res.json({ available: false, reason: 'Username must be at least 3 characters.' });
    return;
  }
  if (clean.length > 20) {
    res.json({ available: false, reason: 'Username must be 20 characters or fewer.' });
    return;
  }
  if (!/^[a-z0-9_]+$/.test(clean)) {
    res.json({ available: false, reason: 'Username can only contain letters, numbers, and underscores.' });
    return;
  }

  // If excluding current user's username during edit profile
  if (exclude && clean === exclude) {
    res.json({ available: true, message: 'Current username kept.' });
    return;
  }

  if (db.users[clean]) {
    const suggestions = [
      `${clean}_grove`,
      `${clean}_${Math.floor(10 + Math.random() * 89)}`,
      `golden_${clean}`,
    ].filter((s) => !db.users[s]).slice(0, 3);

    res.json({ available: false, reason: 'Username is already taken.', suggestions });
    return;
  }

  res.json({ available: true, message: 'Username is available!' });
});

// User Registration with Secure Password Hashing
app.post('/api/users/register', (req: Request, res: Response) => {
  const { username, displayName, fullName, password, confirmPassword, avatar, bio } = req.body || {};
  if (!username || typeof username !== 'string') {
    res.status(400).json({ error: 'Username is required.' });
    return;
  }
  const cleanUser = username.trim().toLowerCase();
  if (cleanUser.length < 3 || cleanUser.length > 20 || !/^[a-z0-9_]+$/.test(cleanUser)) {
    res.status(400).json({ error: 'Username must be 3-20 characters alphanumeric or underscore.' });
    return;
  }
  if (db.users[cleanUser]) {
    res.status(409).json({ error: `Username "@${cleanUser}" is already taken.` });
    return;
  }

  const effectiveName = String(fullName || displayName || '').trim();
  if (!effectiveName || effectiveName.length < 2) {
    res.status(400).json({ error: 'Full name is required (at least 2 characters).' });
    return;
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    return;
  }

  if (confirmPassword && confirmPassword !== password) {
    res.status(400).json({ error: 'Passwords do not match.' });
    return;
  }

  const { hash, salt } = hashPassword(password);

  const userRecord: UserRecord = {
    username: cleanUser,
    displayName: effectiveName.slice(0, 40),
    avatar: typeof avatar === 'string' && avatar ? avatar : '/avatars/default_avatar.svg',
    bio: typeof bio === 'string' && bio.trim() ? bio.slice(0, 120) : 'Living peacefully in Golden Grove.',
    passwordHash: hash,
    salt,
    createdAt: Date.now(),
    lastActive: Date.now(),
  };

  db.users[cleanUser] = userRecord;
  saveDatabase();

  res.status(201).json({ success: true, user: stripSensitiveUser(userRecord) });
});

// User Login with Secure Password Verification
app.post('/api/users/login', (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  if (!username || typeof username !== 'string') {
    res.status(400).json({ error: 'Username is required.' });
    return;
  }
  const cleanUser = username.trim().toLowerCase();
  const userRecord = db.users[cleanUser];
  if (!userRecord) {
    res.status(404).json({ error: `Account "@${cleanUser}" not found. Please check your username or register.` });
    return;
  }

  if (userRecord.passwordHash && userRecord.salt) {
    if (!password || typeof password !== 'string') {
      res.status(400).json({ error: 'Password is required to sign in.' });
      return;
    }
    const isMatch = verifyPassword(password, userRecord.passwordHash, userRecord.salt);
    if (!isMatch) {
      res.status(401).json({ error: 'Incorrect password. Please try again.' });
      return;
    }
  } else if (password && typeof password === 'string' && password.length >= 6) {
    // Migration: populate password hash for legacy pre-created demo accounts
    const { hash, salt } = hashPassword(password);
    userRecord.passwordHash = hash;
    userRecord.salt = salt;
  }

  userRecord.lastActive = Date.now();
  saveDatabase();

  res.json({ success: true, user: stripSensitiveUser(userRecord) });
});

// Custom Profile Picture (DP) Upload
app.post('/api/users/upload-avatar', (req: Request, res: Response) => {
  const { imageBase64, mimeType, username } = req.body || {};
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    res.status(400).json({ error: 'Image data is required.' });
    return;
  }

  const cleanMime = typeof mimeType === 'string' ? mimeType.toLowerCase() : 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(cleanMime)) {
    res.status(400).json({ error: 'Only JPG, PNG, and WebP images are supported.' });
    return;
  }

  try {
    const rawData = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const buffer = Buffer.from(rawData, 'base64');

    if (buffer.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: 'Image file size exceeds the 5 MB limit.' });
      return;
    }

    if (!fs.existsSync(AVATARS_DIR)) {
      fs.mkdirSync(AVATARS_DIR, { recursive: true });
    }

    const ext = cleanMime === 'image/png' ? 'png' : cleanMime === 'image/webp' ? 'webp' : 'jpg';
    const id = `dp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const filePath = path.join(AVATARS_DIR, id);
    fs.writeFileSync(filePath, buffer);

    const avatarUrl = `/api/avatars/${id}`;

    if (username && typeof username === 'string') {
      const cleanUser = username.trim().toLowerCase();
      if (db.users[cleanUser]) {
        db.users[cleanUser].avatar = avatarUrl;
        saveDatabase();
      }
    }

    res.status(201).json({ success: true, avatarUrl });
  } catch (err: any) {
    console.error('Avatar upload failed:', err);
    res.status(500).json({ error: 'Failed to process avatar image.' });
  }
});

// Serve uploaded avatars
app.get('/api/avatars/:id', (req: Request, res: Response) => {
  const rawId = req.params.id;
  const safeId = path.basename(rawId);
  const filePath = path.join(AVATARS_DIR, safeId);

  if (!fs.existsSync(filePath)) {
    res.redirect('/avatars/default_avatar.svg');
    return;
  }

  const ext = path.extname(safeId).toLowerCase();
  let contentType = 'image/jpeg';
  if (ext === '.png') contentType = 'image/png';
  else if (ext === '.webp') contentType = 'image/webp';
  else if (ext === '.svg') contentType = 'image/svg+xml';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(filePath);
});

// Heartbeat
app.post('/api/users/heartbeat', (req: Request, res: Response) => {
  const { username } = req.body || {};
  if (username && typeof username === 'string') {
    const clean = username.trim().toLowerCase();
    if (db.users[clean]) {
      db.users[clean].lastActive = Date.now();
    }
  }
  res.json({ ok: true, timestamp: Date.now() });
});

// AI Assistant endpoint (Server-side proxy)
app.post('/api/ai/assist', async (req: Request, res: Response) => {
  const { action, text, tone, targetLang } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    res.json({
      configured: false,
      message: 'AI Assistant features are optional and require a GEMINI_API_KEY environment variable. Private conversations remain strictly local.',
    });
    return;
  }

  try {
    const ai = new GoogleGenAI();
    let prompt = '';
    if (action === 'summarize') {
      prompt = `Summarize the following chat conversation in 2-3 warm, clear bullet points:\n\n${text}`;
    } else if (action === 'suggest_replies') {
      prompt = `Suggest 3 natural, friendly quick replies (under 10 words each) to this message in a messaging app:\n\n"${text}"\n\nReturn ONLY the 3 suggestions, one per line.`;
    } else if (action === 'rewrite_tone') {
      prompt = `Rewrite the following chat draft in a ${tone || 'polite and warm'} tone:\n\n"${text}"\n\nReturn ONLY the rewritten message.`;
    } else if (action === 'extract_tasks') {
      prompt = `Extract any action items, tasks, dates, or reminders from this chat conversation:\n\n${text}\n\nList them concisely with checkable bullet points.`;
    } else if (action === 'translate') {
      prompt = `Translate the following chat message into ${targetLang || 'English'}, maintaining warmth and natural conversational phrasing:\n\n"${text}"\n\nReturn ONLY the translated text.`;
    } else {
      prompt = `Assist with the following query:\n\n${text}`;
    }

    const aiRes = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.json({
      configured: true,
      result: aiRes.text || '',
    });
  } catch (err: any) {
    console.error('AI assistant error:', err);
    res.status(500).json({ configured: true, error: err.message || 'AI request failed' });
  }
});

// User Search
app.get('/api/users/search', (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const current = typeof req.query.currentUser === 'string' ? req.query.currentUser.trim().toLowerCase() : '';

  const now = Date.now();
  const results = Object.values(db.users)
    .filter((u) => {
      if (current && u.username === current) return false;
      if (!query) return true;
      return u.username.includes(query) || u.displayName.toLowerCase().includes(query);
    })
    .map((u) => {
      const userFriends = current ? (db.friends[current] || []) : [];
      const isFriend = userFriends.includes(u.username);
      const outgoingReq = current
        ? db.requests.find((r) => r.from === current && r.to === u.username)
        : null;
      const incomingReq = current
        ? db.requests.find((r) => r.from === u.username && r.to === current)
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
        isOnline: now - u.lastActive < 45 * 1000,
        lastActive: u.lastActive,
        relationship,
      };
    });

  res.json({ results });
});

// Friends List
app.get('/api/users/friends', (req: Request, res: Response) => {
  const current = typeof req.query.username === 'string' ? req.query.username.trim().toLowerCase() : '';
  if (!current) {
    res.status(400).json({ error: 'Username is required' });
    return;
  }
  const friendUsernames = db.friends[current] || [];
  const now = Date.now();
  const friendsList = friendUsernames
    .map((u) => db.users[u])
    .filter(Boolean)
    .map((u) => ({
      username: u.username,
      displayName: u.displayName,
      avatar: u.avatar,
      bio: u.bio,
      isOnline: now - u.lastActive < 45 * 1000,
      lastActive: u.lastActive,
    }));
  res.json({ friends: friendsList });
});

// Friend Requests (Incoming & Outgoing)
app.get('/api/users/requests', (req: Request, res: Response) => {
  const current = typeof req.query.username === 'string' ? req.query.username.trim().toLowerCase() : '';
  if (!current) {
    res.status(400).json({ error: 'Username is required' });
    return;
  }
  const incoming = db.requests
    .filter((r) => r.to === current)
    .map((r) => {
      const u = db.users[r.from];
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

  const outgoing = db.requests
    .filter((r) => r.from === current)
    .map((r) => {
      const u = db.users[r.to];
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

  res.json({ incoming, outgoing });
});

// Send Friend Request
app.post('/api/users/requests/send', (req: Request, res: Response) => {
  const { from, to } = req.body || {};
  if (!from || !to) {
    res.status(400).json({ error: 'Both from and to are required' });
    return;
  }
  const cleanFrom = String(from).trim().toLowerCase();
  const cleanTo = String(to).trim().toLowerCase();

  if (cleanFrom === cleanTo) {
    res.status(400).json({ error: 'Cannot send friend request to yourself' });
    return;
  }
  if (!db.users[cleanTo]) {
    res.status(404).json({ error: 'User does not exist' });
    return;
  }

  // Check if already friends
  const fromFriends = db.friends[cleanFrom] || [];
  if (fromFriends.includes(cleanTo)) {
    res.status(400).json({ error: 'Already friends' });
    return;
  }

  // Check if request already pending
  const existing = db.requests.find(
    (r) => (r.from === cleanFrom && r.to === cleanTo) || (r.from === cleanTo && r.to === cleanFrom)
  );
  if (existing) {
    res.status(400).json({ error: 'A friend request is already pending between these users' });
    return;
  }

  const newReq: FriendRequest = {
    id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    from: cleanFrom,
    to: cleanTo,
    timestamp: Date.now(),
  };
  db.requests.push(newReq);
  saveDatabase();

  res.status(201).json({ success: true, request: newReq });
});

// Respond to Friend Request (Accept or Decline)
app.post('/api/users/requests/respond', (req: Request, res: Response) => {
  const { from, to, action } = req.body || {};
  if (!from || !to || !action) {
    res.status(400).json({ error: 'from, to, and action required' });
    return;
  }
  const cleanFrom = String(from).trim().toLowerCase();
  const cleanTo = String(to).trim().toLowerCase();

  const reqIndex = db.requests.findIndex((r) => r.from === cleanFrom && r.to === cleanTo);
  if (reqIndex === -1) {
    res.status(404).json({ error: 'Request not found' });
    return;
  }

  // Remove request from pending list
  db.requests.splice(reqIndex, 1);

  if (action === 'accept') {
    if (!db.friends[cleanFrom]) db.friends[cleanFrom] = [];
    if (!db.friends[cleanTo]) db.friends[cleanTo] = [];

    if (!db.friends[cleanFrom].includes(cleanTo)) db.friends[cleanFrom].push(cleanTo);
    if (!db.friends[cleanTo].includes(cleanFrom)) db.friends[cleanTo].push(cleanFrom);
  }

  saveDatabase();
  res.json({ success: true, action });
});

// Update Profile
app.patch('/api/users/profile', (req: Request, res: Response) => {
  const { username, newUsername, displayName, avatar, bio } = req.body || {};
  if (!username || typeof username !== 'string') {
    res.status(400).json({ error: 'Username is required.' });
    return;
  }
  const clean = username.trim().toLowerCase();
  const user = db.users[clean];
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Handle username update if requested
  if (newUsername && typeof newUsername === 'string') {
    const cleanNew = newUsername.trim().toLowerCase();
    if (cleanNew !== clean) {
      if (cleanNew.length < 3 || cleanNew.length > 20 || !/^[a-z0-9_]+$/.test(cleanNew)) {
        res.status(400).json({ error: 'New username must be 3-20 characters alphanumeric or underscore.' });
        return;
      }
      if (db.users[cleanNew]) {
        res.status(409).json({ error: `Username "@${cleanNew}" is already taken.` });
        return;
      }

      // Migrate user record
      user.username = cleanNew;
      db.users[cleanNew] = user;
      delete db.users[clean];

      // Migrate friends map
      if (db.friends[clean]) {
        db.friends[cleanNew] = db.friends[clean];
        delete db.friends[clean];
      }
      for (const k of Object.keys(db.friends)) {
        db.friends[k] = db.friends[k].map((u) => (u === clean ? cleanNew : u));
      }

      // Migrate requests
      for (const r of db.requests) {
        if (r.from === clean) r.from = cleanNew;
        if (r.to === clean) r.to = cleanNew;
      }

      // Migrate signals
      for (const s of db.signals) {
        if (s.from === clean) s.from = cleanNew;
        if (s.to === clean) s.to = cleanNew;
      }
    }
  }

  if (displayName && typeof displayName === 'string') {
    user.displayName = displayName.trim().slice(0, 40);
  }
  if (avatar && typeof avatar === 'string') {
    user.avatar = avatar;
  }
  if (typeof bio === 'string') {
    user.bio = bio.slice(0, 120);
  }
  user.lastActive = Date.now();
  saveDatabase();

  res.json({ success: true, user: stripSensitiveUser(user) });
});

// Delete Account
app.delete('/api/users/account', (req: Request, res: Response) => {
  const { username } = req.body || {};
  if (!username || typeof username !== 'string') {
    res.status(400).json({ error: 'Username required' });
    return;
  }
  const clean = username.trim().toLowerCase();
  if (db.users[clean]) {
    delete db.users[clean];
    db.signals = db.signals.filter((s) => s.from !== clean && s.to !== clean);
    saveDatabase();
  }
  res.json({ success: true });
});

// Send Signaling Message
app.post('/api/signaling/send', (req: Request, res: Response) => {
  const { from, to, type, payload, timestamp } = req.body || {};
  if (!from || !to || !type) {
    res.status(400).json({ error: 'Missing required signaling fields (from, to, type)' });
    return;
  }

  const cleanFrom = String(from).trim().toLowerCase();
  const cleanTo = String(to).trim().toLowerCase();

  const envelope: SignalEnvelope = {
    id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    from: cleanFrom,
    to: cleanTo,
    type: String(type),
    payload: payload ?? null,
    timestamp: typeof timestamp === 'number' ? timestamp : Date.now(),
  };

  db.signals.push(envelope);

  // Push to SSE connection if recipient is connected
  dispatchSignalToUser(cleanTo, envelope);

  res.status(200).json({ success: true, signalId: envelope.id });
});

// Poll Signaling Messages (for clients without SSE or during reconnection)
app.get('/api/signaling/poll', (req: Request, res: Response) => {
  const user = typeof req.query.user === 'string' ? req.query.user.trim().toLowerCase() : '';
  const since = Number(req.query.since) || 0;

  if (!user) {
    res.status(400).json({ error: 'Missing "user" query parameter' });
    return;
  }

  // Update user heartbeat on poll
  if (db.users[user]) {
    db.users[user].lastActive = Date.now();
  }

  const signals = db.signals.filter((s) => s.to === user && s.timestamp > since);

  res.json({
    signals,
    serverTime: Date.now(),
  });
});

// Server-Sent Events (SSE) Signaling Stream
app.get('/api/signaling/stream', (req: Request, res: Response) => {
  const user = typeof req.query.user === 'string' ? req.query.user.trim().toLowerCase() : '';
  if (!user) {
    res.status(400).send('Missing user parameter');
    return;
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial connected event
  res.write(`data: ${JSON.stringify({ type: 'connected', user, timestamp: Date.now() })}\n\n`);

  // Register client
  const existing = sseClients.get(user) || [];
  existing.push(res);
  sseClients.set(user, existing);

  // Keep alive ping every 15 seconds
  const pingInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (e) {
      clearInterval(pingInterval);
    }
  }, 15000);

  // Cleanup on close
  req.on('close', () => {
    clearInterval(pingInterval);
    const clients = sseClients.get(user) || [];
    const filtered = clients.filter((c) => c !== res);
    if (filtered.length > 0) {
      sseClients.set(user, filtered);
    } else {
      sseClients.delete(user);
    }
  });
});

// ================= SECURE FILE SHARING API ROUTES ================= //

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB strict maximum
const UPLOAD_CHUNK_SIZE_BYTES = 1024 * 1024; // 1 MB chunked slices
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.vbs', '.msi', '.com', '.scr',
  '.pif', '.hta', '.cpl', '.jar', '.php', '.asp', '.aspx', '.cgi',
]);

function sanitizeServerFilename(fileName: string): string {
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return `file_${Date.now()}`;
  }
  // Strip null bytes and control chars
  let clean = fileName.replace(/[\x00-\x1f\x7f]/g, '').trim();
  // Strip path traversal characters
  clean = clean.replace(/(\.\.[\/\\])+/g, '').replace(/[/\\]/g, '_');
  // Separate basename and extension
  const ext = path.extname(clean).toLowerCase();
  let base = path.basename(clean, ext).slice(0, 80);
  base = base.replace(/[^a-zA-Z0-9_\-\.\s]/g, '_');
  if (!base.trim()) base = 'file';
  return `${base}${ext}`;
}

// 1. Storage config & quotas
app.get('/api/files/config', (_req: Request, res: Response) => {
  res.json({
    maxFileSize: MAX_FILE_SIZE_BYTES,
    maxFileSizeHuman: '50 MB',
    chunkSize: UPLOAD_CHUNK_SIZE_BYTES,
    chunkSizeHuman: '1 MB',
    blockedExtensions: Array.from(BLOCKED_EXTENSIONS),
    supportedTypes: [
      'images', 'videos', 'audio', 'pdf', 'documents',
      'spreadsheets', 'presentations', 'archives', 'code', 'generic',
    ],
  });
});

// 2. Initialize chunked file upload
app.post('/api/files/init', (req: Request, res: Response) => {
  const { fileName, fileSize, mimeType, sender, recipient } = req.body || {};

  if (!fileName || typeof fileName !== 'string') {
    res.status(400).json({ error: 'Filename is required' });
    return;
  }
  if (typeof fileSize !== 'number' || fileSize <= 0) {
    res.status(400).json({ error: 'Valid file size is required' });
    return;
  }
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    res.status(400).json({
      error: `File size (${(fileSize / (1024 * 1024)).toFixed(1)} MB) exceeds the configured 50 MB maximum limit.`,
    });
    return;
  }

  const ext = path.extname(fileName).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    res.status(400).json({
      error: `Executable or script file type "${ext}" is blocked for security reasons.`,
    });
    return;
  }

  const sanitized = sanitizeServerFilename(fileName);
  const fileId = `grove_file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const totalChunks = Math.ceil(fileSize / UPLOAD_CHUNK_SIZE_BYTES);

  // Create temporary chunk storage folder
  const tempFolder = path.join(UPLOADS_DIR, `temp_${fileId}`);
  if (!fs.existsSync(tempFolder)) {
    fs.mkdirSync(tempFolder, { recursive: true });
  }

  const record: StoredFileRecord = {
    id: fileId,
    originalName: fileName,
    sanitizedName: sanitized,
    mimeType: typeof mimeType === 'string' && mimeType ? mimeType : 'application/octet-stream',
    size: fileSize,
    totalChunks,
    uploadedChunks: [],
    isComplete: false,
    sender: typeof sender === 'string' ? sender.trim().toLowerCase() : 'unknown',
    recipient: typeof recipient === 'string' ? recipient.trim().toLowerCase() : 'all',
    uploadedAt: Date.now(),
    fileExtension: ext,
  };

  db.files[fileId] = record;
  saveDatabase();

  res.status(201).json({
    fileId,
    sanitizedName: sanitized,
    chunkSize: UPLOAD_CHUNK_SIZE_BYTES,
    totalChunks,
    maxFileSize: MAX_FILE_SIZE_BYTES,
  });
});

// 3. Upload chunk (resumable slice)
app.post('/api/files/chunk', (req: Request, res: Response) => {
  const { fileId, chunkIndex, chunkData, sender } = req.body || {};

  if (!fileId || typeof chunkIndex !== 'number' || !chunkData) {
    res.status(400).json({ error: 'fileId, chunkIndex, and chunkData are required' });
    return;
  }

  const record = db.files[fileId];
  if (!record) {
    res.status(404).json({ error: 'Upload session not found or expired' });
    return;
  }

  if (sender && typeof sender === 'string' && sender.trim().toLowerCase() !== record.sender) {
    res.status(403).json({ error: 'Unauthorized chunk sender' });
    return;
  }

  const tempFolder = path.join(UPLOADS_DIR, `temp_${fileId}`);
  if (!fs.existsSync(tempFolder)) {
    fs.mkdirSync(tempFolder, { recursive: true });
  }

  const chunkPath = path.join(tempFolder, `chunk_${chunkIndex}`);
  try {
    const buffer = Buffer.from(chunkData, 'base64');
    fs.writeFileSync(chunkPath, buffer);

    if (!record.uploadedChunks.includes(chunkIndex)) {
      record.uploadedChunks.push(chunkIndex);
      record.uploadedChunks.sort((a, b) => a - b);
    }

    // Check if all chunks have arrived
    if (record.uploadedChunks.length === record.totalChunks) {
      // Assemble chunks into target file
      const targetFilePath = path.join(UPLOADS_DIR, fileId);
      const writeStream = fs.createWriteStream(targetFilePath);

      for (let i = 0; i < record.totalChunks; i++) {
        const partPath = path.join(tempFolder, `chunk_${i}`);
        if (fs.existsSync(partPath)) {
          const partBuffer = fs.readFileSync(partPath);
          writeStream.write(partBuffer);
        }
      }
      writeStream.end();

      // Clean up temp chunk files
      try {
        fs.rmSync(tempFolder, { recursive: true, force: true });
      } catch (e) {
        // Ignored
      }

      record.isComplete = true;
      saveDatabase();

      res.json({
        complete: true,
        fileId: record.id,
        sanitizedName: record.sanitizedName,
        size: record.size,
        mimeType: record.mimeType,
        downloadUrl: `/api/files/${record.id}/download`,
        previewUrl: `/api/files/${record.id}/preview`,
      });
      return;
    }

    res.json({
      complete: false,
      chunkIndex,
      uploadedCount: record.uploadedChunks.length,
      totalChunks: record.totalChunks,
      progress: Math.round((record.uploadedChunks.length / record.totalChunks) * 100),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to write chunk: ' + err.message });
  }
});

// 4. Check upload status (for pause & resume)
app.get('/api/files/:id/status', (req: Request, res: Response) => {
  const fileId = req.params.id;
  const record = db.files[fileId];
  if (!record) {
    res.status(404).json({ error: 'File upload not found' });
    return;
  }
  res.json({
    fileId: record.id,
    isComplete: record.isComplete,
    totalChunks: record.totalChunks,
    uploadedChunks: record.uploadedChunks,
    progress: Math.round((record.uploadedChunks.length / record.totalChunks) * 100),
  });
});

// 5. Cancel and clean up file upload
app.post('/api/files/:id/cancel', (req: Request, res: Response) => {
  const fileId = req.params.id;
  const record = db.files[fileId];
  if (record) {
    const tempFolder = path.join(UPLOADS_DIR, `temp_${fileId}`);
    try {
      if (fs.existsSync(tempFolder)) {
        fs.rmSync(tempFolder, { recursive: true, force: true });
      }
    } catch {
      // Ignored
    }
    delete db.files[fileId];
    saveDatabase();
  }
  res.json({ canceled: true });
});

// 6. Safe Download with Content-Disposition & access control
app.get('/api/files/:id/download', (req: Request, res: Response) => {
  const fileId = req.params.id;
  const user = typeof req.query.user === 'string' ? req.query.user.trim().toLowerCase() : '';
  const record = db.files[fileId];

  if (!record || !record.isComplete) {
    res.status(404).json({ error: 'File not found or upload is incomplete' });
    return;
  }

  // Access control validation: requester must be sender or recipient
  if (user && record.recipient !== '__saved_notes__' && !record.recipient.startsWith('group_')) {
    if (user !== record.sender && user !== record.recipient) {
      res.status(403).json({ error: 'Access denied: You are not a participant in this conversation.' });
      return;
    }
  }

  const filePath = path.join(UPLOADS_DIR, fileId);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Physical file not found in Grove storage' });
    return;
  }

  // Safe headers to prevent execution of untrusted files
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(record.sanitizedName)}"`);
  res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.setHeader('Content-Length', record.size);

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

// 7. Safe inline preview for media (images, audio, video, pdf)
app.get('/api/files/:id/preview', (req: Request, res: Response) => {
  const fileId = req.params.id;
  const record = db.files[fileId];

  if (!record || !record.isComplete) {
    res.status(404).json({ error: 'Preview not available' });
    return;
  }

  const filePath = path.join(UPLOADS_DIR, fileId);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File content missing' });
    return;
  }

  const safePreviewMimes = ['image/', 'video/', 'audio/', 'application/pdf', 'text/plain'];
  const isSafePreview = safePreviewMimes.some((m) => (record.mimeType || '').startsWith(m));

  if (!isSafePreview) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(record.sanitizedName)}"`);
  } else {
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(record.sanitizedName)}"`);
  }

  res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Length', record.size);

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});


// ================= STATIC ASSET & DEV SERVER ================= //

async function startServer() {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`MeshChat full-stack server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

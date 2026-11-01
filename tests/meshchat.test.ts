import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUsername,
  validateDisplayName,
  transitionMessageStatus,
  createChatMessage,
  escapeHtml,
  filterUsers,
  validateSignalingMessage,
  formatFileSize,
} from '../js/utils.js';

test('validateUsername handles valid usernames correctly', () => {
  const result1 = validateUsername('alice');
  assert.equal(result1.valid, true);
  assert.equal(result1.sanitized, 'alice');

  const result2 = validateUsername(' Bob_99 ');
  assert.equal(result2.valid, true);
  assert.equal(result2.sanitized, 'bob_99');
});

test('validateUsername rejects invalid usernames', () => {
  assert.equal(validateUsername('al').valid, false); // too short
  assert.equal(validateUsername('a'.repeat(25)).valid, false); // too long
  assert.equal(validateUsername('alice-bob').valid, false); // invalid hyphen
  assert.equal(validateUsername('alice bob').valid, false); // space
  assert.equal(validateUsername('admin').valid, false); // reserved
  assert.equal(validateUsername('meshchat').valid, false); // reserved
});

test('validateDisplayName validates properly', () => {
  assert.equal(validateDisplayName('Alice Wonderland').valid, true);
  assert.equal(validateDisplayName('').valid, false);
  assert.equal(validateDisplayName('   ').valid, false);
});

test('transitionMessageStatus enforces unidirectional progress', () => {
  assert.equal(transitionMessageStatus('sending', 'sent'), 'sent');
  assert.equal(transitionMessageStatus('sent', 'delivered'), 'delivered');
  assert.equal(transitionMessageStatus('delivered', 'read'), 'read');
  // Cannot downgrade from read back to delivered
  assert.equal(transitionMessageStatus('read', 'delivered'), 'read');
  assert.equal(transitionMessageStatus('delivered', 'sent'), 'delivered');
  // Can fail
  assert.equal(transitionMessageStatus('sending', 'failed'), 'failed');
  // Can retry from failed
  assert.equal(transitionMessageStatus('failed', 'sending'), 'sending');
});

test('createChatMessage builds valid structure', () => {
  const msg = createChatMessage({
    sender: 'Alice',
    recipient: 'Bob',
    text: 'Hello, Bob!',
  });
  assert.equal(msg.sender, 'alice');
  assert.equal(msg.recipient, 'bob');
  assert.equal(msg.text, 'Hello, Bob!');
  assert.equal(msg.status, 'sending');
  assert.ok(msg.id.startsWith('msg_'));
  assert.ok(msg.timestamp > 0);
});

test('escapeHtml prevents XSS injections', () => {
  const raw = '<script>alert("xss")</script>&"test"';
  const escaped = escapeHtml(raw);
  assert.equal(escaped.includes('<script>'), false);
  assert.equal(escaped, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&amp;&quot;test&quot;');
});

test('filterUsers filters by username and displayName case-insensitively', () => {
  const users = [
    { username: 'alice', displayName: 'Alice Liddell', avatar: '1.svg' },
    { username: 'bob', displayName: 'Robert Smith', avatar: '2.svg' },
    { username: 'carol', displayName: 'Carol Danvers', avatar: '3.svg' },
  ];

  // Self excluded
  const result1 = filterUsers(users, '', 'alice');
  assert.equal(result1.length, 2);
  assert.equal(result1.some((u) => u.username === 'alice'), false);

  // Search by username
  const result2 = filterUsers(users, 'bo', 'alice');
  assert.equal(result2.length, 1);
  assert.equal(result2[0].username, 'bob');

  // Search by display name
  const result3 = filterUsers(users, 'danvers', 'alice');
  assert.equal(result3.length, 1);
  assert.equal(result3[0].username, 'carol');
});

test('validateSignalingMessage validates envelopes', () => {
  assert.equal(
    validateSignalingMessage({
      from: 'alice',
      to: 'bob',
      type: 'offer',
      payload: { sdp: 'fake' },
      timestamp: Date.now(),
    }).valid,
    true
  );

  assert.equal(validateSignalingMessage(null).valid, false);
  assert.equal(validateSignalingMessage({ from: 'alice', to: 'bob', type: 'unknown' }).valid, false);
});

test('formatFileSize formats human readable sizes', () => {
  assert.equal(formatFileSize(500), '500 B');
  assert.equal(formatFileSize(2048), '2.0 KB');
  assert.equal(formatFileSize(1048576 * 3.5), '3.5 MB');
});
